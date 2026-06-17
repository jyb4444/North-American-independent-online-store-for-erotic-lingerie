import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import DailyRewardCard from '@/components/rewards/DailyRewardCard';

const TIERS = [
  {
    name: 'Bronze', range: 'Private setup', color: 'text-gold-400',
    border: 'border-gold-400/40', bg: 'bg-gold-400/5',
    perks: ['Private wishlist tools', 'Early collection previews', 'Saved fit guidance'],
  },
  {
    name: 'Silver', range: 'Guided styling', color: 'text-zinc-300',
    border: 'border-zinc-300/40', bg: 'bg-zinc-300/5',
    perks: ['Private wishlist tools', 'Fit-guided style setup', 'Priority styling support', 'Saved AI look references'],
  },
  {
    name: 'Gold', range: 'Preview tools', color: 'text-yellow-400',
    border: 'border-yellow-400/40', bg: 'bg-yellow-400/5',
    perks: ['Private wishlist tools', 'Advanced style setup', 'Dedicated styling support', 'First access to collection previews', 'Saved AI look references'],
  },
];

export default async function MembershipPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: membership } = await (supabase as any)
    .from('memberships')
    .select('tier')
    .eq('user_id', user.id)
    .single();

  const currentTier = (membership as { tier?: string } | null)?.tier ?? 'bronze';

  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <div className="mb-12 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.4em] text-gold-400">Velour</p>
        <h1 className="font-serif text-4xl font-light italic text-ivory">Private Style Tools</h1>
        <div className="mx-auto mt-4 h-px w-12 bg-gold-400/40" />
        <p className="mx-auto mt-4 max-w-sm text-sm font-light leading-relaxed text-ivory-muted">
          Keep private style tools, fit guidance, and saved looks organized in your account.
        </p>
      </div>

      <DailyRewardCard source="membership" compact className="mb-6" />

      <div className="grid gap-4 sm:grid-cols-3">
        {TIERS.map((tier) => {
          const isCurrent = tier.name.toLowerCase() === currentTier;
          return (
            <div key={tier.name} className={`relative border ${tier.border} ${tier.bg} p-6 ${isCurrent ? 'ring-1 ring-gold-400/30' : ''}`}>
              {isCurrent && (
                <span className="absolute right-3 top-3 border border-gold-400/40 px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest text-gold-400">
                  Current
                </span>
              )}
              <p className={`font-serif text-2xl font-light italic ${tier.color}`}>{tier.name}</p>
              <p className="mt-1 text-xs text-ivory-dim">{tier.range}</p>
              <ul className="mt-5 space-y-2">
                {tier.perks.map((perk) => (
                  <li key={perk} className="flex items-start gap-2 text-xs text-ivory-muted">
                    <span className={`mt-0.5 flex-shrink-0 ${tier.color}`}>✦</span>
                    {perk}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <div className="mt-8 text-center">
        <Link href="/account" className="text-xs uppercase tracking-widest text-ivory-dim transition hover:text-gold-400">
          ← Back to Account
        </Link>
      </div>
    </div>
  );
}
