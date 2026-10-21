import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {test,expect,type APIRequestContext} from '@playwright/test';
import {admin} from '../helpers/supabase';
import {SEED,USERS,userIdFor} from '../helpers/seed';
import {resetShopifyMock,recordedDiscountCreates,failNextDiscountCreate} from '../helpers/shopify-mock';
import {signShopifyWebhook,pkceCallbackCode,asUser,anon} from '../helpers/supabase';
import {readOutbox,clearOutbox} from '../helpers/outbox';
import {execFileSync} from 'node:child_process';

const customers=[{id:'gid://shopify/Customer/200',email:USERS.bob,verifiedEmail:true}];
let bobId:string;
const ids:string[]=[];
async function fixtures(input:Record<string,unknown>) { await fetch('http://127.0.0.1:3199/__referral-fixtures',{method:'POST',body:JSON.stringify(input)}); }
async function friend() {
 const email=`friend-${crypto.randomUUID()}@test.local`;
 const {data,error}=await admin().auth.admin.createUser({email,password:'Test1234!',email_confirm:true,user_metadata:{referral_code:SEED.bobReferralCode}});
 expect(error).toBeNull();const id=data.user!.id;ids.push(id);
 expect((await admin().rpc('redeem_referral',{p_code:SEED.bobReferralCode,p_user_id:id})).error).toBeNull();
 const customer={id:`gid://shopify/Customer/${Date.now()}`,email,verifiedEmail:true};await fixtures({customers:[...customers,customer]});
 return {id,email,customer};
}
function order(f:Awaited<ReturnType<typeof friend>>,id='gid://shopify/Order/8001',paidAt=new Date().toISOString()) {
 return {id,email:f.email,customer:{id:f.customer.id},cancelledAt:null,displayFinancialStatus:'PAID',totalPriceSet:{shopMoney:{amount:'35.00',currencyCode:'USD'}},transactions:[{kind:'SALE',status:'SUCCESS',processedAt:paidAt,amountSet:{shopMoney:{amount:'35.00',currencyCode:'USD'}}}]};
}
async function webhook(request:APIRequestContext,f:Awaited<ReturnType<typeof friend>>,eventId=crypto.randomUUID()) {
 const body=JSON.stringify({id:8001,order_number:8001,email:f.email,financial_status:'paid',total_price:'35',currency:'USD'});
 return request.post('/api/shopify/webhook',{headers:{'content-type':'application/json','x-shopify-topic':'orders/paid','x-shopify-shop-domain':'e2e-store.myshopify.com','x-shopify-event-id':eventId,'x-shopify-hmac-sha256':signShopifyWebhook(body)},data:Buffer.from(body)});
}
async function tick(request:APIRequestContext) { const r=await request.get('/api/cron/referral-rewards',{headers:{authorization:`Bearer ${process.env.CRON_SECRET}`}});expect(r.status(),await r.text()).toBe(200); }
async function drain(request:APIRequestContext,n=4) {for(let i=0;i<n;i++) await tick(request);}
async function rewards(id:string) {const r=await admin().from('referral_rewards').select('*').eq('user_id',id);expect(r.error).toBeNull();return r.data!;}
async function due() {
 await admin().from('referral_rewards').update({next_attempt_at:new Date(0).toISOString()}).neq('email_status','sent');
 await admin().from('referral_webhook_events').update({next_attempt_at:new Date(0).toISOString()}).in('status',['pending','failed']);
}
async function queueWelcome(f:Awaited<ReturnType<typeof friend>>) {expect((await admin().rpc('queue_referral_welcome',{p_user_id:f.id,p_amount:10,p_minimum:30})).error).toBeNull();}
test.beforeAll(async()=>{bobId=await userIdFor(USERS.bob);});
test.beforeEach(async()=>{
 await resetShopifyMock();await clearOutbox();
 await admin().from('referral_webhook_events').delete().neq('event_id','');
 await admin().from('referral_rewards').delete().neq('code','');
 // These stable IDs make the Shopify mock deterministic. Remove only their local rows so a
 // previous suite run cannot make the order timestamp guard reject the next run as stale.
 await admin().from('orders').delete().in('shopify_order_id',['gid://shopify/Order/8001','gid://shopify/Order/8002']);
 await admin().from('referrals').update({uses:0,rewards_earned:0}).eq('code',SEED.bobReferralCode);
});
test.afterAll(async()=>{await admin().from('referral_webhook_events').delete().neq('event_id','');for(const id of ids) { for(const [table,column] of [['profiles','id'],['memberships','user_id'],['wishlists','user_id'],['cart_snapshots','user_id'],['referrals','referrer_id']]) await admin().from(table).delete().eq(column,id); expect((await admin().auth.admin.deleteUser(id)).error).toBeNull(); } await admin().from('referrals').update({uses:0,rewards_earned:0}).eq('code',SEED.bobReferralCode);});

