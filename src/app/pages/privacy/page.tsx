import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How Velour collects, uses, and protects your personal information.',
};

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
      <p className="mb-10 text-xs text-ivory-dim">Last updated: June 2026</p>

      <Section title="1. Who We Are">
        <p>Velour (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) operates this website. We are committed to protecting your privacy with particular care given the personal nature of the products we sell. This policy explains what data we collect, how we use it, and your rights.</p>
        <p>Contact: <a href="/pages/contact" className="text-gold-400 hover:underline">Contact us</a> or email us directly via the contact form.</p>
      </Section>

      <Section title="2. Information We Collect">
        <p><strong className="text-ivory">Account information:</strong> When you register, we collect your name and email address. This information is stored securely in our database.</p>
        <p><strong className="text-ivory">Wishlist data:</strong> Items you save to your wishlist are stored in our database linked to your account.</p>
        <p><strong className="text-ivory">Address information:</strong> If you provide a shipping address, it is stored in our database.</p>
        <p><strong className="text-ivory">Browser-only data (never uploaded):</strong> Your fit profile measurements, AI preview images, and saved AI looks are stored exclusively in your browser&rsquo;s local storage. This data never leaves your device unless you explicitly choose to share it.</p>
        <p><strong className="text-ivory">Usage analytics:</strong> We use PostHog to collect anonymised usage data (pages visited, features used). This data does not include your measurements, wishlist product titles, or AI images. You may opt out via our cookie preferences.</p>
        <p><strong className="text-ivory">Payment data:</strong> Payments are processed by our payment provider. We do not store card numbers or full payment details on our servers.</p>
      </Section>

      <Section title="3. How We Use Your Information">
        <p>We use your information to: fulfil your orders and communicate order status; provide customer support; send transactional emails (order confirmation, shipping updates, back-in-stock alerts you have requested); improve the website and your shopping experience.</p>
        <p>We do not sell, rent, or trade your personal information to third parties for marketing purposes.</p>
      </Section>

      <Section title="4. Discreet Billing">
        <p>All charges on your bank or credit card statement appear as <strong className="text-ivory">VLR APPAREL</strong> — never as &ldquo;Velour,&rdquo; &ldquo;intimate apparel,&rdquo; or any description that reveals the nature of your purchase. Packaging is similarly discreet.</p>
      </Section>

      <Section title="5. AI Preview Privacy">
        <p>Our AI Preview feature generates images based on your fit profile description. These images are generated on-demand and returned directly to your browser. They are not stored on our servers, not shared with third parties, and not used to train any AI model. The images persist only in your browser&rsquo;s local storage until you clear them.</p>
      </Section>

      <Section title="6. Cookies and Tracking">
        <p>We use essential cookies to maintain your session. We use analytics cookies (PostHog) only with your consent. You can manage your preferences at any time via the cookie settings at the bottom of any page. Declining analytics cookies does not affect your ability to use the website.</p>
      </Section>

      <Section title="7. Data Retention">
        <p>Account data is retained for as long as your account is active. You may request deletion of your account and all associated data by contacting us. Browser-local data (fit profile, AI looks) can be deleted directly in your browser settings at any time.</p>
      </Section>

      <Section title="8. Your Rights">
        <p>Depending on your location, you may have the right to: access the personal data we hold about you; correct inaccurate data; request deletion of your data; object to processing; data portability. To exercise any of these rights, please <Link href="/pages/contact" className="text-gold-400 hover:underline">contact us</Link>.</p>
      </Section>

      <Section title="9. Security">
        <p>We use industry-standard measures to protect your data, including encrypted connections (HTTPS), secure authentication, and access controls. No method of transmission over the internet is 100% secure, but we take reasonable steps to protect your information.</p>
      </Section>

      <Section title="10. Changes to This Policy">
        <p>We may update this policy from time to time. Material changes will be communicated via email or a notice on the website. Continued use of the website after changes constitutes acceptance of the updated policy.</p>
      </Section>

      <div className="mt-10 border-t border-gold-600/20 pt-8 text-xs text-ivory-dim">
        Questions about this policy? <Link href="/pages/contact" className="text-gold-400 hover:underline">Contact us</Link>.
      </div>
    </div>
  );
}
