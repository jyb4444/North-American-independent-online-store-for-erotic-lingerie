import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { processReferralWork } from '@/lib/referral-rewards';
export const runtime='nodejs';
export const maxDuration=300;
export async function GET(req:Request) {
  const expected=process.env.CRON_SECRET;
  const provided=req.headers.get('authorization')?.replace(/^Bearer\s+/i,'') ?? '';
  const a=Buffer.from(provided);const b=Buffer.from(expected ?? '');
  if(!expected || a.length!==b.length || !crypto.timingSafeEqual(a,b)) return NextResponse.json({error:'Unauthorized'},{status:401});
  try { return NextResponse.json(await processReferralWork()); }
  catch { return NextResponse.json({error:'Referral work unavailable; leases will expire safely'},{status:503}); }
}
