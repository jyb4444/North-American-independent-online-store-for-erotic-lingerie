import Link from 'next/link';
import { AlertTriangle, CheckCircle2, PackageOpen, RotateCcw, ShieldCheck, Truck } from 'lucide-react';

const ELIGIBLE = [
  'Unopened eligible items with all tags, packaging, and accessories intact',
  'Wrong item, missing item, verified defect, or transit damage claims with photos',
  'Orders that have not shipped yet, which can be reviewed for cancellation',
];

const FINAL_SALE = [
  'Underwear, panties, thongs, and bottom intimate items for hygiene reasons',
  'Used, tried-on, washed, perfumed, stained, or altered items',
  'Customer-damaged hosiery, stockings, tights, or pantyhose, even when tags remain attached',
  'Gift cards and items marked Final Sale',
];

export default function ReturnsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <p className="mb-2 text-xs font-medium uppercase tracking-[0.3em] text-gold-400">Help</p>
      <h1 className="font-serif text-4xl font-light text-ivory">Returns & Exchanges</h1>
      <div className="mx-auto mt-4 mb-10 h-px w-12 bg-gold-400/40" />

      <div className="space-y-8 text-sm leading-relaxed text-ivory-muted">
        <section className="border border-gold-600/20 bg-wine-900 px-5 py-4">
          <div className="mb-3 flex items-center gap-3">
            <ShieldCheck size={18} className="text-gold-400" />
            <h2 className="font-serif text-xl font-light text-ivory">Private Apparel Policy</h2>
          </div>
          <p>
            We review return requests carefully because many items are intimate apparel. Hygiene-restricted items are final sale unless
            the issue is a verified defect, wrong item, missing item, transit damage, or privacy packaging error.
          </p>
        </section>

        <section className="grid gap-5 sm:grid-cols-2">
          <div className="border border-gold-600/20 bg-wine-900 p-5">
            <div className="mb-3 flex items-center gap-2">
              <CheckCircle2 size={17} className="text-gold-400" />
              <h2 className="font-serif text-lg font-light text-ivory">Eligible for Review</h2>
            </div>
            <ul className="space-y-2 text-xs">
              {ELIGIBLE.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="border border-crimson-400/20 bg-wine-900 p-5">
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle size={17} className="text-crimson-300" />
              <h2 className="font-serif text-lg font-light text-ivory">Not Returnable</h2>
            </div>
            <ul className="space-y-2 text-xs">
              {FINAL_SALE.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center gap-2">
            <RotateCcw size={18} className="text-gold-400" />
            <h2 className="font-serif text-xl font-light text-ivory">How Returns Work</h2>
          </div>
          <ol className="space-y-3 text-xs">
            {[
              'Open the order in Order History and choose Request a Return.',
              'Select the item and tell us what happened. Add photos for damage, defects, or a wrong item.',
              'Wait for our review email. Do not ship anything before the request is approved.',
              'If approved, follow the emailed return instructions and send the parcel using a trackable service.',
              'After the item arrives and passes inspection, we process the approved refund or exchange through Shopify.',
            ].map((step, i) => (
              <li key={step} className="flex items-start gap-3">
                <span className="flex-shrink-0 font-serif text-base text-gold-400">{i + 1}.</span>
                {step}
              </li>
            ))}
          </ol>
        </section>

        <section className="grid gap-5 sm:grid-cols-2">
          <div className="border border-gold-600/20 bg-wine-900 p-5">
            <PackageOpen size={18} className="mb-3 text-gold-400" />
            <h2 className="mb-2 font-serif text-lg font-light text-ivory">Timing</h2>
            <p className="text-xs">
              Unopened eligible items can be submitted within 30 days. Shipped but undelivered orders may require carrier intercept
              or refusal, and actual shipping costs may be deducted.
            </p>
          </div>

          <div className="border border-gold-600/20 bg-wine-900 p-5">
            <Truck size={18} className="mb-3 text-gold-400" />
            <h2 className="mb-2 font-serif text-lg font-light text-ivory">Refund Method</h2>
            <p className="text-xs">
              Refunds return to the original payment method only after approval and inspection. Submitting a request does not guarantee
              approval and does not trigger an automatic refund.
            </p>
          </div>
        </section>

        <div className="text-center">
          <Link
            href="/orders"
            className="inline-flex items-center gap-2 border border-gold-400 px-6 py-3 text-xs font-medium uppercase tracking-widest text-gold-400 transition hover:bg-gold-400 hover:text-wine-950"
          >
            <RotateCcw size={15} />
            Manage Orders
          </Link>
        </div>
      </div>
    </div>
  );
}
