import { expect, test } from '@playwright/test';
import { admin, asUser, sessionCookieHeader } from '../helpers/supabase';
import { SEED, USERS, userIdFor } from '../helpers/seed';

test('address RPCs preserve exactly one default and promote one after deletion', async () => {
  const userId = await userIdFor(USERS.alice);
  const db = admin();
  await db.from('addresses').delete().eq('user_id', userId);
  const alice = await asUser(USERS.alice);
  const input = (name: string, isDefault: boolean) => ({
    p_id: null, p_full_name: name, p_phone: null, p_address_line1: '1 Test Street',
    p_address_line2: null, p_city: 'Austin', p_state: 'TX', p_zip: '78701',
    p_country: 'US', p_is_default: isDefault,
  });
  const first = await alice.rpc('save_user_address', input('First', false));
  const second = await alice.rpc('save_user_address', input('Second', true));
  expect(first.error).toBeNull(); expect(second.error).toBeNull();
  let rows = (await db.from('addresses').select('id,full_name,is_default').eq('user_id', userId)).data ?? [];
  expect(rows.filter((row) => row.is_default)).toEqual([expect.objectContaining({ id: second.data })]);
  expect((await alice.rpc('set_default_user_address', { p_id: first.data })).error).toBeNull();
  rows = (await db.from('addresses').select('id,full_name,is_default').eq('user_id', userId)).data ?? [];
  expect(rows.filter((row) => row.is_default)).toEqual([expect.objectContaining({ id: first.data })]);
  expect((await alice.rpc('save_user_address', { ...input('First updated', true), p_id: first.data })).error).toBeNull();
  expect((await alice.rpc('set_default_user_address', { p_id: second.data })).error).toBeNull();
  expect((await alice.rpc('delete_user_address', { p_id: second.data })).error).toBeNull();
  rows = (await db.from('addresses').select('id,full_name,is_default').eq('user_id', userId)).data ?? [];
  expect(rows).toEqual([expect.objectContaining({ id: first.data, is_default: true })]);
  await db.from('addresses').delete().eq('user_id', userId);
});

test('account deletion can only complete after an audited manual runbook attestation', async ({ request }) => {
  const db = admin();
  const customerId = await userIdFor(USERS.mallory);
  const adminEmail = `deletion-admin-${crypto.randomUUID()}@test.local`;
  const createdAdmin = await db.auth.admin.createUser({
    email: adminEmail,
    password: 'Test1234!',
    email_confirm: true,
    app_metadata: { role: 'admin' },
  });
  expect(createdAdmin.error).toBeNull();
  const adminId = createdAdmin.data.user!.id;
  await db.from('account_deletion_requests' as never).delete().eq('user_id', customerId);
  const inserted = await db.from('account_deletion_requests' as never).insert({
    user_id: customerId,
    email: USERS.mallory,
    status: 'requested',
  } as never).select('id').single();
  expect(inserted.error).toBeNull();
  const requestId = (inserted.data as unknown as { id: string }).id;

  try {
    const headers = { cookie: await sessionCookieHeader(adminEmail) };
    const processing = await request.post(`/api/admin/operations/deletions/${requestId}`, {
      headers,
      data: { status: 'processing', reason: 'Identity and scope verified.' },
    });
    expect(processing.status(), await processing.text()).toBe(200);

    const unverifiedCompletion = await request.post(`/api/admin/operations/deletions/${requestId}`, {
      headers,
      data: { status: 'completed', reason: 'Customer data was manually removed.' },
    });
    expect(unverifiedCompletion.status()).toBe(400);

    const completed = await request.post(`/api/admin/operations/deletions/${requestId}`, {
      headers,
      data: {
        status: 'completed',
        reason: 'Supabase Auth and customer data deletion runbook completed and verified.',
        attestation: 'DELETE COMPLETED',
      },
    });
    expect(completed.status(), await completed.text()).toBe(200);
    const row = await db.from('account_deletion_requests' as never)
      .select('status,completed_at,processed_by').eq('id', requestId).single();
    expect(row.data).toMatchObject({ status: 'completed', processed_by: adminId });
    expect((row.data as unknown as { completed_at: string | null }).completed_at).toBeTruthy();
    const audit = await db.from('operations_audit_log' as never)
      .select('action,target_id').eq('target_id', requestId).eq('action', 'account_deletion_status_updated');
    expect(audit.data).toHaveLength(2);
  } finally {
    await db.from('operations_audit_log' as never).delete().eq('target_id', requestId);
    await db.from('account_deletion_requests' as never).delete().eq('id', requestId);
    await db.auth.admin.deleteUser(adminId);
  }
});

test('verified purchase is derived from a paid owned order and never from client input', async ({ request }) => {
  const db = admin();
  const { data: order } = await db.from('orders').select('id,order_items(id)').eq('shopify_order_id', SEED.aliceOrderShopifyId).single();
  const itemId = order!.order_items[0].id;
  await db.from('order_items').update({ shopify_product_id: '987654' }).eq('id', itemId);
  const alice = await asUser(USERS.alice);
  const bob = await asUser(USERS.bob);
  expect((await alice.rpc('user_has_paid_product', { p_product_id: 'gid://shopify/Product/987654' })).data).toBe(true);
  expect((await bob.rpc('user_has_paid_product', { p_product_id: '987654' })).data).toBe(false);

  const response = await request.post('/api/reviews', {
    headers: { cookie: await sessionCookieHeader(USERS.alice), 'x-forwarded-for': `verified-${crypto.randomUUID()}` },
    data: { product_id: 'gid://shopify/Product/987654', product_handle: 'verified-item', rating: 5, body_text: 'This paid item fits exactly as expected.', verified_purchase: false },
  });
  expect(response.ok()).toBe(true);
  const review = (await response.json()).review;
  expect(review.verified_purchase).toBe(true);
  await db.from('reviews').delete().eq('id', review.id);
  await db.from('order_items').update({ shopify_product_id: null }).eq('id', itemId);
});

test('review API paginates approved reviews without exposing private fields', async ({ request }) => {
  const db = admin();
  const productId = `e2e-pagination-${crypto.randomUUID()}`;
  const rows = Array.from({ length: 22 }, (_, index) => ({
    product_id: productId, product_handle: 'pagination', rating: 5,
    body: `Pagination review number ${index} is long enough.`, nickname: 'Shopper',
    email: `private-${index}@test.local`, approved: true,
    created_at: '2026-10-23T12:00:00.000Z',
  }));
  await db.from('reviews').insert(rows);
  const first = await (await request.get(`/api/reviews?product_id=${encodeURIComponent(productId)}`)).json();
  expect(first.reviews).toHaveLength(20);
  expect(first.nextCursor).toBeTruthy();
  expect(first.reviews[0]).not.toHaveProperty('email');
  const second = await (await request.get(`/api/reviews?product_id=${encodeURIComponent(productId)}&before=${encodeURIComponent(first.nextCursor)}`)).json();
  expect(second.reviews).toHaveLength(2);
  expect(second.nextCursor).toBeNull();
  const returnedIds = [...first.reviews, ...second.reviews].map((review: { id: string }) => review.id);
  expect(new Set(returnedIds).size).toBe(22);
  await db.from('reviews').delete().eq('product_id', productId);
});
