// Shopify Storefront API — Cart mutations
// Flow: cartCreate → get checkoutUrl → redirect user to Shopify checkout

export const CREATE_CART_MUTATION = `
  mutation cartCreate($input: CartInput!) {
    cartCreate(input: $input) {
      cart {
        id
        checkoutUrl
        cost {
          totalAmount {
            amount
            currencyCode
          }
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export type CartLine = {
  merchandiseId: string;  // gid://shopify/ProductVariant/XXXXX
  quantity: number;
};

export type CartCreateResult = {
  cartCreate: {
    cart: {
      id: string;
      checkoutUrl: string;
      cost: { totalAmount: { amount: string; currencyCode: string } };
    };
    userErrors: { field: string[]; message: string }[];
  };
};
