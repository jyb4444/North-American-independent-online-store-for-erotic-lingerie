'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const FAQS = [
  {
    q: 'How do I choose the right size?',
    a: 'Use our Size Guide (available on each product page) to compare your measurements. If you are between sizes, we recommend sizing up for a more comfortable fit. Our Free Size items fit approximately XS–M.',
  },
  {
    q: 'Is my browsing private?',
    a: 'Your wishlist, fit guidance, and saved AI looks are designed as private shopping tools. AI looks stay on this browser unless you choose otherwise.',
  },
  {
    q: 'When will ordering be available?',
    a: 'Checkout and fulfillment details are still being prepared. For now, you can browse, compare fit guidance, and save styles privately.',
  },
  {
    q: 'Can I return or exchange an item?',
    a: 'We accept returns within 30 days for unworn items with tags attached. Intimates and hosiery are non-returnable for hygiene reasons. See our full Returns policy for details.',
  },
  {
    q: 'Is checkout available?',
    a: 'Checkout is not live yet. Payment options will be shown clearly once ordering is available.',
  },
  {
    q: 'How does the Velour Membership work?',
    a: 'Membership currently helps organize your private account, wishlist, and style setup. Purchase-based rewards will be defined only after ordering is live.',
  },
  {
    q: 'What will appear on my bank statement?',
    a: 'All charges appear as VLR APPAREL — never as "Velour," "intimate apparel," or any description that reveals the nature of your purchase. Packaging is similarly discreet with no brand markings on the outside.',
  },
  {
    q: 'My size is out of stock — will it come back?',
    a: 'Popular styles are restocked regularly. Use the "Notify me" button on any out-of-stock size to receive a private email when it returns. You can also save it to your wishlist to keep it in view.',
  },
  {
    q: 'How do I care for my items?',
    a: 'Most items should be hand washed in cold water and laid flat to dry. Avoid wringing, bleach, or high heat. Specific care instructions are listed on each product page and on the garment tag.',
  },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gold-600/15">
      <button onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between py-4 text-left">
        <span className="text-sm font-light text-ivory pr-4">{q}</span>
        <ChevronDown size={15} className={`flex-shrink-0 text-gold-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <p className="pb-4 text-sm text-ivory-muted leading-relaxed">{a}</p>}
    </div>
  );
}

export default function FAQPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <p className="mb-2 text-xs font-medium uppercase tracking-[0.3em] text-gold-400">Help</p>
      <h1 className="font-serif text-4xl font-light text-ivory">FAQ</h1>
      <div className="mx-auto mt-4 mb-10 h-px w-12 bg-gold-400/40" />
      <div className="divide-y-0">
        {FAQS.map((item) => <FAQItem key={item.q} {...item} />)}
      </div>

      <div className="mt-10 border border-gold-600/20 bg-wine-900 px-6 py-6 text-center">
        <p className="text-sm text-ivory-muted">Still have questions?</p>
        <a
          href="/pages/contact"
          className="mt-3 inline-block border border-gold-400 px-6 py-2.5 text-xs font-medium uppercase tracking-widest text-gold-400 transition hover:bg-gold-400 hover:text-wine-950"
        >
          Contact Us →
        </a>
      </div>
    </div>
  );
}
