import type { Metadata } from 'next';

// Login, account, orders and returns are private to each customer.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
