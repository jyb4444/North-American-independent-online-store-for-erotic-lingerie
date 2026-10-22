import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verifyRecoveryProof } from '@/lib/password-recovery';

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const body = await request.json().catch(() => null) as {password?:unknown}|null;
  if (typeof body?.password !== 'string' || body.password.length < 8 || body.password.length > 128) return NextResponse.json({error:'Password must be between 8 and 128 characters.'},{status:400});
  const supabase = await createClient();
  const {data:{user}} = await supabase.auth.getUser();
  if (!user) return NextResponse.json({error:'This reset link is invalid or expired.'},{status:403});
  let authorized = false;
  try { authorized = verifyRecoveryProof(cookieStore.get('password_recovery_authorized')?.value, user.id); } catch { /* fail closed when the server secret is absent */ }
  if (!authorized) return NextResponse.json({error:'This reset link is invalid or expired.'},{status:403});
  const {error} = await supabase.auth.updateUser({password:body.password});
  if(error)return NextResponse.json({error:error.message},{status:400});
  cookieStore.delete('password_recovery_authorized');
  return NextResponse.json({ok:true});
}
