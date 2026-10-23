import ReferralClient from './ReferralClient';
import { referralRewardSettings, referralRewardsEnabled } from '@/lib/referral-config';

export default function ReferralPage() {
  return <ReferralClient rewardsEnabled={referralRewardsEnabled()} rewardSettings={referralRewardSettings()} />;
}
