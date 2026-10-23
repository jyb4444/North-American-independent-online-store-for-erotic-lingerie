import { createAdminClient } from '@/lib/supabase/server';
import { sendReferralRewardEmail } from '@/lib/email';
import { RewardBlocked, requireRewardScopes, verifiedCustomer, firstPaidOrder, ensureRewardDiscount } from '@/lib/referral-shopify';
export { referralRewardSettings, referralRewardsEnabled } from '@/lib/referral-config';
import { referralRewardSettings, referralRewardsEnabled } from '@/lib/referral-config';

export type ReferralRewardKind = 'welcome' | 'referrer';
export function missingRewardSchema(error: { code?: string; message?: string } | null) {
  return !!error && ['PGRST202','PGRST205','42P01','42883'].includes(error.code ?? '');
}
export async function issueReferralReward(input: { userId: string; email: string; kind: ReferralRewardKind; referredUserId: string }) {
  if (!referralRewardsEnabled()) return;
  if (input.kind!=='welcome' || input.userId!==input.referredUserId) throw new Error('Referrer rewards require verified payment claim');
  const settings = referralRewardSettings();
  const { error } = await createAdminClient().rpc('queue_referral_welcome', { p_user_id: input.userId, p_amount: settings.amount, p_minimum: settings.minimumSubtotal });
  if (error && !(missingRewardSchema(error) && !referralRewardsEnabled())) throw new Error('Welcome reward queue unavailable');
}
/** A persisted paid event proves order synchronization already completed on its first delivery. */
export async function knownReferralPayment(eventId: string, shop: string, hash: string) {
  if (!referralRewardsEnabled()) return false;
  const {data,error}=await createAdminClient().from('referral_webhook_events').select('body_hash,shop_domain').eq('event_id',eventId).maybeSingle();
  if(missingRewardSchema(error) && !referralRewardsEnabled()) return false;
  if(error) throw new Error('Payment deduplication unavailable');
  if(data && (data.body_hash!==hash || data.shop_domain!==shop)) throw new Error('Payment event identity conflict');
  return !!data;
}
export async function recordReferralPayment(input: { eventId: string; shop: string; hash: string; orderId: string; userId: string }) {
  if (!referralRewardsEnabled()) return;
  const db=createAdminClient();
  const { error }=await db.from('referral_webhook_events').upsert({ event_id:input.eventId,shop_domain:input.shop,body_hash:input.hash,order_id:input.orderId,user_id:input.userId },{onConflict:'event_id',ignoreDuplicates:true});
  if (missingRewardSchema(error) && !referralRewardsEnabled()) return;
  if (error) throw new Error('Payment event could not be persisted');
  const {data,error:readError}=await db.from('referral_webhook_events').select('body_hash,shop_domain,order_id').eq('event_id',input.eventId).single();
  if (readError || data.body_hash!==input.hash || data.shop_domain!==input.shop || data.order_id!==input.orderId) throw new Error('Payment event identity conflict');
}
type EventWork={event_id:string;order_id:string;user_id:string|null;attempts:number;lease_token:string};
type RewardWork={id:string;user_id:string;referred_user_id:string;recipient_email:string|null;kind:ReferralRewardKind;code:string;amount:number;minimum_subtotal:number;status:string;qualifying_order_id:string|null;qualifying_customer_id:string|null;qualifying_paid_at:string|null;attempts:number;email_attempts:number;lease_token:string;shopify_customer_id:string|null};
export function retryAt(attempt: number, now=Date.now()) { return new Date(now+Math.min(24*60*60,60*2**Math.min(attempt-1,10))*1000).toISOString(); }
async function confirmedUser(id:string) {
  const {data,error}=await createAdminClient().auth.admin.getUserById(id);
  if(error || !data.user?.email || !data.user.email_confirmed_at) throw new RewardBlocked('Confirmed recipient identity unavailable');
  return data.user;
}
async function updateLeased(table:string,idColumn:string,id:string,lease:string,values:Record<string,unknown>) {
  const {data,error}=await createAdminClient().from(table).update(values).eq(idColumn,id).eq('lease_token',lease).gt('lease_until',new Date().toISOString()).select(idColumn).single();
  if(error || !data) throw new Error('Work lease or database write failed');
}
export async function processReferralWork() {
  if(!referralRewardsEnabled()) return {enabled:false,events:0,rewards:0};
  const db=createAdminClient();
  const settings=referralRewardSettings();
  const {data:events,error:eventError}=await db.rpc('lease_referral_events',{p_limit:1});
  if(eventError) throw new Error('Referral event schema unavailable');
  for(const event of (events ?? []) as EventWork[]) {
    try {
      if(!event.user_id) throw new RewardBlocked('Referred account no longer exists',true);
      const user=await confirmedUser(event.user_id);
      const evidence=await firstPaidOrder(user.email!,event.order_id);
      const {error}=await db.rpc('claim_referral_paid_order',{p_user_id:event.user_id,p_order_id:event.order_id,p_paid_at:evidence.paidAt,p_customer_id:evidence.identity.id,p_amount:settings.amount,p_minimum:settings.minimumSubtotal});
      if(error) throw new Error('Atomic reward claim failed');
      await updateLeased('referral_webhook_events','event_id',event.event_id,event.lease_token,{status:'complete',last_error:null,lease_token:null,lease_until:null});
    } catch(error) {
      await updateLeased('referral_webhook_events','event_id',event.event_id,event.lease_token,{status:error instanceof RewardBlocked && error.manual ? 'manual_review' : 'pending',last_error:(error instanceof RewardBlocked ? error.message : 'Payment verification failed; safe retry required')+(event.attempts>=8 ? '; retry budget exhausted; manual retry required':''),next_attempt_at:retryAt(event.attempts),lease_token:null,lease_until:null});
    }
  }
  const {data:rewards,error:rewardError}=await db.rpc('lease_referral_rewards',{p_limit:1});
  if(rewardError) throw new Error('Referral reward schema unavailable');
  for(const reward of (rewards ?? []) as RewardWork[]) {
    try {
      const user=await confirmedUser(reward.user_id);
      if(reward.status==='issued') {
        if(!reward.recipient_email || reward.recipient_email.toLowerCase()!==user.email!.toLowerCase()) throw new RewardBlocked('Recipient email changed; manual email reconciliation required',true);
        const sent=await sendReferralRewardEmail({to:reward.recipient_email,code:reward.code,amount:Number(reward.amount),minimumSubtotal:Number(reward.minimum_subtotal),kind:reward.kind,idempotencyKey:`referral-email/${reward.id}`});
        await updateLeased('referral_rewards','id',reward.id,reward.lease_token,{email_status:'sent',email_provider_id:sent.id,email_sent_at:new Date().toISOString(),lease_token:null,lease_until:null,last_error:null});
      } else {
        if(reward.recipient_email && reward.recipient_email.toLowerCase()!==user.email!.toLowerCase()) throw new RewardBlocked('Recipient identity changed; manual reconciliation required',true);
        if(!reward.recipient_email) await updateLeased('referral_rewards','id',reward.id,reward.lease_token,{recipient_email:user.email});
        await requireRewardScopes();
        const customer=await verifiedCustomer(user.email!);
        if(reward.kind==='referrer' && (!reward.qualifying_order_id || !reward.qualifying_customer_id || !reward.qualifying_paid_at)) throw new RewardBlocked('Verified first payment evidence missing; manual reconciliation required',true);
        if(reward.qualifying_order_id) {
          const referred=await confirmedUser(reward.referred_user_id);
          const evidence=await firstPaidOrder(referred.email!,reward.qualifying_order_id);
          if(evidence.identity.id!==reward.qualifying_customer_id || Date.parse(evidence.paidAt)!==Date.parse(reward.qualifying_paid_at ?? '')) throw new RewardBlocked('Qualifying payment identity changed; manual reconciliation required',true);
        }
        const discountId=await ensureRewardDiscount({code:reward.code,title:`Referral ${reward.kind} reward ${reward.code}`,customerId:customer.id,amount:Number(reward.amount),minimumSubtotal:Number(reward.minimum_subtotal)});
        const {data,error}=await db.rpc('finish_referral_discount',{p_id:reward.id,p_lease:reward.lease_token,p_discount_id:discountId,p_customer_id:customer.id});
        if(error || data!==true) throw new Error('Discount completion write failed');
      }
    } catch(error) {
      const manual=error instanceof RewardBlocked && error.manual;
      await updateLeased('referral_rewards','id',reward.id,reward.lease_token,{
        ...(reward.status==='issued' ? {email_status:manual || reward.email_attempts>=8 ? 'manual_review':'failed'} : {status:manual ? 'manual_review':'pending'}),
        last_error:(error instanceof RewardBlocked ? error.message : reward.status==='issued' ? 'Email delivery failed; retry same discount':'Discount processing failed; retry same code')+(reward.attempts>=8 ? '; retry budget exhausted; manual retry required':''),
        next_attempt_at:retryAt(reward.status==='issued' ? reward.email_attempts:reward.attempts),lease_token:null,lease_until:null,
      });
    }
  }
  return {enabled:true,events:(events ?? []).length,rewards:(rewards ?? []).length};
}
