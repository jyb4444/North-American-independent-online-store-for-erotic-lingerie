import {test,expect} from '@playwright/test';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {admin,asUser,sessionCookieHeader} from '../helpers/supabase';
import {USERS} from '../helpers/seed';

test('API forces pending even with production DEFAULT true and forged client flags',async({request})=>{
 const db=(sql:string)=>execFileSync('docker',['exec','-i','supabase_db_self-love-e2e','psql','-U','postgres','-v','ON_ERROR_STOP=1'],{input:sql,stdio:['pipe','pipe','pipe']});
 db('ALTER TABLE public.reviews ALTER COLUMN approved SET DEFAULT true;');let id:string|undefined;
 try {
  const response=await request.post('/api/reviews',{headers:{cookie:await sessionCookieHeader(USERS.alice),'x-forwarded-for':'moderation-'+crypto.randomUUID()},data:{product_id:'e2e-moderation',product_handle:'e2e-product',rating:5,body_text:'   This review is awaiting genuine moderation.   ',approved:true,verified_purchase:true}});
  expect(response.status(),await response.text()).toBe(200);id=(await response.json()).review.id;
  const row=await admin().from('reviews').select('approved,verified_purchase,body').eq('id',id).single();expect(row.data).toEqual({approved:false,verified_purchase:false,body:'This review is awaiting genuine moderation.'});
  const publicResult=await request.get('/api/reviews?product_id=e2e-moderation');expect((await publicResult.json()).reviews).toHaveLength(0);
  const own=await request.get('/api/reviews?product_id=e2e-moderation',{headers:{cookie:await sessionCookieHeader(USERS.alice)}});expect((await own.json()).reviews).toHaveLength(1);
  const other=await request.get('/api/reviews?product_id=e2e-moderation',{headers:{cookie:await sessionCookieHeader(USERS.bob)}});expect((await other.json()).reviews).toHaveLength(0);
  expect((await (await asUser(USERS.alice)).from('reviews').update({approved:true}).eq('id',id)).error).not.toBeNull();
  expect((await admin().from('reviews').update({approved:true}).eq('id',id)).error).toBeNull();
  const visible=(await (await request.get('/api/reviews?product_id=e2e-moderation')).json()).reviews;expect(visible).toHaveLength(1);expect(visible[0]).not.toHaveProperty('user_id');expect(visible[0]).not.toHaveProperty('email');
 } finally {db('ALTER TABLE public.reviews ALTER COLUMN approved SET DEFAULT false;');if(id)await admin().from('reviews').delete().eq('id',id);}
});
test('trimmed short body is rejected before database INSERT',async({request})=>{
 const r=await request.post('/api/reviews',{headers:{cookie:await sessionCookieHeader(USERS.alice),'x-forwarded-for':'moderation-'+crypto.randomUUID()},data:{product_id:'e2e-moderation-short',product_handle:'e2e',rating:5,body_text:'        tiny        '}});expect(r.status()).toBe(400);
 expect((await admin().from('reviews').select('id').eq('product_id','e2e-moderation-short')).data).toHaveLength(0);
});
test('non-string review body is rejected as a client error',async({request})=>{
 const r=await request.post('/api/reviews',{headers:{cookie:await sessionCookieHeader(USERS.alice),'x-forwarded-for':'moderation-type-'+crypto.randomUUID()},data:{product_id:'e2e-moderation-type',product_handle:'e2e',rating:5,body_text:12345}});
 expect(r.status()).toBe(400);
});
