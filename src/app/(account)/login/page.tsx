import LoginClient from './LoginClient';
import { referralRewardSettings, referralRewardsEnabled } from '@/lib/referral-config';

export default function LoginPage() {
  return <LoginClient referralsEnabled={referralRewardsEnabled()} referralSettings={referralRewardSettings()} />;
}
