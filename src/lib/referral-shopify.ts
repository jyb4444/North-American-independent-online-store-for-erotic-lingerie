import { shopifyAdminFetch, createDiscountCode } from '@/lib/shopify/admin';

export class RewardBlocked extends Error {
  constructor(message: string, readonly manual = false) { super(message); }
}
export type CustomerIdentity = { id: string; email: string; verifiedEmail: boolean };
export type PaidOrder = { id: string; email: string; customer: { id: string } | null; cancelledAt: string | null; displayFinancialStatus: string; totalPriceSet: { shopMoney: { amount: string; currencyCode: string } }; transactions: { status: string; kind: string; processedAt: string | null; amountSet: { shopMoney: { amount: string; currencyCode: string } } }[] };
async function query<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const result = await shopifyAdminFetch<T>({ query, variables });
  if (result.error || !result.data) throw new RewardBlocked(result.skipped ? 'Shopify Admin configuration missing' : 'Shopify read failed; verify scopes/protected customer data access');
  return result.data;
}
export async function requireRewardScopes(history = false) {
  const data = await query<{ currentAppInstallation: { accessScopes: { handle: string }[] }; shop: { currencyCode: string } }>(`query ReferralScopes { currentAppInstallation { accessScopes { handle } } shop { currencyCode } }`);
  const required = ['read_customers', 'read_discounts', 'write_discounts', ...(history ? ['read_orders', 'read_all_orders'] : [])];
  const actual = new Set(data.currentAppInstallation.accessScopes.map((s) => s.handle));
  const missing = required.filter((s) => !actual.has(s));
  if (missing.length) throw new RewardBlocked(`Missing approved Shopify scopes: ${missing.join(', ')}`);
  if (data.shop.currencyCode !== 'USD') throw new RewardBlocked('USD reward requires USD shop currency; manual currency configuration needed');
}
const searchString = (email: string) => `email:"${email.replace(/[\\"]/g, '\\$&')}"`;
export async function verifiedCustomer(email: string): Promise<CustomerIdentity> {
  const data = await query<{ customers: { nodes: CustomerIdentity[]; pageInfo: { hasNextPage: boolean } } }>(`query ReferralCustomer($query: String!) { customers(first: 2, query: $query) { nodes { id email verifiedEmail } pageInfo { hasNextPage } } }`, { query: searchString(email) });
  const nodes = data.customers.nodes;
  if (data.customers.pageInfo.hasNextPage || nodes.length !== 1 || !nodes[0].verifiedEmail || nodes[0].email?.toLowerCase() !== email.toLowerCase() || !/^gid:\/\/shopify\/Customer\/\d+$/.test(nodes[0].id)) throw new RewardBlocked('No unique verified Shopify customer mapping; customer creation is disabled');
  return nodes[0];
}
const ORDER_FIELDS = `id email customer { id } cancelledAt displayFinancialStatus totalPriceSet { shopMoney { amount currencyCode } } transactions(first: 250) { status kind processedAt amountSet { shopMoney { amount currencyCode } } }`;
/** Conservative: incomplete history, split payments or ambiguous timestamps never qualify. */
export function proveFirstPaidOrder(orders: PaidOrder[], orderId: string, identity: CustomerIdentity) {
  const candidate = orders.find((o) => o.id === orderId);
  if (!candidate || candidate.customer?.id !== identity.id || candidate.email?.toLowerCase() !== identity.email.toLowerCase()) throw new RewardBlocked('Order/customer ownership could not be proven', true);
  if (candidate.cancelledAt || candidate.displayFinancialStatus !== 'PAID') throw new RewardBlocked('Qualifying order is cancelled, refunded or not fully paid', true);
  let payment: string | null = null;
  for (const order of orders) {
    if (order.email?.toLowerCase() !== identity.email.toLowerCase() && order.customer?.id !== identity.id) throw new RewardBlocked('Unexpected historical order identity', true);
    if (order.transactions.length >= 250) throw new RewardBlocked('Incomplete transaction history', true);
    const captures = order.transactions.filter((t) => t.status === 'SUCCESS' && ['SALE', 'CAPTURE'].includes(t.kind));
    if (captures.some((t) => !t.processedAt || !Number.isFinite(Date.parse(t.processedAt)) || Date.parse(t.processedAt)>Date.now())) throw new RewardBlocked('Invalid historical payment timestamps',true);
    if (order.id !== orderId && (captures.length || ['PAID','REFUNDED','PARTIALLY_REFUNDED','PARTIALLY_PAID'].includes(order.displayFinancialStatus))) {
      // A later paid order is permitted only if all its captures demonstrably follow this one's payment.
      const own = candidate.transactions.filter((t) => t.status === 'SUCCESS' && ['SALE','CAPTURE'].includes(t.kind));
      if (own.length !== 1 || !own[0].processedAt || !captures.length || captures.some((t) => !t.processedAt || Date.parse(t.processedAt) <= Date.parse(own[0].processedAt!))) throw new RewardBlocked('Earlier/ambiguous successful payment exists; not proven first order', true);
    }
    if (order.id === orderId) {
      if (captures.length !== 1 || !captures[0].processedAt || !Number.isFinite(Date.parse(captures[0].processedAt)) || Date.parse(captures[0].processedAt)>Date.now()) throw new RewardBlocked('Split/ambiguous payment needs manual verification', true);
      const amount = captures[0].amountSet.shopMoney;
      const total = order.totalPriceSet.shopMoney;
      if (amount.currencyCode !== 'USD' || amount.currencyCode !== total.currencyCode || !Number.isFinite(Number(total.amount)) || Number(total.amount)<=0 || !Number.isFinite(Number(amount.amount)) || Number(amount.amount)<Number(total.amount)) throw new RewardBlocked('Full successful payment cannot be proven', true);
      payment = captures[0].processedAt;
    }
  }
  if (!payment) throw new RewardBlocked('Successful payment missing', true);
  return payment;
}
export async function firstPaidOrder(email: string, orderId: string) {
  await requireRewardScopes(true);
  const identity = await verifiedCustomer(email);
  const orders: PaidOrder[] = [];
  let after: string | null = null;
  for (let page = 0; page < 20; page++) {
    const data: { orders: { nodes: PaidOrder[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } } } = await query(`query ReferralOrderHistory($query: String!, $after: String) { orders(first: 100, after: $after, query: $query, sortKey: CREATED_AT) { nodes { ${ORDER_FIELDS} } pageInfo { hasNextPage endCursor } } }`, { query: `(customer_id:${identity.id.split('/').at(-1)} OR ${searchString(email)})`, after });
    orders.push(...data.orders.nodes);
    if (!data.orders.pageInfo.hasNextPage) return { identity, paidAt: proveFirstPaidOrder(orders, orderId, identity) };
    if (!data.orders.pageInfo.endCursor || data.orders.pageInfo.endCursor === after) break;
    after = data.orders.pageInfo.endCursor;
  }
  throw new RewardBlocked('Historical order pagination incomplete; first order not proven', true);
}
export type DiscountSnapshot = {
  __typename: string; title: string; usageLimit: number; appliesOncePerCustomer: boolean; startsAt: string; endsAt: string | null;
  codes: { nodes: { code: string }[]; pageInfo: { hasNextPage: boolean } };
  context: { __typename: string; customers?: { id: string }[] };
  customerGets: { items: { __typename: string; allItems?: boolean }; value: { __typename: string; amount?: { amount: string; currencyCode: string }; appliesOnEachItem?: boolean } };
  minimumRequirement: { __typename: string; greaterThanOrEqualToSubtotal?: { amount: string; currencyCode: string } } | null;
  combinesWith: { orderDiscounts: boolean; productDiscounts: boolean; shippingDiscounts: boolean };
};
export function validRewardDiscount(d: DiscountSnapshot, input: { code: string; title: string; customerId: string; amount: number; minimumSubtotal: number }) {
  const value = d.customerGets?.value;
  const minimum = d.minimumRequirement;
  return d.__typename === 'DiscountCodeBasic' && d.title === input.title && d.usageLimit === 1 && d.appliesOncePerCustomer === true && d.endsAt === null && Date.parse(d.startsAt)<=Date.now()
    && !d.codes.pageInfo.hasNextPage && d.codes.nodes.length===1 && d.codes.nodes[0].code===input.code
    && d.context.__typename==='DiscountCustomers' && d.context.customers?.length===1 && d.context.customers[0].id===input.customerId
    && value?.__typename==='DiscountAmount' && Number(value.amount?.amount)===input.amount && value.amount?.currencyCode==='USD' && value.appliesOnEachItem===false
    && d.customerGets.items.__typename==='AllDiscountItems' && d.customerGets.items.allItems===true
    && (input.minimumSubtotal===0 ? minimum===null : minimum?.__typename==='DiscountMinimumSubtotal' && Number(minimum.greaterThanOrEqualToSubtotal?.amount)===input.minimumSubtotal && minimum.greaterThanOrEqualToSubtotal?.currencyCode==='USD')
    && d.combinesWith.orderDiscounts===false && d.combinesWith.productDiscounts===false && d.combinesWith.shippingDiscounts===true;
}
export async function ensureRewardDiscount(input: { code: string; title: string; customerId: string; amount: number; minimumSubtotal: number }) {
  if (!Number.isFinite(input.amount) || input.amount<=0 || Number(input.amount.toFixed(2))!==input.amount || !Number.isFinite(input.minimumSubtotal) || input.minimumSubtotal<0 || Number(input.minimumSubtotal.toFixed(2))!==input.minimumSubtotal) throw new RewardBlocked('USD reward settings must use whole cents',true);
  const data = await query<{ codeDiscountNodeByCode: { id: string; codeDiscount: DiscountSnapshot } | null }>(`query ReferralDiscount($code: String!) { codeDiscountNodeByCode(code: $code) { id codeDiscount { __typename ... on DiscountCodeBasic { title usageLimit appliesOncePerCustomer startsAt endsAt codes(first: 2) { nodes { code } pageInfo { hasNextPage } } context { __typename ... on DiscountCustomers { customers { id } } } customerGets { items { __typename ... on AllDiscountItems { allItems } } value { __typename ... on DiscountAmount { amount { amount currencyCode } appliesOnEachItem } } } minimumRequirement { __typename ... on DiscountMinimumSubtotal { greaterThanOrEqualToSubtotal { amount currencyCode } } } combinesWith { orderDiscounts productDiscounts shippingDiscounts } } } } }`, { code: input.code });
  if (data.codeDiscountNodeByCode) {
    if (!validRewardDiscount(data.codeDiscountNodeByCode.codeDiscount, input)) throw new RewardBlocked('Existing Shopify code has incompatible restrictions; manual reconciliation required', true);
    return data.codeDiscountNodeByCode.id;
  }
  const result = await createDiscountCode(input);
  if (!result.id) throw new RewardBlocked('Shopify discount creation failed; retry will query the same code');
  // Re-read after creation too: a mutation response containing only an ID is not sufficient evidence.
  return ensureExistingRewardDiscount(input, result.id);
}
async function ensureExistingRewardDiscount(input: Parameters<typeof ensureRewardDiscount>[0], id: string): Promise<string> {
  // Recursion uses a read-first path, never a fresh identity/code; no recursive create on eventual consistency.
  const result = await query<{ node: { id: string; codeDiscount: DiscountSnapshot } | null }>(`query ReferralCreatedDiscount($code: String!) { node: codeDiscountNodeByCode(code: $code) { id codeDiscount { __typename ... on DiscountCodeBasic { title usageLimit appliesOncePerCustomer startsAt endsAt codes(first: 2) { nodes { code } pageInfo { hasNextPage } } context { __typename ... on DiscountCustomers { customers { id } } } customerGets { items { __typename ... on AllDiscountItems { allItems } } value { __typename ... on DiscountAmount { amount { amount currencyCode } appliesOnEachItem } } } minimumRequirement { __typename ... on DiscountMinimumSubtotal { greaterThanOrEqualToSubtotal { amount currencyCode } } } combinesWith { orderDiscounts productDiscounts shippingDiscounts } } } } }`, { code: input.code });
  if (!result.node) throw new RewardBlocked('Created discount not yet readable; retry with fixed code');
  if (result.node.id!==id || !validRewardDiscount(result.node.codeDiscount,input)) throw new RewardBlocked('Created discount restrictions differ from expected',true);
  return id;
}
