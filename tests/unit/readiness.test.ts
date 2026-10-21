import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pendingReviewFields,validReviewBody,publicReviewRow} from '../../src/lib/review-moderation';
import {proveFirstPaidOrder,validRewardDiscount,type PaidOrder,type DiscountSnapshot} from '../../src/lib/referral-shopify';
const customer={id:'gid://shopify/Customer/1',email:'verified@example.com',verifiedEmail:true};
const paid=(id:string,time:number):PaidOrder=>({id,email:customer.email,customer:{id:customer.id},cancelledAt:null,displayFinancialStatus:'PAID',totalPriceSet:{shopMoney:{amount:'30',currencyCode:'USD'}},transactions:[{kind:'SALE',status:'SUCCESS',processedAt:new Date(time).toISOString(),amountSet:{shopMoney:{amount:'30',currencyCode:'USD'}}}]});
test('moderation flags never trust caller and trim length is mandatory',()=>{assert.deepEqual(pendingReviewFields(),{approved:false,verified_purchase:false});assert.equal(validReviewBody('        tiny        '),false);assert.equal(validReviewBody('  ten letters!  '),true);});
test('first payment proof is independent of webhook order',()=>{const a=paid('a',1000),b=paid('b',2000);assert.equal(proveFirstPaidOrder([b,a],'a',customer),a.transactions[0].processedAt);assert.throws(()=>proveFirstPaidOrder([b,a],'b',customer));});
test('refunded history and cancelled candidates fail closed',()=>{const a=paid('a',1000),b=paid('b',2000);a.displayFinancialStatus='REFUNDED';assert.throws(()=>proveFirstPaidOrder([a,b],'b',customer));b.cancelledAt=new Date(2001).toISOString();assert.throws(()=>proveFirstPaidOrder([b],'b',customer));});
test('ambiguous timestamps, invalid amount and customer mismatch fail closed',()=>{const a=paid('a',1000);a.transactions[0].amountSet.shopMoney.amount='NaN';assert.throws(()=>proveFirstPaidOrder([a],'a',customer));a.transactions[0].amountSet.shopMoney.amount='30';a.customer={id:'wrong'};assert.throws(()=>proveFirstPaidOrder([a],'a',customer));});
test('discount recovery verifies all recipient and amount constraints',()=>{
 const d:DiscountSnapshot={__typename:'DiscountCodeBasic',title:'reward',usageLimit:1,appliesOncePerCustomer:true,startsAt:new Date(0).toISOString(),endsAt:null,codes:{nodes:[{code:'FIXED'}],pageInfo:{hasNextPage:false}},context:{__typename:'DiscountCustomers',customers:[{id:customer.id}]},customerGets:{items:{__typename:'AllDiscountItems',allItems:true},value:{__typename:'DiscountAmount',amount:{amount:'10',currencyCode:'USD'},appliesOnEachItem:false}},minimumRequirement:{__typename:'DiscountMinimumSubtotal',greaterThanOrEqualToSubtotal:{amount:'30',currencyCode:'USD'}},combinesWith:{orderDiscounts:false,productDiscounts:false,shippingDiscounts:true}};
 const i={title:'reward',code:'FIXED',customerId:customer.id,amount:10,minimumSubtotal:30};assert.equal(validRewardDiscount(d,i),true);
 assert.equal(validRewardDiscount({...d,context:{__typename:'AllDiscountCustomers'}},i),false);assert.equal(validRewardDiscount({...d,usageLimit:2},i),false);assert.equal(validRewardDiscount(d,{...i,customerId:'another'}),false);assert.equal(validRewardDiscount(d,{...i,amount:20}),false);
});

test('public review response strips private contact and account ID',()=>{assert.deepEqual(publicReviewRow({id:'review',approved:true,user_id:'private',email:'private@example.com'}),{id:'review',approved:true,pending:false});});
