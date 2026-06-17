import type { Metadata } from 'next';
import './globals.css';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import AgeGate from '@/components/layout/AgeGate';
import CartDrawer from '@/components/cart/CartDrawer';
import CartSyncProvider from '@/components/cart/CartSyncProvider';
import AnalyticsProvider from '@/components/layout/AnalyticsProvider';
import CookieConsent from '@/components/layout/CookieConsent';
import ErrorBoundary from '@/components/ErrorBoundary';
import ContextTranslateMenu from '@/components/layout/ContextTranslateMenu';
import FirstFreeSignupModal from '@/components/promotion/FirstFreeSignupModal';
import MobileBottomNav from '@/components/layout/MobileBottomNav';
import NewsletterSlide from '@/components/ui/NewsletterSlide';

export const metadata: Metadata = {
  title: { default: 'Velour — Premium Intimate Apparel', template: '%s | Velour' },
  description: 'Discover luxurious intimate apparel with private fit guidance and saved style tools.',
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans bg-wine-950 text-ivory antialiased">
        <AnalyticsProvider>
          <AgeGate />
          <Header />
          <ErrorBoundary>
            <main className="min-h-screen">{children}</main>
          </ErrorBoundary>
          <Footer />
          <CartDrawer />
          <CartSyncProvider />
          <ContextTranslateMenu />
          <FirstFreeSignupModal />
          <CookieConsent />
          <MobileBottomNav />
          <NewsletterSlide />
        </AnalyticsProvider>
      </body>
    </html>
  );
}
