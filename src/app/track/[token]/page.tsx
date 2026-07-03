import TrackingLookup from '@/components/logistics/TrackingLookup';
import type { PublicTrackingOrder } from '@/components/logistics/TrackingLookup';
import { lookupOrder } from '@/lib/logistics';

function publicOrder(order: Awaited<ReturnType<typeof lookupOrder>>): PublicTrackingOrder | null {
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
        status: event.status,
        title: event.title,
        description: event.description,
        location: event.location,
        occurredAt: event.occurred_at,
      })),
    })),
  };
}

type TokenTrackPageProps = {
  params: Promise<{ token: string }>;
};

export default async function TokenTrackPage({ params }: TokenTrackPageProps) {
  const { token } = await params;
  const order = publicOrder(await lookupOrder({ token }));
  return (
    <TrackingLookup
      initialOrder={order}
      initialError={order ? '' : 'No order found for this private tracking link.'}
    />
  );
}
