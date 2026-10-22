import { createAdminClient } from '@/lib/supabase/server';

export type NotificationKind = 'return_customer' | 'return_merchant' | 'newsletter_confirmation' | 'newsletter_welcome' | 'restock';

export async function enqueueNotification(kind: NotificationKind, identity: string, payload: Record<string, unknown>) {
  const db = createAdminClient();
  const { error } = await db.from('notification_jobs' as never).upsert({
    kind, identity, payload, status: 'pending', next_attempt_at: new Date().toISOString(),
  } as never, { onConflict: 'identity', ignoreDuplicates: true } as never);
  if (error) throw new Error(error.message);
}

export function retryAt(attempts: number) {
  const minutes = Math.min(24 * 60, 2 ** Math.min(attempts, 10));
  return new Date(Date.now() + minutes * 60_000).toISOString();
}