test('welcome callback queues once; cron issues a customer-only code and independent email',async({request,baseURL})=>{
 const f=await friend();const code=await pkceCallbackCode(f.email,baseURL!);expect((await request.get(`/auth/callback?code=${encodeURIComponent(code.code)}`,{headers:{cookie:code.cookieHeader},maxRedirects:0})).status()).toBe(307);
 expect((await rewards(f.id))[0].status).toBe('pending');await queueWelcome(f);await drain(request);
 const [r]=await rewards(f.id);expect(r).toMatchObject({status:'issued',email_status:'sent',amount:10,minimum_subtotal:30,shopify_customer_id:f.customer.id});
 expect(await recordedDiscountCreates()).toEqual([expect.objectContaining({context:{customers:{add:[f.customer.id]}},usageLimit:1,appliesOncePerCustomer:true})]);
 expect((await readOutbox()).filter(m=>m.to===f.email&&m.html.includes(r.code))).toHaveLength(1);
});
test('concurrent duplicate paid deliveries claim and account once',async({request})=>{
 const f=await friend();await fixtures({orders:[order(f)]});const event=crypto.randomUUID();
 const rs=await Promise.all(Array.from({length:8},()=>webhook(request,f,event)));for(const r of rs)expect(r.status(),await r.text()).toBe(200);
 await Promise.all([tick(request),tick(request)]);await drain(request);
 expect(await rewards(bobId)).toHaveLength(1);expect(await recordedDiscountCreates()).toHaveLength(1);
 expect((await admin().from('referrals').select('rewards_earned').eq('code',SEED.bobReferralCode).single()).data?.rewards_earned).toBe(10);
});
test('historical payment including refunded orders disqualifies later paid order',async({request})=>{
 const f=await friend();const old=order(f,'gid://shopify/Order/7999',new Date(Date.now()-86400000).toISOString());old.displayFinancialStatus='REFUNDED';await fixtures({orders:[old,order(f)]});await webhook(request,f);await drain(request);expect(await rewards(bobId)).toHaveLength(0);expect(await recordedDiscountCreates()).toHaveLength(0);
});
test('out-of-order second-order event cannot claim; first-order event later can',async({request})=>{
 const f=await friend();const first=order(f);const later=order(f,'gid://shopify/Order/8002',new Date(Date.now()+1).toISOString());await new Promise(r=>setTimeout(r,10));await fixtures({orders:[first,later]});
 const body=JSON.stringify({id:8002,order_number:8002,email:f.email,financial_status:'paid'});expect((await request.post('/api/shopify/webhook',{headers:{'x-shopify-topic':'orders/paid','x-shopify-shop-domain':'e2e-store.myshopify.com','x-shopify-event-id':crypto.randomUUID(),'x-shopify-hmac-sha256':signShopifyWebhook(body)},data:body})).status()).toBe(200);
 await drain(request);expect(await rewards(bobId)).toHaveLength(0);await webhook(request,f);await drain(request);expect(await rewards(bobId)).toHaveLength(1);
});
test('cancelled or refunded qualifying order does not issue',async({request})=>{
 const f=await friend();await fixtures({orders:[{...order(f),cancelledAt:new Date().toISOString()}]});await webhook(request,f);await drain(request);expect(await recordedDiscountCreates()).toHaveLength(0);
});
test('missing customer mapping keeps reward pending with reason, never ALL customers',async({request})=>{
 const f=await friend();await fixtures({customers:[]});await queueWelcome(f);await tick(request);expect((await rewards(f.id))[0]).toMatchObject({status:'pending'});expect((await rewards(f.id))[0].last_error).toContain('mapping');expect(await recordedDiscountCreates()).toHaveLength(0);
});
test('missing historical scope keeps event pending; scheduler recovers without another webhook',async({request})=>{
 const f=await friend();await fixtures({orders:[order(f)],scopes:['read_customers','read_orders','read_discounts','write_discounts']});await webhook(request,f);await tick(request);expect(await rewards(bobId)).toHaveLength(0);
 expect((await admin().from('referral_webhook_events').select('last_error').single()).data?.last_error).toContain('read_all_orders');
 await fixtures({scopes:['read_customers','read_orders','read_all_orders','read_discounts','write_discounts']});await due();await drain(request);expect((await rewards(bobId))[0].status).toBe('issued');
});
test('Shopify refusal retries same code without new payment',async({request})=>{
 const f=await friend();await queueWelcome(f);await failNextDiscountCreate();await tick(request);const [r]=await rewards(f.id);expect(r.status).toBe('pending');await due();await drain(request);const codes=(await recordedDiscountCreates()).map(c=>c.code);expect(new Set(codes).size).toBe(1);expect((await rewards(f.id))[0].status).toBe('issued');
});
test('Shopify create committed but HTTP timed out: read-first retry recovers one discount',async({request})=>{
 const f=await friend();await queueWelcome(f);await fixtures({uncertainCreate:true});await tick(request);expect((await rewards(f.id))[0].status).toBe('pending');await due();await drain(request);expect(await recordedDiscountCreates()).toHaveLength(1);expect((await rewards(f.id))[0].status).toBe('issued');
});
test('database completion failure recovers existing Shopify code without double account',async({request})=>{
 const f=await friend();await fixtures({orders:[order(f)]});await webhook(request,f);
 const sql=`CREATE FUNCTION public.e2e_fail_issue() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.status='issued' THEN RAISE EXCEPTION 'injected write failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER e2e_fail_issue BEFORE UPDATE ON public.referral_rewards FOR EACH ROW EXECUTE FUNCTION public.e2e_fail_issue();`;
 execFileSync('docker',['exec','-i','supabase_db_self-love-e2e','psql','-U','postgres','-v','ON_ERROR_STOP=1'],{input:sql,stdio:['pipe','pipe','pipe']});
 try {await tick(request);expect((await rewards(bobId))[0].status).toBe('pending');} finally {execFileSync('docker',['exec','-i','supabase_db_self-love-e2e','psql','-U','postgres','-v','ON_ERROR_STOP=1'],{input:'DROP TRIGGER e2e_fail_issue ON public.referral_rewards; DROP FUNCTION public.e2e_fail_issue();',stdio:['pipe','pipe','pipe']});}
 await due();await drain(request);expect(await recordedDiscountCreates()).toHaveLength(1);expect((await rewards(bobId))[0].status).toBe('issued');
});
test('email transport failure retries independently without another discount',async({request})=>{
 const f=await friend();await queueWelcome(f);await tick(request);
 await fs.mkdir('.e2e-outbox',{recursive:true});await fs.rename('.e2e-outbox','.e2e-outbox-test-backup');await fs.writeFile('.e2e-outbox','injected filesystem delivery failure');
 try {await tick(request);expect((await rewards(f.id))[0]).toMatchObject({status:'issued',email_status:'failed'});}
 finally {await fs.unlink('.e2e-outbox');await fs.rename('.e2e-outbox-test-backup','.e2e-outbox');}
 await due();await tick(request);expect((await rewards(f.id))[0].email_status).toBe('sent');expect(await recordedDiscountCreates()).toHaveLength(1);
});
test('mismatched existing customer restriction is manual review',async({request})=>{
 const f=await friend();await queueWelcome(f);await fixtures({uncertainCreate:true});await tick(request);const [r]=await rewards(f.id);await fixtures({discountCode:r.code,discountPatch:{context:{__typename:'AllDiscountCustomers'}}});await due();await tick(request);expect((await rewards(f.id))[0].status).toBe('manual_review');expect(await recordedDiscountCreates()).toHaveLength(1);
});
test('unknown shop or missing event ID is rejected before sync',async({request})=>{
 const body=JSON.stringify({id:8001});const h={'x-shopify-topic':'orders/paid','x-shopify-hmac-sha256':signShopifyWebhook(body)};
 expect((await request.post('/api/shopify/webhook',{headers:{...h,'x-shopify-shop-domain':'other.myshopify.com'},data:body})).status()).toBe(401);
 expect((await request.post('/api/shopify/webhook',{headers:{...h,'x-shopify-shop-domain':'e2e-store.myshopify.com'},data:body})).status()).toBe(400);
});
test('reused event ID with a different signed body is rejected',async({request})=>{
 const f=await friend();const event=crypto.randomUUID();expect((await webhook(request,f,event)).status()).toBe(200);const body=JSON.stringify({id:8001,order_number:8001,email:f.email,financial_status:'paid',total_price:'99'});
 expect((await request.post('/api/shopify/webhook',{headers:{'x-shopify-topic':'orders/paid','x-shopify-shop-domain':'e2e-store.myshopify.com','x-shopify-event-id':event,'x-shopify-hmac-sha256':signShopifyWebhook(body)},data:body})).status()).toBe(500);
});

