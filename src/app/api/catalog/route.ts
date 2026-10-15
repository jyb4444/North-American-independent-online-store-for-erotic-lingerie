import { NextResponse } from 'next/server';
import { getAllProducts } from '@/lib/products';

// The storefront catalogue for client-side features (search, bag recommendations, recently
// viewed, wishlist). Comes from Shopify when configured, otherwise the built-in catalogue.
export async function GET() {
  const products = await getAllProducts();
  return NextResponse.json(
    { products },
    { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } },
  );
}
