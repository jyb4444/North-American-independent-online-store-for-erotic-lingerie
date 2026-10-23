import { NextResponse } from 'next/server';

/** AI previews are retired; returning 410 prevents stale clients from incurring inference cost. */
export async function POST() {
  return NextResponse.json({ error: 'AI previews are no longer available.' }, { status: 410 });
}
