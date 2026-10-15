import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { updateReturnTracking } from '@/lib/returns';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const request = await updateReturnTracking({
      userId: user.id,
      returnRequestId: id,
      carrier: body.carrier,
      trackingNumber: body.trackingNumber,
      trackingUrl: body.trackingUrl,
    });

    return NextResponse.json({ request });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not update return tracking' },
      { status: 400 }
    );
  }
}
