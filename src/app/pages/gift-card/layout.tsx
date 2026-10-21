import { publicPageMetadata } from '@/lib/seo';

export const metadata = {
  ...publicPageMetadata({
    title: 'Gift Cards',
    description: 'Send a Self Love gift card for intimate apparel, lingerie and hosiery.',
    path: '/pages/gift-card',
  }),
};

export default function PageLayout({ children }: { children: React.ReactNode }) {
  return children;
}
