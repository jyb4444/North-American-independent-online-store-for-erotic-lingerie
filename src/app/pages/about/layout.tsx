import { publicPageMetadata } from '@/lib/seo';

export const metadata = {
  ...publicPageMetadata({
    title: 'About',
    description: 'Learn about Self Love, our approach to intimate apparel, private shopping and thoughtful product selection.',
    path: '/pages/about',
  }),
  robots: { index: false, follow: true },
};

export default function PageLayout({ children }: { children: React.ReactNode }) {
  return children;
}
