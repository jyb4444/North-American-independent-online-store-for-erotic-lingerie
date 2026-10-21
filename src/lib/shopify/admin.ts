type ShopifyAdminResult<T> = {
  data: T | null;
  error: string | null;
  skipped: boolean;
};

function getShopifyAdminConfig() {
  const domain = process.env.NEXT_PUBLIC_SHOPIFY_DOMAIN;
  const token = process.env.SHOPIFY_ADMIN_TOKEN;

  if (!domain || domain === 'your-store.myshopify.com' || !token || token === 'your-admin-api-token') {
    return null;
  }

  return {
    // E2E_SHOPIFY_ADMIN_URL is only set by the test environment (local mock Admin API).
    endpoint: process.env.E2E_SHOPIFY_ADMIN_URL || `https://${domain}/admin/api/2026-01/graphql.json`,
    token,
  };
}

export function toShopifyOrderGid(orderId: string) {
  if (orderId.startsWith('gid://shopify/Order/')) return orderId;
  return `gid://shopify/Order/${orderId}`;
}

export async function shopifyAdminFetch<T>({
  query,
  variables,
}: {
  query: string;
  variables?: Record<string, unknown>;
}): Promise<ShopifyAdminResult<T>> {
  const config = getShopifyAdminConfig();
  if (!config) {
    return { data: null, error: 'Shopify Admin API is not configured', skipped: true };
  }

  const res = await fetch(config.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': config.token,
    },
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
    signal: AbortSignal.timeout(6_000),
  });

  if (!res.ok) {
    return { data: null, error: `Shopify Admin API error: ${res.status}`, skipped: false };
  }

  const json = await res.json();
  if (json.errors?.length) {
    return { data: null, error: json.errors[0].message, skipped: false };
  }

  return { data: json.data as T, error: null, skipped: false };
}

export async function syncReturnRequestToShopify(input: {
  orderId: string;
  requestNumber: string;
  status: string;
  eligibilityStatus: string;
  reason: string;
  desiredResolution: string;
  itemTitles: string[];
}) {
  const ownerId = toShopifyOrderGid(input.orderId);
  const value = JSON.stringify({
    request_number: input.requestNumber,
    status: input.status,
    eligibility_status: input.eligibilityStatus,
    reason: input.reason,
    desired_resolution: input.desiredResolution,
    items: input.itemTitles,
    source: 'velour_platform',
    updated_at: new Date().toISOString(),
  });

  const result = await shopifyAdminFetch<{
    tagsAdd?: { userErrors: { message: string }[] };
    metafieldsSet?: { userErrors: { message: string }[] };
  }>({
    query: `
      mutation SyncReturnRequest($id: ID!, $tags: [String!]!, $metafields: [MetafieldsSetInput!]!) {
        tagsAdd(id: $id, tags: $tags) {
          userErrors { message }
        }
        metafieldsSet(metafields: $metafields) {
          userErrors { message }
        }
      }
    `,
    variables: {
      id: ownerId,
      tags: ['return-requested', `rma-${input.requestNumber}`],
      metafields: [{
        ownerId,
        namespace: 'velour',
        key: 'latest_return_request',
        type: 'json',
        value,
      }],
    },
  });

  if (result.error || result.skipped) return result;

  const userError =
    result.data?.tagsAdd?.userErrors?.[0]?.message ??
    result.data?.metafieldsSet?.userErrors?.[0]?.message ??
    null;

  return {
    data: result.data,
    error: userError,
    skipped: false,
  };
}

/**
 * Creates a single-use, fixed-amount order discount code (e.g. a referral reward).
 * Requires the Admin token to have the `write_discounts` scope.
 */
export async function createDiscountCode(input: {
  code: string;
  title: string;
  amount: number;
  minimumSubtotal?: number;
  customerId: string;
}): Promise<{ id: string | null; error: string | null; skipped: boolean }> {
  if (!/^gid:\/\/shopify\/Customer\/\d+$/.test(input.customerId)) throw new Error('Verified Shopify customer ID required');
  const result = await shopifyAdminFetch<{
    discountCodeBasicCreate: {
      codeDiscountNode: { id: string } | null;
      userErrors: { field: string[] | null; message: string; code: string | null }[];
    };
  }>({
    query: `
      mutation CreateRewardDiscount($basicCodeDiscount: DiscountCodeBasicInput!) {
        discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
          codeDiscountNode { id }
          userErrors { field message code }
        }
      }
    `,
    variables: {
      basicCodeDiscount: {
        title: input.title,
        code: input.code,
        startsAt: new Date().toISOString(),
        context: { customers: { add: [input.customerId] } },
        customerGets: {
          value: { discountAmount: { amount: input.amount.toFixed(2), appliesOnEachItem: false } },
          items: { all: true },
        },
        ...(input.minimumSubtotal
          ? { minimumRequirement: { subtotal: { greaterThanOrEqualToSubtotal: input.minimumSubtotal.toFixed(2) } } }
          : {}),
        appliesOncePerCustomer: true,
        usageLimit: 1,
        combinesWith: { orderDiscounts: false, productDiscounts: false, shippingDiscounts: true },
      },
    },
  });

  if (result.skipped || result.error) return { id: null, error: result.error, skipped: result.skipped };
  const payload = result.data?.discountCodeBasicCreate;
  const userError = payload?.userErrors?.[0]?.message ?? null;
  if (userError || !payload?.codeDiscountNode) {
    return { id: null, error: userError ?? 'Shopify did not create the discount', skipped: false };
  }
  return { id: payload.codeDiscountNode.id, error: null, skipped: false };
}
