/**
 * Minimal local stand-in for the Shopify Storefront GraphQL API, used by the E2E test server
 * (see E2E_SHOPIFY_STOREFRONT_URL in tests/e2e.env). It implements only what the app's gift
 * card and checkout flows call, following the documented Storefront API shapes:
 *   - query GiftCardProduct(handle)    → a gift card product with denominations
 *   - mutation cartCreate(input)       → cart with cost, appliedGiftCards, userErrors
 * Anything else returns a GraphQL error, so the app falls back to its built-in catalogue.
 *
 * Admin API (POST /admin/graphql.json, token e2e-admin-token):
 *   - mutation CreateRewardDiscount  → discount node (or userErrors after POST /__admin-fail)
 *   - query OrdersForEmail           → no orders
 *   - mutation SyncReturnRequest     → success
 *   - query OrderForCart             → an order only after POST /__complete-cart
 * GET /__admin-requests lists recorded Admin calls.
 *
 *   - query CartStatus(id)             → the cart, or null once "ordered" (deleted by Shopify)
 * Test hooks: GET /__requests (recorded GraphQL calls), POST /__reset, GET /__health,
 *             POST /__complete-cart { id } (simulate the cart becoming an order).
 * Behaviour that must be confirmed against a real store is noted in docs/testing/TEST_PLAN.md.
 */
import http from 'node:http';

const PORT = Number(process.env.SHOPIFY_MOCK_PORT ?? 3199);
const TOKEN = 'e2e-storefront-token';
const CURRENCY = 'USD';

export const GIFT_CARD_VARIANTS = [
  { id: 'gid://shopify/ProductVariant/9000025', title: '$25', amount: 25, availableForSale: true },
  { id: 'gid://shopify/ProductVariant/9000050', title: '$50', amount: 50, availableForSale: true },
  { id: 'gid://shopify/ProductVariant/9000100', title: '$100', amount: 100, availableForSale: true },
  { id: 'gid://shopify/ProductVariant/9000500', title: '$500', amount: 500, availableForSale: false },
];

/** Issued gift cards by code (alphanumerics only). A zero balance is never applied. */
const GIFT_CARDS: Record<string, number> = {
  GIFTE2E0000ABCD: 40,
  GIFTE2EEMPTY0000: 0,
};

type GraphQLRequest = { query: string; variables?: Record<string, unknown> };
type CartLineInput = { merchandiseId: string; quantity?: number; attributes?: { key: string; value: string }[] };

let recorded: GraphQLRequest[] = [];
const completedCarts = new Set<string>();
let adminRecorded: GraphQLRequest[] = [];
let failNextAdminDiscount = false;
const ADMIN_TOKEN = 'e2e-admin-token';
let referralCustomers: { id: string; email: string; verifiedEmail: boolean }[] = [];
let referralOrders: Record<string, unknown>[] = [];
let rewardScopes = ['read_customers','read_orders','read_all_orders','read_discounts','write_discounts'];
let uncertainCreate = false;
const discounts = new Map<string, { id: string; codeDiscount: Record<string, unknown> }>();
function snapshot(input: Record<string, unknown>) {
  const gets=input.customerGets as { value: { discountAmount: { amount: string; appliesOnEachItem: boolean } } };
  const context=input.context as { customers: { add: string[] } };
  const min=input.minimumRequirement as { subtotal: { greaterThanOrEqualToSubtotal: string } } | undefined;
  return { __typename:'DiscountCodeBasic', title:input.title, usageLimit:input.usageLimit, appliesOncePerCustomer:input.appliesOncePerCustomer,
    startsAt:input.startsAt, endsAt:null, codes:{nodes:[{code:input.code}],pageInfo:{hasNextPage:false}},
    context:{__typename:'DiscountCustomers',customers:context.customers.add.map((id)=>({id}))},
    customerGets:{items:{__typename:'AllDiscountItems',allItems:true},value:{__typename:'DiscountAmount',amount:{amount:gets.value.discountAmount.amount,currencyCode:'USD'},appliesOnEachItem:gets.value.discountAmount.appliesOnEachItem}},
    minimumRequirement:min?{__typename:'DiscountMinimumSubtotal',greaterThanOrEqualToSubtotal:{amount:min.subtotal.greaterThanOrEqualToSubtotal,currencyCode:'USD'}}:null, combinesWith:input.combinesWith };
}


