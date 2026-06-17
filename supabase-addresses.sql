-- ═══════════════════════════════════════════════════════════════
--  Velour Shop — Addresses Table
--  Run in: Supabase Dashboard → SQL Editor → New query
-- ═══════════════════════════════════════════════════════════════

-- Ensure set_updated_at function exists (safe to re-run)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.addresses (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  full_name     TEXT        NOT NULL,
  phone         TEXT,
  address_line1 TEXT        NOT NULL,
  address_line2 TEXT,
  city          TEXT        NOT NULL,
  state         TEXT        NOT NULL,
  zip           TEXT        NOT NULL,
  country       TEXT        NOT NULL DEFAULT 'US',
  is_default    BOOLEAN     NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "addresses: user can manage own"
  ON public.addresses FOR ALL
  USING (auth.uid() = user_id);

CREATE TRIGGER addresses_updated_at
  BEFORE UPDATE ON public.addresses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
