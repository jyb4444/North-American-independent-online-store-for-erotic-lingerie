import { NextResponse } from 'next/server';
import { getClientIp, rateLimit } from '@/lib/rate-limit';
import { CartError, createShopifyCart } from '@/lib/shopify/cart';
import {
  GIFT_CARD_MESSAGE_MAX,
  GIFT_CARD_NAME_MAX,
  getGiftCardProduct,
  giftCardRecipientAttributes,
} from '@/lib/shopify/gift-card';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim() : '';
}

// POST: start a Shopify checkout for one gift card. Payment, code issuance and the
// recipient email are all handled by Shopify.
export async function POST(req: Request) {
  const { allowed } = await rateLimit(`gift-card-checkout:${getClientIp(req)}`, { limit: 10, windowMs: 60 * 60_000 });
  if (!allowed) return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });

  let body: { variantId?: unknown; sendToRecipient?: unknown; recipientEmail?: unknown; recipientName?: unknown; message?: unknown };
  try {
    body = await req.json() as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const product = await getGiftCardProduct();
  if (!product) return NextResponse.json({ error: 'Gift cards are not available right now.' }, { status: 503 });

  const denomination = product.denominations.find((option) => option.variantId === body.variantId);
  if (!denomination) return NextResponse.json({ error: 'Please choose a gift card amount.' }, { status: 400 });

  let attributes;
  if (body.sendToRecipient === true) {
    const email = cleanText(body.recipientEmail);
    const name = cleanText(body.recipientName);
    const message = cleanText(body.message);
    if (!EMAIL_PATTERN.test(email) || email.length > 254) {
      return NextResponse.json({ error: 'Please enter a valid recipient email.' }, { status: 400 });
    }
    if (name.length > GIFT_CARD_NAME_MAX) {
      return NextResponse.json({ error: 'Recipient name is too long.' }, { status: 400 });
    }
    if (message.length > GIFT_CARD_MESSAGE_MAX) {
      return NextResponse.json({ error: `Message must be ${GIFT_CARD_MESSAGE_MAX} characters or fewer.` }, { status: 400 });
    }
    attributes = giftCardRecipientAttributes({ email, name, message });
  }

  try {
    const cart = await createShopifyCart({
      lines: [{ merchandiseId: denomination.variantId, quantity: 1, ...(attributes ? { attributes } : {}) }],
    });
    return NextResponse.json({ checkoutUrl: cart.checkoutUrl });
  } catch (error) {
    if (error instanceof CartError) return NextResponse.json({ error: error.message }, { status: 422 });
    console.error('Gift card checkout failed:', error);
    return NextResponse.json({ error: 'Could not start checkout. Please try again.' }, { status: 500 });
  }
}