function adminResponse(body: GraphQLRequest) {
  if (/query\s+OrderForCart\b/.test(body.query)) {
    const token = String(body.variables?.query ?? '').replace(/^cart_token:/, '');
    const completed = [...completedCarts].some((id) => id.match(/^gid:\/\/shopify\/Cart\/([^?]+)/)?.[1] === token);
    return { data: { orders: { nodes: completed ? [{ id: 'gid://shopify/Order/e2e-complete' }] : [] } } };
  }
  if (/query\s+ReferralScopes\b/.test(body.query)) return {data:{currentAppInstallation:{accessScopes:rewardScopes.map((handle)=>({handle}))},shop:{currencyCode:'USD'}}};
  if (/query\s+ReferralCustomer\b/.test(body.query)) return {data:{customers:{nodes:referralCustomers.filter((c)=>String(body.variables?.query).includes(c.email)),pageInfo:{hasNextPage:false}}}};
  if (/query\s+ReferralOrderHistory\b/.test(body.query)) return {data:{orders:{nodes:referralOrders.filter((o)=>String(body.variables?.query).includes(String(o.email))),pageInfo:{hasNextPage:false,endCursor:null}}}};
  if (/query\s+ReferralDiscount\b/.test(body.query)) return {data:{codeDiscountNodeByCode:discounts.get(String(body.variables?.code))??null}};
  if (/query\s+ReferralCreatedDiscount\b/.test(body.query)) return {data:{node:discounts.get(String(body.variables?.code))??null}};

  if (/mutation\s+CreateRewardDiscount\b/.test(body.query)) {
    if (failNextAdminDiscount) {
      failNextAdminDiscount = false;
      return { data: { discountCodeBasicCreate: { codeDiscountNode: null, userErrors: [{ field: ['basicCodeDiscount'], message: 'Access denied for discountCodeBasicCreate', code: null }] } } };
    }
    const input=body.variables!.basicCodeDiscount as Record<string, unknown>;
    const code=String(input.code);
    if(discounts.has(code)) return {data:{discountCodeBasicCreate:{codeDiscountNode:null,userErrors:[{message:'Code already exists'}]}}};
    const id=`gid://shopify/DiscountCodeNode/${adminRecorded.length}`;
    discounts.set(code,{id,codeDiscount:snapshot(input)});
    return { data: { discountCodeBasicCreate: { codeDiscountNode: { id }, userErrors: [] } } };
  }
  if (/query\s+OrdersFor(Account|Email)\b/.test(body.query)) return { data: { orders: { nodes: [] } } };
  if (/mutation\s+SyncReturnRequest\b/.test(body.query)) return { data: { tagsAdd: { userErrors: [] }, metafieldsSet: { userErrors: [] } } };
  return { errors: [{ message: 'Not implemented by the e2e Shopify Admin mock' }] };
}

const money = (amount: number) => ({ amount: amount.toFixed(1), currencyCode: CURRENCY });

function variantPrice(id: string): number {
  return GIFT_CARD_VARIANTS.find((variant) => variant.id === id)?.amount ?? 30;
}

function giftCardProduct(handle: unknown) {
  if (handle !== 'gift-card') return { data: { product: null } };
  return {
    data: {
      product: {
        id: 'gid://shopify/Product/9000000',
        title: 'Self Love Gift Card',
        isGiftCard: true,
        variants: {
          edges: GIFT_CARD_VARIANTS.map((variant) => ({
            node: { id: variant.id, title: variant.title, availableForSale: variant.availableForSale, price: money(variant.amount) },
          })),
        },
      },
    },
  };
}

function cartCreate(input: { lines?: CartLineInput[]; giftCardCodes?: string[] }) {
  const userErrors: { field: string[]; message: string; code: string }[] = [];
  const lines = input.lines ?? [];

  lines.forEach((line, index) => {
    if (!/^gid:\/\/shopify\/ProductVariant\/\d+$/.test(line.merchandiseId)) {
      userErrors.push({ field: ['input', 'lines', String(index), 'merchandiseId'], message: 'The merchandise with id does not exist.', code: 'INVALID' });
    }
    const attributes = Object.fromEntries((line.attributes ?? []).map(({ key, value }) => [key, value]));
    if (attributes.__shopify_send_gift_card_to_recipient === 'true') {
      const email = attributes['Recipient email'] ?? '';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.includes('reject')) {
        userErrors.push({ field: ['input', 'lines', String(index), 'attributes'], message: 'The specified gift card recipient is invalid.', code: 'GIFT_CARD_RECIPIENT_INVALID' });
      }
    }
  });

  if (userErrors.length > 0) return { data: { cartCreate: { cart: null, userErrors } } };

  const subtotal = lines.reduce((sum, line) => sum + variantPrice(line.merchandiseId) * (line.quantity ?? 1), 0);
  let remaining = subtotal;
  const appliedGiftCards = (input.giftCardCodes ?? []).flatMap((rawCode) => {
    const code = rawCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const balance = GIFT_CARDS[code];
    if (!balance) return [];
    const amountUsed = Math.min(balance, remaining);
    remaining -= amountUsed;
    return [{ lastCharacters: code.slice(-4), amountUsed: money(amountUsed), balance: money(balance) }];
  });

  const id = `gid://shopify/Cart/e2e${recorded.length}`;
  return {
    data: {
      cartCreate: {
        cart: {
          id,
          checkoutUrl: `https://e2e-store.myshopify.com/cart/c/e2e${recorded.length}`,
          cost: { subtotalAmount: money(subtotal), totalAmount: money(remaining) },
          appliedGiftCards,
        },
        userErrors: [],
      },
    },
  };
}

