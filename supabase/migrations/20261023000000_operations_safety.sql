-- Preserve audit history if an administrator account is removed, and prevent a
-- deletion request from being marked complete before customer data is actually handled.
SET lock_timeout = '5s';
SET statement_timeout = '60s';

ALTER TABLE public.operations_audit_log
  DROP CONSTRAINT IF EXISTS operations_audit_log_admin_user_id_fkey;
ALTER TABLE public.operations_audit_log
  ALTER COLUMN admin_user_id DROP NOT NULL;
ALTER TABLE public.operations_audit_log
  ADD CONSTRAINT operations_audit_log_admin_user_id_fkey
  FOREIGN KEY (admin_user_id) REFERENCES auth.users(id) ON DELETE SET NULL NOT VALID;
ALTER TABLE public.operations_audit_log
  VALIDATE CONSTRAINT operations_audit_log_admin_user_id_fkey;

CREATE OR REPLACE FUNCTION public.update_account_deletion_request_admin(
  p_request_id uuid,
  p_status text,
  p_reason text,
  p_admin_user_id uuid
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_request public.account_deletion_requests%ROWTYPE;
BEGIN
  SELECT * INTO v_request FROM public.account_deletion_requests
  WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Deletion request not found'; END IF;
  IF NOT ((v_request.status = 'requested' AND p_status IN ('processing','cancelled')) OR
          (v_request.status = 'processing' AND p_status IN ('completed','cancelled'))) THEN
    RAISE EXCEPTION 'Invalid deletion request transition';
  END IF;
  IF p_status = 'completed' AND length(trim(coalesce(p_reason,''))) < 20 THEN
    RAISE EXCEPTION 'Completion evidence is required';
  END IF;

  UPDATE public.account_deletion_requests
  SET status = p_status,
      reason = nullif(left(trim(coalesce(p_reason, '')), 1000), ''),
      processed_by = p_admin_user_id,
      updated_at = now(),
      completed_at = CASE WHEN p_status='completed' THEN now() ELSE NULL END,
      retention_until = NULL
  WHERE id = p_request_id;

  INSERT INTO public.operations_audit_log(admin_user_id,action,target_type,target_id,metadata)
  VALUES(p_admin_user_id,'account_deletion_status_updated','account_deletion_request',p_request_id::text,
    jsonb_build_object('from',v_request.status,'to',p_status));
END $$;

REVOKE ALL ON FUNCTION public.update_account_deletion_request_admin(uuid,text,text,uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.update_account_deletion_request_admin(uuid,text,text,uuid)
  TO service_role;
