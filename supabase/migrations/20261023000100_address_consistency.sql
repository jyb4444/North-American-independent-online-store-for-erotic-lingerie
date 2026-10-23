-- Atomic address mutations. Existing rows are left unchanged.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.addresses WHERE is_default GROUP BY user_id HAVING count(*)>1) THEN
  RAISE EXCEPTION 'addresses: a user has more than one default address';
 END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS addresses_one_default_per_user_idx ON public.addresses(user_id) WHERE is_default;

CREATE OR REPLACE FUNCTION public.save_user_address(p_id uuid,p_full_name text,p_phone text,p_address_line1 text,p_address_line2 text,p_city text,p_state text,p_zip text,p_country text,p_is_default boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user uuid:=auth.uid(); v_id uuid; v_default boolean;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 IF nullif(btrim(p_full_name),'') IS NULL OR nullif(btrim(p_address_line1),'') IS NULL OR nullif(btrim(p_city),'') IS NULL OR nullif(btrim(p_state),'') IS NULL OR nullif(btrim(p_zip),'') IS NULL OR nullif(btrim(p_country),'') IS NULL THEN RAISE EXCEPTION 'Required address fields cannot be empty'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(v_user::text,0));
 v_default:=coalesce(p_is_default,false) OR NOT EXISTS(SELECT 1 FROM public.addresses WHERE user_id=v_user);
 IF p_id IS NULL THEN
  INSERT INTO public.addresses(user_id,full_name,phone,address_line1,address_line2,city,state,zip,country,is_default)
  VALUES(v_user,btrim(p_full_name),nullif(btrim(p_phone),''),btrim(p_address_line1),nullif(btrim(p_address_line2),''),btrim(p_city),btrim(p_state),btrim(p_zip),upper(btrim(p_country)),false) RETURNING id INTO v_id;
 ELSE
  UPDATE public.addresses SET full_name=btrim(p_full_name),phone=nullif(btrim(p_phone),''),address_line1=btrim(p_address_line1),address_line2=nullif(btrim(p_address_line2),''),city=btrim(p_city),state=btrim(p_state),zip=btrim(p_zip),country=upper(btrim(p_country)),updated_at=now() WHERE id=p_id AND user_id=v_user RETURNING id INTO v_id;
  IF v_id IS NULL THEN RAISE EXCEPTION 'Address not found'; END IF;
 END IF;
 IF v_default THEN
  UPDATE public.addresses SET is_default=false,updated_at=now() WHERE user_id=v_user AND is_default AND id<>v_id;
  UPDATE public.addresses SET is_default=true,updated_at=CASE WHEN is_default THEN updated_at ELSE now() END WHERE id=v_id AND user_id=v_user;
 END IF;
 RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.set_default_user_address(p_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user uuid:=auth.uid();
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(v_user::text,0));
 IF NOT EXISTS(SELECT 1 FROM public.addresses WHERE id=p_id AND user_id=v_user) THEN RAISE EXCEPTION 'Address not found'; END IF;
 UPDATE public.addresses SET is_default=false,updated_at=now() WHERE user_id=v_user AND is_default AND id<>p_id;
 UPDATE public.addresses SET is_default=true,updated_at=CASE WHEN is_default THEN updated_at ELSE now() END WHERE id=p_id AND user_id=v_user;
END $$;

CREATE OR REPLACE FUNCTION public.delete_user_address(p_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user uuid:=auth.uid(); v_default boolean;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(v_user::text,0));
 DELETE FROM public.addresses WHERE id=p_id AND user_id=v_user RETURNING is_default INTO v_default;
 IF v_default IS NULL THEN RAISE EXCEPTION 'Address not found'; END IF;
 IF v_default THEN UPDATE public.addresses SET is_default=true,updated_at=now() WHERE id=(SELECT id FROM public.addresses WHERE user_id=v_user ORDER BY created_at DESC,id DESC LIMIT 1); END IF;
END $$;

REVOKE ALL ON FUNCTION public.save_user_address(uuid,text,text,text,text,text,text,text,text,boolean) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.set_default_user_address(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.delete_user_address(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_user_address(uuid,text,text,text,text,text,text,text,text,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_default_user_address(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user_address(uuid) TO authenticated;
