import { publicPageMetadata } from '@/lib/seo';

export const metadata = {
  ...publicPageMetadata({
    title: 'Returns & Exchanges',
    description: 'Review Self Love return eligibility, hygiene restrictions, timing and the return request process.',
    path: '/pages/returns',
  }),
};

export default function PageLayout({ children }: { children: React.ReactNode }) {
  return children;
}
