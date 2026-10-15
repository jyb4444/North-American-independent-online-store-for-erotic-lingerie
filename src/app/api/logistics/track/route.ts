import { NextResponse } from 'next/server';
import { getClientIp, rateLimit } from '@/lib/rate-limit';
import { lookupOrder } from '@/lib/logistics';

function publicOrder(order: Awaited<ReturnType<typeof lookupOrder>>) {
  if (!order) return null;
  return {
    orderNumber: order.shopify_order_number,
    fulfillmentStatus: order.fulfillment_status,
    processedAt: order.processed_at,
    createdAt: order.created_at,
    shipments: order.shipments.map((shipment) => ({
      carrier: shipment.carrier,
      trackingNumber: shipment.tracking_number,
      trackingUrl: shipment.tracking_url,
      status: shipment.status,
      estimatedDeliveryAt: shipment.estimated_delivery_at,
      shippedAt: shipment.shipped_at,
      deliveredAt: shipment.delivered_at,
      events: shipment.shipment_events.map((event) => ({
        id: event.id,
        status: event.status,
        title: event.title,
        description: event.description,
        location: event.location,
        occurredAt: event.occurred_at,
      })),
    })),
  };
}

export async function POST(req: Request) {
  const { allowed } = await rateLimit(`track:${getClientIp(req)}`, { limit: 12, windowMs: 60 * 60_000 });
  if (!allowed) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });

  let body: { token?: string; orderNumber?: string; email?: string; phone?: string };
  try {
    body = await req.json() as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const order = await lookupOrder(body);
  if (!order) return NextResponse.json({ error: 'No order found for those details.' }, { status: 404 });

  return NextResponse.json({ order: publicOrder(order) });
}
