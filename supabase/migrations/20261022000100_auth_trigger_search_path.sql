-- Harden the two auth signup trigger functions created by the original schema.
-- Their table references are already fully qualified, so an empty search_path is safe.

ALTER FUNCTION public.handle_new_user()
  SET search_path = '';

ALTER FUNCTION public.handle_new_membership()
  SET search_path = '';

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_membership() FROM PUBLIC, anon, authenticated;
