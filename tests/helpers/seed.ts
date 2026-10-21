import { admin, TEST_PASSWORD } from './supabase';

export const USERS = {
  alice: 'alice@test.local',
  bob: 'bob@test.local',
  /** Attacker account used by tests that mutate the attacker's own rows. */
  mallory: 'mallory@test.local',
  /** Exists to show that `ILIKE` treats `_` in an order email as a wildcard. */
  axb: 'axb@test.local',
  /** Created and deleted inside the referral test. */
  newbie: 'newbie@test.local',
} as const;

export const SEED = {
  giftCardCode: 'E2E1-AAAA-BBBB-CCCC',
  bobReferralCode: 'SL-BOBE2E-0001',
  bobOrderShopifyId: 'e2e-order-bob-2001',
  productId: 'e2e-product-1',
  aliceOrderShopifyId: 'e2e-order-alice-1001',
  aliceOrderNumber: '1001',
  aliceTrackingToken: 'tok-alice-1001-e2e',
} as const;

const TEST_EMAIL_SUFFIX = '@test.local';

function check<T>(label: string, result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(`Seed step "${label}" failed: ${result.error.message}`);
  return result.data;
}

function row<T>(label: string, result: { data: T; error: { message: string } | null }): NonNullable<T> {
  const data = check(label, result);
  if (!data) throw new Error(`Seed step "${label}" returned no row`);
  return data;
}

async function deleteTestUsers() {
  const db = admin();
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    for (const user of data.users) {
      if (user.email?.endsWith(TEST_EMAIL_SUFFIX)) {
        // The production catalog intentionally keeps five NO ACTION FKs. Cleanup only
        // verified @test.local users, so drift-matrix tests do not require CASCADE changes.
        for (const [table, column] of [['profiles','id'],['memberships','user_id'],['wishlists','user_id'],['cart_snapshots','user_id'],['referrals','referrer_id']]) {
          check(`delete test ${table}`, await db.from(table).delete().eq(column,user.id));
        }
        const { error: deleteError } = await db.auth.admin.deleteUser(user.id);
        if (deleteError) throw new Error(`deleteUser ${user.email} failed: ${deleteError.message}`);
      }
    }
    if (data.users.length < 200) break;
  }
}

async function deleteTestRows() {
  const db = admin();
  const { data: orders } = await db.from('orders').select('id').like('shopify_order_id', 'e2e-%');
  const orderIds = (orders ?? []).map((order) => order.id);
  if (orderIds.length) {
    check('delete return_requests', await db.from('return_requests').delete().in('order_id', orderIds));
    check('delete orders', await db.from('orders').delete().in('id', orderIds));
  }
  check('delete reviews', await db.from('reviews').delete().like('product_id', 'e2e-%'));
  check('delete gift_cards', await db.from('gift_cards').delete().like('code', 'E2E%'));
  check('delete referrals', await db.from('referrals').delete().like('code', 'SL-%E2E%'));
}

async function createUser(email: string): Promise<string> {
  const { data, error } = await admin().auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { first_name: email.split('@')[0] },
  });
  if (error || !data.user) throw new Error(`createUser ${email} failed: ${error?.message}`);
  return data.user.id;
}