test('atomic claim rolls back marker when reward INSERT fails',async({request})=>{
 const f=await friend();await fixtures({orders:[order(f)]});await webhook(request,f);
 execFileSync('docker',['exec','-i','supabase_db_self-love-e2e','psql','-U','postgres','-v','ON_ERROR_STOP=1'],{input:"CREATE FUNCTION public.e2e_fail_claim() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected insert failure'; END $$; CREATE TRIGGER e2e_fail_claim BEFORE INSERT ON public.referral_rewards FOR EACH ROW EXECUTE FUNCTION public.e2e_fail_claim();",stdio:['pipe','pipe','pipe']});
 try {await tick(request);expect((await admin().from('referral_redemptions').select('referrer_rewarded_at').eq('referred_user_id',f.id).single()).data?.referrer_rewarded_at).toBeNull();expect(await rewards(bobId)).toHaveLength(0);}
 finally {execFileSync('docker',['exec','-i','supabase_db_self-love-e2e','psql','-U','postgres','-v','ON_ERROR_STOP=1'],{input:'DROP TRIGGER e2e_fail_claim ON public.referral_rewards; DROP FUNCTION public.e2e_fail_claim();',stdio:['pipe','pipe','pipe']});}
 await due();await drain(request);expect((await rewards(bobId))[0].status).toBe('issued');
});

