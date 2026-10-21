import { publicPageMetadata } from '@/lib/seo';

export const metadata = {
  ...publicPageMetadata({
    title: 'Shopping, Sizing & Delivery FAQ',
    description: 'Find answers about Self Love products, sizing, ordering, delivery, returns and private shopping.',
    path: '/pages/faq',
  }),
};

export default function PageLayout({ children }: { children: React.ReactNode }) {
  return children;
}
