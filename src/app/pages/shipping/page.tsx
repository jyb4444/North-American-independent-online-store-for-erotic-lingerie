export default function ShippingPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <p className="mb-2 text-xs font-medium uppercase tracking-[0.3em] text-gold-400">Help</p>
      <h1 className="font-serif text-4xl font-light text-ivory">Shipping & Fulfillment</h1>
      <div className="mx-auto mt-4 mb-10 h-px w-12 bg-gold-400/40" />

      <div className="space-y-8 text-sm text-ivory-muted leading-relaxed">
        <section>
          <h2 className="mb-3 font-serif text-xl font-light text-ivory">Checkout</h2>
          <p>Checkout is securely processed by Shopify. Available shipping methods, delivery estimates, taxes, and the final order total are shown before you place the order.</p>
        </section>

        <section>
          <h2 className="mb-3 font-serif text-xl font-light text-ivory">Order Updates</h2>
          <p>After checkout, use Order History in your account to review orders associated with your confirmed account email. Tracking appears after the order ships.</p>
        </section>

        <section>
          <h2 className="mb-3 font-serif text-xl font-light text-ivory">Discreet Delivery</h2>
          <p>Packages use discreet exterior packaging. Product names are not printed on the outside of the parcel.</p>
        </section>

        <section>
          <h2 className="mb-3 font-serif text-xl font-light text-ivory">Questions</h2>
          <p>Shipping availability and timing depend on the destination and items in the order. The options shown at checkout are authoritative. Contact support with your order number if you need help after ordering.</p>
        </section>
      </div>
    </div>
  );
}
