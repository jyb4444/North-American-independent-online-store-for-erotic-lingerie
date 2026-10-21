import crypto from 'node:crypto';
import {test,expect} from '@playwright/test';
import {sessionCookieHeader,signShopifyWebhook,admin} from '../helpers/supabase';
import {USERS,SEED} from '../helpers/seed';

test('legacy DEFAULT true still produces pending API review',async({request})=>{
 const r=await request.post('/api/reviews',{headers:{cookie:await sessionCookieHeader(USERS.alice),'x-forwarded-for':'legacy-'+crypto.randomUUID()},data:{product_id:'e2e-legacy-review',product_handle:'e2e',rating:5,body_text:'A genuinely pending review in the legacy schema',approved:true,verified_purchase:true}});
 expect(r.status(),await r.text()).toBe(200);const id=(await r.json()).review.id;
 expect((await admin().from('reviews').select('approved,verified_purchase').eq('id',id).single()).data).toEqual({approved:false,verified_purchase:false});
 expect((await (await request.get('/api/reviews?product_id=e2e-legacy-review')).json()).reviews).toHaveLength(0);
 await admin().from('reviews').delete().eq('id',id);
});
test('existing referral code reads without reward tables; missing UNIQUE fails closed on new creation',async({request})=>{
 const r=await request.get('/api/referral',{headers:{cookie:await sessionCookieHeader(USERS.bob)}});expect(r.status(),await r.text()).toBe(200);expect((await r.json()).code).toBe(SEED.bobReferralCode);
 if(process.env.E2E_SCHEMA_MODE==='legacy') {
  const r2=await request.get('/api/referral',{headers:{cookie:await sessionCookieHeader(USERS.mallory)}});expect(r2.status()).toBe(503);
 }
});
test('order synchronization succeeds even without new RPCs',async({request})=>{
 const body=JSON.stringify({id:88881,order_number:88881,email:USERS.alice,financial_status:'paid',total_price:'35'});
 const r=await request.post('/api/shopify/webhook',{headers:{'x-shopify-shop-domain':'e2e-store.myshopify.com','x-shopify-event-id':crypto.randomUUID(),'x-shopify-topic':'orders/paid','x-shopify-hmac-sha256':signShopifyWebhook(body)},data:body});expect(r.status(),await r.text()).toBe(200);
 const row=await admin().from('orders').select('user_id').eq('shopify_order_id','88881').single();expect(row.error).toBeNull();expect(row.data?.user_id).toBeTruthy();await admin().from('orders').delete().eq('shopify_order_id','88881');
});
test('membership reads survive but arbitrary client points are rejected',async({request})=>{
 const headers={cookie:await sessionCookieHeader(USERS.alice)};expect((await request.get('/api/membership',{headers})).status()).toBe(200);expect((await request.post('/api/membership',{headers,data:{points:999999}})).status()).toBe(405);
});
test('legacy release leaves reward processing off',async({request})=>{
 const r=await request.get('/api/cron/referral-rewards',{headers:{authorization:`Bearer ${process.env.CRON_SECRET}`}});expect(r.status()).toBe(200);
 if(process.env.E2E_SCHEMA_MODE==='legacy')expect((await r.json()).enabled).toBe(false);
});

test('legacy validation POST does not credit an unconfirmed referral',async({request})=>{
 const before=(await admin().from('referrals').select('uses').eq('code',SEED.bobReferralCode).single()).data?.uses;
 const r=await request.post('/api/referral',{data:{code:SEED.bobReferralCode}});expect(r.status()).toBe(200);expect((await r.json()).applied).toBe(false);
 expect((await admin().from('referrals').select('uses').eq('code',SEED.bobReferralCode).single()).data?.uses).toBe(before);
});
