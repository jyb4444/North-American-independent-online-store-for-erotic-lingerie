import Link from 'next/link';
import { publicPageMetadata } from '@/lib/seo';

export const metadata = publicPageMetadata({
  title: 'Privacy Policy',
  description: 'How Self Love collects, uses, and protects your personal information.',
  path: '/pages/privacy',
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 font-serif text-xl font-light text-ivory">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-ivory-muted">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <p className="mb-2 text-xs font-medium uppercase tracking-[0.3em] text-gold-400">Legal</p>
      <h1 className="font-serif text-4xl font-light text-ivory">Privacy Policy</h1>
      <div className="mx-auto mt-4 mb-3 h-px w-12 bg-gold-400/40" />
      <p className="mb-10 text-xs text-ivory-dim">Last updated: October 2026</p>

      <Section title="1. Who We Are">
        <p>Self Love (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) operates this website. We are committed to protecting your privacy with particular care given the personal nature of the products we sell. This policy explains what data we collect, how we use it, and your rights.</p>
        <p>Contact: <a href="/pages/contact" className="text-gold-400 hover:underline">Contact us</a> or email us directly via the contact form.</p>
      </Section>

      <Section title="2. Information We Collect">
        <p><strong className="text-ivory">Account information:</strong> When you register, we collect your name and email address. This information is stored securely in our database.</p>
        <p><strong className="text-ivory">Wishlist data:</strong> Items you save to your wishlist are stored in our database linked to your account.</p>
        <p><strong className="text-ivory">Address information:</strong> If you provide a shipping address, it is stored in our database.</p>
        <p><strong className="text-ivory">Bag contents:</strong> If you are signed in, the items in your bag are saved to your account so you can continue on another device, and we may send you a reminder email about items left in your bag. Signing out removes the bag from that browser.</p>
        <p><strong className="text-ivory">Orders, returns and reviews:</strong> We keep your order and shipping status, return requests (including any photos you upload, which are private to you and our team), and reviews you write. Reviews are shown publicly under a masked name or &ldquo;Anonymous shopper&rdquo;; your email and phone are never shown.</p>
        <p><strong className="text-ivory">Usage analytics:</strong> With your consent, we use PostHog to collect page paths and general feature usage. We do not send account identifiers, product or variant identifiers, selected sizes or colours, bag contents, fit recommendations, measurements, or AI images to analytics.</p>
        <p><strong className="text-ivory">Payment data:</strong> Payments are processed by our payment provider. We do not store card numbers or full payment details on our servers.</p>
      </Section>

      <Section title="3. How We Use Your Information">
        <p>We use your information to: fulfil your orders and communicate order status; provide customer support; send transactional emails (order confirmation, shipping updates, back-in-stock alerts you have requested); improve the website and your shopping experience.</p>
        <p>We do not sell, rent, or trade your personal information to third parties for marketing purposes.</p>
      </Section>

      <Section title="4. Discreet Billing">
        <p>Charges appear discreetly and never include &ldquo;intimate apparel&rdquo; or any description that reveals the nature of your purchase. Packaging is similarly discreet.</p>
      </Section>

      <Section title="5. Cookies and Tracking">
        <p>We use essential cookies to maintain your session. We use analytics cookies (PostHog) only with your consent. You can manage your preferences at any time via the cookie settings at the bottom of any page. Declining analytics cookies does not affect your ability to use the website.</p>
      </Section>

      <Section title="6. Data Retention">
        <p>Account data is retained for as long as your account is active or as required for legal, tax, fraud-prevention, and transaction-record obligations. You may request deletion of eligible account data by contacting us.</p>
      </Section>

      <Section title="7. Your Rights">
        <p>Depending on your location, you may have the right to: access the personal data we hold about you; correct inaccurate data; request deletion of your data; object to processing; data portability. To exercise any of these rights, please <Link href="/pages/contact" className="text-gold-400 hover:underline">contact us</Link>.</p>
      </Section>

      <Section title="8. Security">
        <p>We use industry-standard measures to protect your data, including encrypted connections (HTTPS), secure authentication, and access controls. No method of transmission over the internet is 100% secure, but we take reasonable steps to protect your information.</p>
      </Section>

      <Section title="9. Changes to This Policy">
        <p>We may update this policy from time to time. Material changes will be communicated via email or a notice on the website. Continued use of the website after changes constitutes acceptance of the updated policy.</p>
      </Section>

      <div className="mt-10 border-t border-gold-600/20 pt-8 text-xs text-ivory-dim">
        Questions about this policy? <Link href="/pages/contact" className="text-gold-400 hover:underline">Contact us</Link>.
      </div>
    </div>
  );
}
