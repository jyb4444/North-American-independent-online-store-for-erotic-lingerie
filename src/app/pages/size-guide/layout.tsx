import { publicPageMetadata } from '@/lib/seo';

export const metadata = {
  ...publicPageMetadata({
    title: 'Lingerie & Hosiery Size Guide',
    description: 'Use the Self Love size guide to compare measurements and choose lingerie and hosiery sizes.',
    path: '/pages/size-guide',
  }),
};

export default function PageLayout({ children }: { children: React.ReactNode }) {
  return children;
}