test('expired processing lease recovers while active lease and exhausted budget do not',async({request})=>{
 const f=await friend();await queueWelcome(f);const [r]=await rewards(f.id);
 await admin().from('referral_rewards').update({status:'processing',lease_token:crypto.randomUUID(),lease_until:new Date(Date.now()+60000).toISOString(),attempts:1}).eq('id',r.id);
 await tick(request);expect(await recordedDiscountCreates()).toHaveLength(0);
 await admin().from('referral_rewards').update({lease_until:new Date(0).toISOString()}).eq('id',r.id);await tick(request);expect((await rewards(f.id))[0].status).toBe('issued');
 const f2=await friend();await queueWelcome(f2);await admin().from('referral_rewards').update({attempts:8}).eq('user_id',f2.id);await drain(request);expect((await rewards(f2.id))[0].status).toBe('pending');expect(await recordedDiscountCreates()).toHaveLength(1);
});

test('reward RLS exposes only the owner and rejects direct writes and claim RPC',async()=>{
 const f=await friend();await queueWelcome(f);const owner=await asUser(f.email),other=await asUser(USERS.bob);
 expect((await owner.from('referral_rewards').select('code')).data).toHaveLength(1);
 expect((await other.from('referral_rewards').select('code')).data).toHaveLength(0);
 expect((await anon().from('referral_rewards').select('code')).data??[]).toHaveLength(0);
 expect((await owner.from('referral_rewards').update({status:'issued'}).eq('user_id',f.id)).error).not.toBeNull();
 expect((await owner.rpc('queue_referral_welcome',{p_user_id:f.id,p_amount:999,p_minimum:0})).error).not.toBeNull();
});

test('deleted account keeps deduplication event but cannot receive a reward',async({request})=>{
 const f=await friend();await webhook(request,f);
 for(const [table,column] of [['profiles','id'],['memberships','user_id'],['wishlists','user_id'],['cart_snapshots','user_id'],['referrals','referrer_id']]) await admin().from(table).delete().eq(column,f.id);
 expect((await admin().auth.admin.deleteUser(f.id)).error).toBeNull();ids.splice(ids.indexOf(f.id),1);
 expect((await admin().from('referral_webhook_events').select('user_id').single()).data?.user_id).toBeNull();
 await tick(request);expect((await admin().from('referral_webhook_events').select('status').single()).data?.status).toBe('manual_review');expect(await recordedDiscountCreates()).toHaveLength(0);
});

test('missing referrer email keeps a durable pending claim and recovers after verification',async({request})=>{
 const f=await friend();await fixtures({orders:[order(f)]});await webhook(request,f);
 expect(bobId).toMatch(/^[0-9a-f-]{36}$/i);
 const sql=(s:string)=>execFileSync('docker',['exec','-i','supabase_db_self-love-e2e','psql','-U','postgres','-v','ON_ERROR_STOP=1'],{input:s,stdio:['pipe','pipe','pipe']});
 sql(`UPDATE auth.users SET email=NULL WHERE id='${bobId}';`);
 try {await tick(request);const [r]=await rewards(bobId);expect(r.status).toBe('pending');expect(r.last_error).toContain('Confirmed');expect(await recordedDiscountCreates()).toHaveLength(0);}
 finally {sql(`UPDATE auth.users SET email='${USERS.bob}' WHERE id='${bobId}';`);}
 await due();await drain(request);expect((await rewards(bobId))[0]).toMatchObject({status:'issued',email_status:'sent',recipient_email:USERS.bob});
});

test('legacy referrer reward without payment evidence cannot issue',async({request})=>{
 const f=await friend();await queueWelcome(f);await admin().from('referral_rewards').update({kind:'referrer',user_id:bobId,recipient_email:USERS.bob}).eq('user_id',f.id);
 await tick(request);expect((await rewards(bobId))[0]).toMatchObject({status:'manual_review'});expect(await recordedDiscountCreates()).toHaveLength(0);
});
