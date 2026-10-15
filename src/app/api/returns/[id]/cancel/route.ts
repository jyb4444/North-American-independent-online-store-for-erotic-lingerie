import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cancelReturnRequest } from '@/lib/returns';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const request = await cancelReturnRequest({
      userId: user.id,
      returnRequestId: id,
    });

    return NextResponse.json({ request });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not cancel return request' },
      { status: 400 }
    );
  }
}
