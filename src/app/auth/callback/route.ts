import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { sendWelcomeEmail } from '@/lib/email';
import { createAdminClient } from '@/lib/supabase/server';
import { safeRedirectPath } from '@/lib/redirect';
import { issueReferralReward, missingRewardSchema, referralRewardsEnabled } from '@/lib/referral-rewards';
import { createRecoveryProof, recoveryProofMaxAge } from '@/lib/password-recovery';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  // `next` is attacker-controllable; only same-site relative paths are followed.
  const next = safeRedirectPath(searchParams.get('next'));

  if (code) {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Welcome email exactly once per account. The flag lives in app_metadata, which users
      // cannot edit, so later magic-link / OAuth sign-ins do not resend it.
      const user = data.session?.user;
      if (user?.email && !user.app_metadata?.welcome_email_sent) {
        const firstName = (user.user_metadata?.first_name as string | undefined) ?? '';
        try {
          await sendWelcomeEmail(user.email, firstName);
          await createAdminClient().auth.admin.updateUserById(user.id, {
            app_metadata: { ...user.app_metadata, welcome_email_sent: true },
          });
        } catch (error) {
          console.error('Welcome email failed:', error);
        }
      }

      // Credit a referral code captured at sign-up, once the email is confirmed.
      // redeem_referral() is idempotent per user and ignores self-referrals.
      const referralCode = user?.user_metadata?.referral_code;
      if (user?.email && user.email_confirmed_at && typeof referralCode === 'string' && referralCode.trim()) {
        const db = createAdminClient();
        const { error: referralError } = await db
          .rpc('redeem_referral', { p_code: referralCode, p_user_id: user.id });
        if (referralError && !(missingRewardSchema(referralError) && !referralRewardsEnabled())) console.error('Referral redemption unavailable');
        // The new account's half of the reward (the referrer's half follows its first paid
        // order). Checked on every sign-in so a reward Shopify failed to create is retried;
        // issueReferralReward() returns early once the code exists.
        const { data: redemption } = await db
          .from('referral_redemptions')
          .select('referred_user_id')
          .eq('referred_user_id', user.id)
          .maybeSingle();
        if (referralRewardsEnabled() && !referralError && redemption) {
          await issueReferralReward({ userId: user.id, email: user.email, kind: 'welcome', referredUserId: user.id })
            .catch((error) => console.error('Welcome referral reward failed:', error));
        }
      }

      const response = NextResponse.redirect(`${origin}${next}`);
      if (next === '/update-password' && user) {
        response.cookies.set('password_recovery_authorized', createRecoveryProof(user.id), {
          httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
          path: '/api/account/recover-password', maxAge: recoveryProofMaxAge,
        });
      }
      return response;
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
