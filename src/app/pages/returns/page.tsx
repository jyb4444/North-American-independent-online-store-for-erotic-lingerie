export default function ReturnsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <p className="mb-2 text-xs font-medium uppercase tracking-[0.3em] text-gold-400">Help</p>
      <h1 className="font-serif text-4xl font-light text-ivory">Returns & Exchanges</h1>
      <div className="mx-auto mt-4 mb-10 h-px w-12 bg-gold-400/40" />

      <div className="space-y-8 text-sm text-ivory-muted leading-relaxed">
        <section className="border border-gold-600/20 bg-wine-900 px-5 py-4">
          <p className="text-xs font-medium uppercase tracking-widest text-gold-400 mb-1">Policy Preview</p>
          <p>Checkout is not live yet. Return and exchange terms will be finalized before ordering is enabled.</p>
        </section>

        <section>
          <h2 className="mb-3 font-serif text-xl font-light text-ivory">Eligible Items</h2>
          <ul className="space-y-2">
            {['Items in original, unworn condition', 'Tags still attached', 'No signs of wear, perfume, or makeup'].map((item) => (
              <li key={item} className="flex items-start gap-2 text-xs">
                <span className="text-gold-400 flex-shrink-0">✦</span>{item}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="mb-3 font-serif text-xl font-light text-ivory">Non-Returnable Items</h2>
          <ul className="space-y-2">
            {['Intimates and hosiery (hygiene reasons)', 'Sale items marked "Final Sale"', 'Gift cards'].map((item) => (
              <li key={item} className="flex items-start gap-2 text-xs">
                <span className="text-crimson-400 flex-shrink-0">✕</span>{item}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="mb-3 font-serif text-xl font-light text-ivory">How to Return</h2>
          <ol className="space-y-3 text-xs">
            {[
              'Log into your account once ordering is available',
              'Open your order details',
              'Follow the return instructions published with checkout',
              'Contact support if you need help with eligibility',
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="flex-shrink-0 font-serif text-base text-gold-400">{i + 1}.</span>
                {step}
              </li>
            ))}
          </ol>
        </section>

        <section>
          <h2 className="mb-3 font-serif text-xl font-light text-ivory">Refund Method</h2>
          <p>Refund methods and timing will be listed before payment is enabled.</p>
        </section>
      </div>
    </div>
  );
}
