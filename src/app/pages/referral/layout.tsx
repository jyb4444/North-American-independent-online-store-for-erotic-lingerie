import { publicPageMetadata } from '@/lib/seo';

export const metadata = {
  ...publicPageMetadata({
    title: 'Refer a Friend',
    description: 'Learn how Self Love referrals and personal rewards work after account and email verification.',
    path: '/pages/referral',
  }),
};

export default function PageLayout({ children }: { children: React.ReactNode }) {
  return children;
}
