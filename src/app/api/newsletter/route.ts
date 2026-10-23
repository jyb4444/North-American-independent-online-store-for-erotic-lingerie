import { NextResponse } from 'next/server';

/**
 * Newsletter signup has been retired. Keep an explicit response at the old endpoint so
 * stale clients do not mistake a generic 404 page for a transient delivery failure.
 * Confirmation and unsubscribe routes remain available for links already sent.
 */
export async function POST() {
  return NextResponse.json(
    { error: 'Email subscriptions are no longer available.' },
    { status: 410 },
  );
}
