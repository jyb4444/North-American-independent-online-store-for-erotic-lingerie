// ─── Fragments ────────────────────────────────────────────────────────────────

const PRODUCT_FRAGMENT = `
  fragment ProductFields on Product {
    id
    handle
    title
    description
    priceRange {
      minVariantPrice { amount currencyCode }
    }
    compareAtPriceRange {
      minVariantPrice { amount currencyCode }
    }
    images(first: 5) {
      edges { node { url altText } }
    }
    tags
    variants(first: 20) {
      edges {
        node {
          id
          title
          sku
          quantityAvailable
          selectedOptions { name value }
          price { amount currencyCode }
        }
      }
    }
  }
`;

// ─── Products ─────────────────────────────────────────────────────────────────

export const GET_PRODUCTS = `
  ${PRODUCT_FRAGMENT}
  query GetProducts($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      pageInfo { hasNextPage endCursor }
      edges { node { ...ProductFields } }
    }
  }
`;

export const GET_PRODUCT_BY_HANDLE = `
  ${PRODUCT_FRAGMENT}
  query GetProductByHandle($handle: String!) {
    product(handle: $handle) { ...ProductFields }
  }
`;

// ─── Collections ──────────────────────────────────────────────────────────────

export const GET_COLLECTIONS = `
  query GetCollections($first: Int!) {
    collections(first: $first) {
      edges {
        node {
          id
          handle
          title
          description
          image { url altText }
        }
      }
    }
  }
`;

export const GET_COLLECTION_PRODUCTS = `
  ${PRODUCT_FRAGMENT}
  query GetCollectionProducts($handle: String!, $first: Int!, $after: String) {
    collection(handle: $handle) {
      id
      title
      description
      products(first: $first, after: $after) {
        pageInfo { hasNextPage endCursor }
        edges { node { ...ProductFields } }
      }
    }
  }
`;

// ─── Cart ─────────────────────────────────────────────────────────────────────

export const CREATE_CART = `
  mutation CreateCart($lines: [CartLineInput!]) {
    cartCreate(input: { lines: $lines }) {
      cart {
        id
        checkoutUrl
        totalQuantity
        cost { totalAmount { amount currencyCode } }
        lines(first: 20) {
          edges {
            node {
              id
              quantity
              merchandise {
                ... on ProductVariant {
                  id
                  title
                  product { title images(first: 1) { edges { node { url } } } }
                  price { amount currencyCode }
                }
              }
            }
          }
        }
      }
    }
  }
`;

export const ADD_CART_LINES = `
  mutation AddCartLines($cartId: ID!, $lines: [CartLineInput!]!) {
    cartLinesAdd(cartId: $cartId, lines: $lines) {
      cart { id totalQuantity cost { totalAmount { amount currencyCode } } }
    }
  }
`;

export const REMOVE_CART_LINES = `
  mutation RemoveCartLines($cartId: ID!, $lineIds: [ID!]!) {
    cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
      cart { id totalQuantity cost { totalAmount { amount currencyCode } } }
    }
  }
`;

// ─── Customer ─────────────────────────────────────────────────────────────────

export const GET_CUSTOMER = `
  query GetCustomer($customerAccessToken: String!) {
    customer(customerAccessToken: $customerAccessToken) {
      id
      firstName
      lastName
      email
      metafield(namespace: "membership", key: "tier") { value }
      orders(first: 10) {
        edges {
          node {
            id
            orderNumber
            totalPrice { amount currencyCode }
            processedAt
            fulfillmentStatus
          }
        }
      }
    }
  }
`;
