/** Compatibility release: referral reward issuance is deliberately unavailable until the final release. */
export type ReferralRewardKind = 'welcome' | 'referrer';
export const referralRewardsEnabled = () => false;
export function missingRewardSchema(error: { code?: string; message?: string } | null) {
  return !!error && ['PGRST202', 'PGRST205', '42P01', '42883'].includes(error.code ?? '');
}
export function referralRewardSettings() {
  const amount = Number(process.env.REFERRAL_REWARD_AMOUNT ?? 10);
  const minimumSubtotal = Number(process.env.REFERRAL_REWARD_MIN_SUBTOTAL ?? 30);
  return {
    amount: Number.isFinite(amount) && amount > 0 ? amount : 10,
    minimumSubtotal: Number.isFinite(minimumSubtotal) && minimumSubtotal >= 0 ? minimumSubtotal : 30,
  };
}
export async function issueReferralReward(input: { userId: string; email: string; kind: ReferralRewardKind; referredUserId: string }) { void input; }
export async function knownReferralPayment(eventId: string, shop: string, hash: string) { void eventId; void shop; void hash; return false; }
export async function recordReferralPayment(input: { eventId: string; shop: string; hash: string; orderId: string; userId: string }) { void input; }
export async function processReferralWork() { return { enabled: false, events: 0, rewards: 0 }; }
