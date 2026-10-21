import { publicPageMetadata } from '@/lib/seo';

export const metadata = {
  ...publicPageMetadata({
    title: 'Contact',
    description: 'Contact Self Love for product questions, size guidance, order support, returns and privacy concerns.',
    path: '/pages/contact',
  }),
};

export default function PageLayout({ children }: { children: React.ReactNode }) {
  return children;
}
