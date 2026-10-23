-- Persist a stable product identity for future verified-purchase reviews.
-- Historical rows remain NULL because guessing their identity would be unsafe.
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS shopify_product_id text;
CREATE INDEX IF NOT EXISTS order_items_shopify_product_idx ON public.order_items(shopify_product_id) WHERE shopify_product_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.user_has_paid_product(p_product_id text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(
  SELECT 1 FROM public.order_items oi JOIN public.orders o ON o.id=oi.order_id
  WHERE o.user_id=auth.uid() AND o.financial_status='paid'
    AND oi.shopify_product_id=nullif(regexp_replace(btrim(p_product_id),'^gid://shopify/Product/',''),'')
 );
$$;
REVOKE ALL ON FUNCTION public.user_has_paid_product(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.user_has_paid_product(text) TO authenticated;
