import Link from 'next/link';
import { publicPageMetadata } from '@/lib/seo';

export const metadata = publicPageMetadata({
  title: 'Terms of Service',
  description: 'Terms and conditions governing use of the Self Love website and services.',
  path: '/pages/terms',
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 font-serif text-xl font-light text-ivory">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-ivory-muted">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <p className="mb-2 text-xs font-medium uppercase tracking-[0.3em] text-gold-400">Legal</p>
      <h1 className="font-serif text-4xl font-light text-ivory">Terms of Service</h1>
      <div className="mx-auto mt-4 mb-3 h-px w-12 bg-gold-400/40" />
      <p className="mb-10 text-xs text-ivory-dim">Last updated: October 2026</p>

      <Section title="1. Acceptance of Terms">
        <p>By accessing or using the Self Love website (&ldquo;Site&rdquo;), you agree to be bound by these Terms of Service (&ldquo;Terms&rdquo;). If you do not agree to these Terms, please do not use the Site. These Terms apply to all visitors, users, and customers.</p>
      </Section>

      <Section title="2. Age Requirement">
        <p>You must be at least 18 years of age to use this Site or purchase any products. By using this Site, you represent and warrant that you are at least 18 years old. We reserve the right to terminate accounts and refuse service if we have reason to believe this requirement has not been met.</p>
      </Section>

      <Section title="3. Products and Availability">
        <p>All product descriptions, images, and prices are accurate to the best of our knowledge and are subject to change without notice. We reserve the right to limit quantities, discontinue products, or refuse orders at our sole discretion.</p>
        <p>Colours may appear slightly different due to monitor calibration. Size measurements are approximate and may vary by 1–3 cm.</p>
      </Section>

      <Section title="4. Ordering and Payment">
        <p>By placing an order, you agree to pay the listed price plus applicable taxes and shipping fees. All transactions are processed in USD unless otherwise stated. Charges appear discreetly on your statement.</p>
        <p>We reserve the right to cancel any order due to pricing errors, suspected fraud, or stock unavailability. In such cases, a full refund will be issued promptly.</p>
      </Section>

      <Section title="5. Returns and Exchanges">
        <p>Unopened eligible items may be submitted for review within 30 days with their tags, packaging, and accessories intact. Underwear, panties, thongs, and other bottom intimate items are final sale for hygiene reasons. Used, tried-on, washed, stained, altered, gift-card, and Final Sale items are not returnable. Customer-damaged hosiery is not returnable.</p>
        <p>Start a request from <Link href="/orders" className="text-gold-400 hover:underline">Order History</Link>. Defects, wrong or missing items, transit damage, and privacy-packaging issues require review and may require photos. Do not ship an item before approval. Approved instructions and responsibility for shipping costs are provided by email based on the reason for the return.</p>
      </Section>

      <Section title="6. Privacy">
        <p>Your privacy is important to us. Please review our <Link href="/pages/privacy" className="text-gold-400 hover:underline">Privacy Policy</Link>, which is incorporated into these Terms by reference. We take special care with data privacy given the personal nature of our products.</p>
      </Section>

      <Section title="7. Intellectual Property">
        <p>All content on this Site — including images, text, logos, and software — is owned by Self Love or its licensors and is protected by copyright and other intellectual property laws. You may not reproduce, distribute, or create derivative works without our express written permission.</p>
      </Section>

      <Section title="8. User Accounts">
        <p>You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. Please notify us immediately of any unauthorised use. We reserve the right to suspend or terminate accounts that violate these Terms.</p>
      </Section>

      <Section title="9. Disclaimer of Warranties">
        <p>The Site and its contents are provided &ldquo;as is&rdquo; without warranty of any kind, either express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, or non-infringement.</p>
      </Section>

      <Section title="10. Limitation of Liability">
        <p>To the maximum extent permitted by law, Self Love shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Site or products purchased through it.</p>
      </Section>

      <Section title="11. Governing Law">
        <p>These Terms are governed by and construed in accordance with applicable law. Any disputes shall be resolved through good-faith negotiation first, then binding arbitration if necessary.</p>
      </Section>

      <Section title="12. Changes to These Terms">
        <p>We reserve the right to modify these Terms at any time. Changes will be posted on this page with an updated date. Continued use of the Site after changes constitutes acceptance of the new Terms.</p>
      </Section>

      <div className="mt-10 border-t border-gold-600/20 pt-8 text-xs text-ivory-dim">
        Questions about these Terms? <Link href="/pages/contact" className="text-gold-400 hover:underline">Contact us</Link>.
      </div>
    </div>
  );
}
