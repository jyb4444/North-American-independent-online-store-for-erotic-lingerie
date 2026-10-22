BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.create_return_request_atomic(
  p_user_id uuid,
  p_order_id uuid,
  p_request_number text,
  p_desired_resolution text,
  p_reason text,
  p_policy_notes text[],
  p_customer_note text,
  p_media_urls text[],
  p_items jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request_id uuid;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'service role required' USING ERRCODE = '42501';
  END IF;

  -- Serialise submissions for one order so concurrent requests cannot claim the
  -- same remaining quantity after independently passing a preflight check.
  PERFORM 1
  FROM public.orders
  WHERE id = p_order_id AND user_id = p_user_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Select at least one item';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_items) AS requested(order_item_id uuid, quantity integer, item_condition text, reason_detail text)
    LEFT JOIN public.order_items oi ON oi.id = requested.order_item_id AND oi.order_id = p_order_id
    WHERE oi.id IS NULL OR requested.quantity IS NULL OR requested.quantity <= 0
  ) THEN
    RAISE EXCEPTION 'Invalid return item';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_items) AS requested(order_item_id uuid, quantity integer, item_condition text, reason_detail text)
    JOIN public.order_items oi ON oi.id = requested.order_item_id
    LEFT JOIN LATERAL (
      SELECT coalesce(sum(rri.quantity), 0)::integer AS quantity
      FROM public.return_request_items rri
      JOIN public.return_requests rr ON rr.id = rri.return_request_id
      WHERE rri.order_item_id = requested.order_item_id
        AND rr.status NOT IN ('rejected', 'refunded', 'exchanged', 'reshipped', 'closed')
    ) active ON true
    WHERE requested.quantity + active.quantity > oi.quantity
  ) THEN
    RAISE EXCEPTION 'One or more items are already part of an open request';
  END IF;

  INSERT INTO public.return_requests (
    user_id, order_id, request_number, desired_resolution, reason,
    eligibility_status, status, policy_notes, customer_note, media_urls
  ) VALUES (
    p_user_id, p_order_id, p_request_number, p_desired_resolution, p_reason,
    'review_required', 'submitted', p_policy_notes, p_customer_note, p_media_urls
  ) RETURNING id INTO v_request_id;

  INSERT INTO public.return_request_items (
    return_request_id, order_item_id, quantity, item_condition, reason_detail
  )
  SELECT v_request_id, requested.order_item_id, requested.quantity,
         requested.item_condition, requested.reason_detail
  FROM jsonb_to_recordset(p_items) AS requested(
    order_item_id uuid, quantity integer, item_condition text, reason_detail text
  );

  INSERT INTO public.return_request_events (
    return_request_id, event_type, title, description, metadata
  ) VALUES (
    v_request_id, 'submitted', 'Return request submitted',
    array_to_string(p_policy_notes, ' '),
    jsonb_build_object('eligibility_status', 'review_required')
  );

  RETURN v_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_return_request_atomic(uuid,uuid,text,text,text,text[],text,text[],jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_return_request_atomic(uuid,uuid,text,text,text,text[],text,text[],jsonb)
  TO service_role;

COMMIT;