function send(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/__health') return send(res, 200, { ok: true });
  if (req.method === 'GET' && req.url === '/__requests') return send(res, 200, recorded);
  if (req.method === 'POST' && req.url === '/__referral-fixtures') {
    const chunks:Buffer[]=[];for await(const chunk of req) chunks.push(Buffer.from(chunk));
    const input=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    referralCustomers=input.customers??referralCustomers;referralOrders=input.orders??referralOrders;rewardScopes=input.scopes??rewardScopes;
    uncertainCreate=!!input.uncertainCreate;
    if(input.discountCode && input.discountPatch) { const d=discounts.get(input.discountCode);if(d) Object.assign(d.codeDiscount,input.discountPatch); }
    return send(res,200,{ok:true});
  }
  if (req.method === 'GET' && req.url === '/__admin-requests') return send(res, 200, adminRecorded);
  if (req.method === 'POST' && req.url === '/__admin-fail') {
    failNextAdminDiscount = true;
    return send(res, 200, { ok: true });
  }
  if (req.method === 'POST' && req.url === '/admin/graphql.json') {
    if (req.headers['x-shopify-access-token'] !== ADMIN_TOKEN) return send(res, 401, { errors: [{ message: 'Unauthorized' }] });
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const adminBody = JSON.parse(Buffer.concat(chunks).toString('utf8')) as GraphQLRequest;
    adminRecorded.push(adminBody);
    const response=adminResponse(adminBody);
    if(uncertainCreate && /mutation\s+CreateRewardDiscount\b/.test(adminBody.query)) {
      uncertainCreate=false;setTimeout(()=>send(res,200,response),7000);return;
    }
    return send(res, 200, response);
  }
  if (req.method === 'POST' && req.url === '/__reset') {
    recorded = [];
    adminRecorded = [];
    discounts.clear();referralCustomers=[];referralOrders=[];rewardScopes=['read_customers','read_orders','read_all_orders','read_discounts','write_discounts'];uncertainCreate=false;
    failNextAdminDiscount = false;
    completedCarts.clear();
    return send(res, 200, { ok: true });
  }
  if (req.method === 'POST' && req.url === '/__complete-cart') {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    completedCarts.add(JSON.parse(Buffer.concat(chunks).toString('utf8')).id);
    return send(res, 200, { ok: true });
  }
  if (req.method !== 'POST' || req.url !== '/api/graphql.json') return send(res, 404, { error: 'not found' });

  if (req.headers['x-shopify-storefront-access-token'] !== TOKEN) return send(res, 401, { errors: [{ message: 'Unauthorized' }] });

  let body: GraphQLRequest;
  try {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return send(res, 400, { errors: [{ message: 'Invalid JSON' }] });
  }
  recorded.push(body);

  if (/query\s+GiftCardProduct\b/.test(body.query)) return send(res, 200, giftCardProduct(body.variables?.handle));
  if (/mutation\s+cartCreate\b/.test(body.query)) {
    return send(res, 200, cartCreate((body.variables?.input ?? {}) as Parameters<typeof cartCreate>[0]));
  }
  if (/query\s+CartStatus\b/.test(body.query)) {
    const id = String(body.variables?.id ?? '');
    const issued = id.startsWith('gid://shopify/Cart/e2e');
    return send(res, 200, { data: { cart: issued && !completedCarts.has(id) ? { id } : null } });
  }
  return send(res, 200, { errors: [{ message: 'Not implemented by the e2e Shopify mock' }] });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Shopify Storefront mock listening on http://127.0.0.1:${PORT}`);
});
