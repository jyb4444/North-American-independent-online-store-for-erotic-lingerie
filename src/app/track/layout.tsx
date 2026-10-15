import type { Metadata } from 'next';

// Tracking pages (especially /track/<token>) show a customer's order status.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function TrackLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
