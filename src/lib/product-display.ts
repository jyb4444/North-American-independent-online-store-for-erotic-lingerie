import type { CartItem, Product } from '@/types';

export const PRODUCT_IMAGE_FALLBACK = '/logo.png';

export function productImage(product: Pick<Product, 'images'>, index = 0) {
  return product.images[index] || product.images[0] || PRODUCT_IMAGE_FALLBACK;
}

export function productImageAlt(product: Pick<Product, 'title' | 'imageAltTexts'>, index = 0) {
  return product.imageAltTexts?.[index]?.trim() || `${product.title} product image`;
}

export function formatMoney(amount: number, currency = 'USD') {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  } catch {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  }
}

export function cartTotalsByCurrency(items: Pick<CartItem, 'currency' | 'price' | 'quantity'>[]) {
  return items.reduce<Record<string, number>>((totals, item) => {
    const currency = item.currency ?? 'USD';
    totals[currency] = (totals[currency] ?? 0) + item.price * item.quantity;
    return totals;
  }, {});
}
