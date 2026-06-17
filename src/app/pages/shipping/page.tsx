export default function ShippingPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <p className="mb-2 text-xs font-medium uppercase tracking-[0.3em] text-gold-400">Help</p>
      <h1 className="font-serif text-4xl font-light text-ivory">Fulfillment Info</h1>
      <div className="mx-auto mt-4 mb-10 h-px w-12 bg-gold-400/40" />

      <div className="space-y-8 text-sm text-ivory-muted leading-relaxed">
        <section>
          <h2 className="mb-3 font-serif text-xl font-light text-ivory">Ordering Status</h2>
          <p>Checkout and fulfillment are still being prepared. Current shopping tools are for browsing, fit guidance, private wishlist, and saved AI looks.</p>
        </section>

        <section>
          <h2 className="mb-3 font-serif text-xl font-light text-ivory">What You Can Do Now</h2>
          <p>Save styles privately, compare fit guidance, and keep AI previews on this browser when you choose to save them.</p>
        </section>

        <section>
          <h2 className="mb-3 font-serif text-xl font-light text-ivory">Privacy</h2>
          <p>Your wishlist and fit guidance are private shopping tools. Fulfillment details will be published when checkout is ready.</p>
        </section>

        <section>
          <h2 className="mb-3 font-serif text-xl font-light text-ivory">Updates</h2>
          <p>Fulfillment regions, timing, and delivery options will be listed here before ordering is enabled.</p>
        </section>
      </div>
    </div>
  );
}
