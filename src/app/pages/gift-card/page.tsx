import { Gift } from 'lucide-react';
import { getGiftCardProduct } from '@/lib/shopify/gift-card';
import GiftCardForm from './GiftCardForm';

export const dynamic = 'force-dynamic';

export default async function GiftCardPage() {
  const product = await getGiftCardProduct();

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      {/* Header */}
      <div className="mb-12 text-center">
        <Gift size={32} className="mx-auto mb-4 text-gold-400/60" />
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.3em] text-gold-400">Send a Gift</p>
        <h1 className="font-serif text-4xl font-light text-ivory">Self Love Gift Card</h1>
        <p className="mt-3 text-sm text-ivory-muted">
          A thoughtful way to gift luxury intimate apparel.
          Delivered discreetly by email.
        </p>
      </div>

      {product ? (
        <GiftCardForm denominations={product.denominations} />
      ) : (
        <p className="border border-gold-600/20 bg-wine-900 px-6 py-8 text-center text-sm text-ivory-muted">
          Gift cards are not available right now. Please check back soon.
        </p>
      )}
    </div>
  );
}
