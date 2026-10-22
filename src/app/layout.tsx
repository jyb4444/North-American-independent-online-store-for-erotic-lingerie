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
import { AGE_GATE_PREPAINT_SCRIPT } from '@/lib/popups';
import JsonLd from '@/components/seo/JsonLd';
import { DEFAULT_DESCRIPTION, SITE_NAME, SITE_URL, absoluteUrl } from '@/lib/seo';

const isPreviewDeployment = process.env.VERCEL_ENV === 'preview';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'Self Love — Premium Intimate Apparel', template: '%s | Self Love' },
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,
  category: 'shopping',
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
  },
  robots: { index: !isPreviewDeployment, follow: !isPreviewDeployment },
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: 'Self Love — Premium Intimate Apparel',
    description: DEFAULT_DESCRIPTION,
    url: SITE_URL,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Self Love — Premium Intimate Apparel',
    description: DEFAULT_DESCRIPTION,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the <head> script may add data-age-verified before hydration.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: AGE_GATE_PREPAINT_SCRIPT }} />
      </head>
      <body className="font-sans bg-wine-950 text-ivory antialiased">
        <JsonLd data={{
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'Organization',
              '@id': `${SITE_URL}/#organization`,
              name: SITE_NAME,
              url: SITE_URL,
              logo: absoluteUrl('/logo.png'),
            },
            {
              '@type': 'WebSite',
              '@id': `${SITE_URL}/#website`,
              name: SITE_NAME,
              url: SITE_URL,
              publisher: { '@id': `${SITE_URL}/#organization` },
              inLanguage: 'en-US',
            },
          ],
        }} />
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
        </AnalyticsProvider>
      </body>
    </html>
  );
}