/** Wipes everything owned by *@test.local / e2e-* and recreates a known data set. */
export async function resetAndSeed() {
  await deleteTestRows();
  await deleteTestUsers();

  const ids = {
    alice: await createUser(USERS.alice),
    bob: await createUser(USERS.bob),
    mallory: await createUser(USERS.mallory),
    axb: await createUser(USERS.axb),
  };

  const db = admin();

  check('gift card', await db.from('gift_cards').insert({
    code: SEED.giftCardCode,
    amount: 50,
    balance: 50,
    recipient_email: 'someone-else@test.local',
    recipient_name: 'Someone Else',
    sender_name: 'E2E',
    message: '',
    is_redeemed: false,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 365 * 86_400_000).toISOString(),
  }));

  // Bob's private data — Alice must never be able to read or change any of it.
  check('bob address', await db.from('addresses').insert({
    user_id: ids.bob,
    full_name: 'Bob Private',
    phone: '+1 555 0100',
    address_line1: '1 Private Lane',
    city: 'Bobville',
    state: 'CA',
    zip: '90001',
    is_default: true,
  }));
  check('bob wishlist', await db.from('wishlists').insert({
    user_id: ids.bob,
    product_id: SEED.productId,
    product_handle: 'e2e-product',
    product_title: 'E2E Lace Set',
  }));
  check('bob cart', await db.from('cart_snapshots').insert({
    user_id: ids.bob,
    email: USERS.bob,
    items: [{ productId: SEED.productId, variantId: 'v1', title: 'E2E Lace Set', quantity: 1, price: 30 }],
  }));
  check('bob referral', await db.from('referrals').insert({
    referrer_id: ids.bob,
    code: SEED.bobReferralCode,
  }));
  check('bob pending review', await db.from('reviews').insert({
    user_id: ids.bob,
    product_id: SEED.productId,
    product_handle: 'e2e-product',
    rating: 2,
    body: 'Bob private pending review text',
    nickname: 'bob***@test.local',
    email: USERS.bob,
    approved: false,
  }));

  check('bob approved review', await db.from('reviews').insert({
    user_id: ids.bob,
    product_id: SEED.productId,
    product_handle: 'e2e-product',
    rating: 5,
    body: 'Bob public approved review text',
    nickname: 'bob***@test.local',
    email: USERS.bob,
    approved: true,
  }));

  const order = row('bob order', await db.from('orders').insert({
    user_id: ids.bob,
    shopify_order_id: SEED.bobOrderShopifyId,
    shopify_order_number: '2001',
    email: USERS.bob,
    phone: '+1 555 0100',
    financial_status: 'paid',
    total_amount: 30,
  }).select('id').single());
  const orderItem = row('bob order item', await db.from('order_items').insert({
    order_id: order.id,
    shopify_line_item_id: 'e2e-line-1',
    title: 'E2E Lace Set',
    quantity: 1,
    price: 30,
  }).select('id').single());
  const returnRequest = row('bob return', await db.from('return_requests').insert({
    user_id: ids.bob,
    order_id: order.id,
    request_number: 'RMA-E2E-BOB',
    desired_resolution: 'return_refund',
    reason: 'size_fit',
    status: 'submitted',
  }).select('id').single());
  check('bob return item', await db.from('return_request_items').insert({
    return_request_id: returnRequest.id,
    order_item_id: orderItem.id,
    quantity: 1,
    item_condition: 'unopened_tags_attached',
  }));

  // Alice's delivered order: drives orders, tracking and returns journeys.
  const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
  const aliceOrder = row('alice order', await db.from('orders').insert({
    user_id: ids.alice,
    shopify_order_id: SEED.aliceOrderShopifyId,
    shopify_order_number: SEED.aliceOrderNumber,
    email: USERS.alice,
    financial_status: 'paid',
    fulfillment_status: 'fulfilled',
    total_amount: 98,
    processed_at: daysAgo(8),
  }).select('id').single());
  check('alice order items', await db.from('order_items').insert([
    { order_id: aliceOrder.id, shopify_line_item_id: 'e2e-alice-line-1', title: 'E2E Satin Robe', quantity: 2, price: 34, return_category: 'general' },
    { order_id: aliceOrder.id, shopify_line_item_id: 'e2e-alice-line-2', title: 'E2E Lace Thong', quantity: 1, price: 30, return_category: 'underwear' },
  ]));
  const shipment = row('alice shipment', await db.from('shipments').insert({
    order_id: aliceOrder.id,
    tracking_number: 'E2ETRACK1001',
    tracking_url: 'https://tools.usps.com/go/TrackConfirmAction?tLabels=E2ETRACK1001',
    carrier: 'USPS',
    status: 'delivered',
    shipped_at: daysAgo(7),
    delivered_at: daysAgo(5),
    public_lookup_token: SEED.aliceTrackingToken,
  }).select('id').single());
  check('alice shipment events', await db.from('shipment_events').insert([
    { shipment_id: shipment.id, status: 'shipped', title: 'Shipped', occurred_at: daysAgo(7) },
    { shipment_id: shipment.id, status: 'delivered', title: 'Delivered', occurred_at: daysAgo(5) },
  ]));

  return ids;
}

export async function userIdFor(email: string): Promise<string> {
  for (let page = 1; ; page++) {
    const { data, error } = await admin().auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const user = data.users.find((candidate) => candidate.email === email);
    if (user) return user.id;
    if (data.users.length < 200) throw new Error(`No auth user ${email}`);
  }
}
