-- Durable delivery for transactional email, newsletter confirmation, and restock alerts.
SET lock_timeout = '5s';
SET statement_timeout = '60s';

CREATE TABLE public.newsletter_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','unsubscribed')),
  confirmation_token_hash text UNIQUE,
  unsubscribe_token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  CONSTRAINT newsletter_subscribers_email_normalized CHECK (email = lower(btrim(email))),
  CONSTRAINT newsletter_subscribers_email_key UNIQUE (email)
);

CREATE TABLE public.notification_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('return_customer','return_merchant','newsletter_confirmation','newsletter_welcome','restock')),
  identity text NOT NULL UNIQUE,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','sent','failed','manual_review')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  provider_message_id text,
  lease_token uuid,
  lease_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.newsletter_subscribers, public.notification_jobs FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.newsletter_subscribers, public.notification_jobs TO service_role;

CREATE INDEX notification_jobs_due_idx ON public.notification_jobs (next_attempt_at)
  WHERE status IN ('pending','failed','processing');

CREATE OR REPLACE FUNCTION public.lease_notification_jobs(p_limit integer DEFAULT 25)
RETURNS SETOF public.notification_jobs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.notification_jobs
     SET status = 'manual_review', last_error = coalesce(last_error, 'Retry budget exhausted'),
         lease_token = NULL, lease_until = NULL
   WHERE attempts >= 8 AND status IN ('pending','failed','processing');

  RETURN QUERY
  WITH due AS (
    SELECT id FROM public.notification_jobs
     WHERE status IN ('pending','failed','processing')
       AND attempts < 8 AND next_attempt_at <= now()
       AND (lease_until IS NULL OR lease_until < now())
     ORDER BY next_attempt_at, created_at
     FOR UPDATE SKIP LOCKED LIMIT greatest(1, least(p_limit, 100))
  )
  UPDATE public.notification_jobs j
     SET status = 'processing', attempts = j.attempts + 1,
         lease_token = gen_random_uuid(), lease_until = now() + interval '5 minutes'
    FROM due WHERE j.id = due.id
  RETURNING j.*;
END;
$$;

REVOKE ALL ON FUNCTION public.lease_notification_jobs(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lease_notification_jobs(integer) TO service_role;

ALTER TABLE public.restock_alerts
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_error text;

REVOKE ALL ON public.restock_alerts FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restock_alerts TO service_role;
