export const referralRewardsEnabled = () => process.env.REFERRAL_REWARDS_ENABLED === 'true';

export function referralRewardSettings() {
  const amount = Number(process.env.REFERRAL_REWARD_AMOUNT ?? 10);
  const minimumSubtotal = Number(process.env.REFERRAL_REWARD_MIN_SUBTOTAL ?? 30);
  return {
    amount: Number.isFinite(amount) && amount > 0 ? amount : 10,
    minimumSubtotal: Number.isFinite(minimumSubtotal) && minimumSubtotal >= 0 ? minimumSubtotal : 30,
  };
}
