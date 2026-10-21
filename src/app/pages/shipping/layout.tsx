import { publicPageMetadata } from '@/lib/seo';

export const metadata = {
  ...publicPageMetadata({
    title: 'Shipping & Fulfillment',
    description: 'Read Self Love shipping, fulfillment, delivery and discreet packaging information.',
    path: '/pages/shipping',
  }),
};

export default function PageLayout({ children }: { children: React.ReactNode }) {
  return children;
}
