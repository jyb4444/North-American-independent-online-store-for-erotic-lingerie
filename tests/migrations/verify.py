"""Only fixed, isolated databases in the self-love-e2e Docker container are writable.
Rebuilds the captured production public catalog, never copies production data.
"""
import json, pathlib, subprocess, sys
ROOT=pathlib.Path(__file__).resolve().parents[2]
CONTAINER='supabase_db_self-love-e2e'
CAT=json.loads((ROOT/'tests/migrations/production-catalog.json').read_text())

def run(db,sql,check=True):
    assert db in ('phase4_clean','phase4_drift','phase4_conflict')
    r=subprocess.run(['docker','exec','-i',CONTAINER,'psql','-X','-U','supabase_admin','-d',db,'-v','ON_ERROR_STOP=1','-At'],input=sql,text=True,capture_output=True)
    if check and r.returncode:raise RuntimeError(r.stderr[-2500:])
    return r

def ident(s):return '"'+s.replace('"','""')+'"'
def catalog_sql():
    out=['BEGIN;']
    # The fixture is a catalog snapshot: no auth users, emails or actual review rows.
    out+=['DROP TABLE IF EXISTS public.'+ident(t)+' CASCADE;' for t in ['operations_audit_log','account_deletion_requests','shopify_webhook_inbox','notification_jobs','newsletter_subscribers','referral_webhook_events','referral_rewards','referral_redemptions']+[x['name'] for x in CAT['tables']]]
    out.append("DO $$ DECLARE r record; BEGIN FOR r IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('update_return_request_admin','update_account_deletion_request_admin','retry_notification_job_admin','retry_shopify_webhook_admin','lease_notification_jobs','lease_shopify_webhook_events','handle_new_user','handle_new_membership','set_updated_at','confirmed_user_id_for_email','redeem_referral','claim_referrer_reward','queue_referral_welcome','claim_referral_paid_order','lease_referral_rewards','lease_referral_events','finish_referral_discount') LOOP EXECUTE 'DROP FUNCTION '||r.signature||' CASCADE'; END LOOP; END $$;")
    for t in CAT['tables']:
        columns=[]
        for c in CAT['columns']:
            if c['table']==t['name']:columns.append(ident(c['column'])+' '+c['type']+(' NOT NULL' if c['not_null'] else '')+(' DEFAULT '+c['default'] if c['default'] else ''))
        out.append('CREATE TABLE public.'+ident(t['name'])+' ('+','.join(columns)+');')
        out.append('ALTER TABLE public.'+ident(t['name'])+' OWNER TO postgres;')
        if t['rls']:out.append('ALTER TABLE public.'+ident(t['name'])+' ENABLE ROW LEVEL SECURITY;')
    for c in CAT['constraints']:out.append('ALTER TABLE public.'+ident(c['table'])+' ADD CONSTRAINT '+ident(c['name'])+' '+c['definition']+';')
    names={c['name'] for c in CAT['constraints']}
    for i in CAT['indexes']:
        if i['name'] not in names:out.append(i['definition']+';')
    out += [f['definition']+';' for f in CAT['functions']]
    for p in CAT['policies']:
        cmd={'r':'SELECT','a':'INSERT','w':'UPDATE','d':'DELETE','*':'ALL'}[p['command']]
        out.append('DROP POLICY IF EXISTS '+ident(p['name'])+' ON '+ident(p['schema'])+'.'+ident(p['table'])+';')
        out.append('CREATE POLICY '+ident(p['name'])+' ON '+ident(p['schema'])+'.'+ident(p['table'])+' FOR '+cmd+(' USING ('+p['using']+')' if p['using'] else '')+(' WITH CHECK ('+p['check']+')' if p['check'] else '')+';')
    for t in CAT['triggers']:
        out.append('DROP TRIGGER IF EXISTS '+ident(t['name'])+' ON '+ident(t['schema'])+'.'+ident(t['table'])+';')
        out.append(t['definition']+';')
    out.append("INSERT INTO public.reviews(product_id,product_handle,rating,body,nickname,email,approved) SELECT 'fixture-'||n,'fixture',5,'Synthetic existing approved review','Fixture','fixture@example.invalid',true FROM generate_series(1,8) n;")
    out+=['COMMIT;']
    return '\n'.join(out)

def assert_sql(db,expr,label):
    result=run(db,'SELECT ('+expr+')::text;').stdout.strip()
    assert result=='true',(label,result)
    print('PASS',db,label)

if __name__=='__main__':
    if '--legacy-api' in sys.argv:
        # The only non-ephemeral target is the explicitly named, dedicated local E2E stack.
        assert 'NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:55421' in (ROOT/'tests/e2e.env').read_text()
        r=subprocess.run(['docker','exec','-i',CONTAINER,'psql','-X','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],input=catalog_sql()+"\nNOTIFY pgrst, 'reload schema';",text=True,capture_output=True)
        if r.returncode:raise RuntimeError(r.stderr[-2500:])
        print('Dedicated local API stack now reproduces production catalog drift. Never connected remotely.')
        sys.exit(0)
    dump=subprocess.check_output(['docker','exec',CONTAINER,'pg_dump','-U','postgres','-d','postgres','--schema-only'],text=True)
    for db in ['phase4_clean','phase4_drift','phase4_conflict']:
        # These names are hard-coded ephemeral test DBs, not the live local API database.
        subprocess.run(['docker','exec',CONTAINER,'psql','-X','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-c',f'DROP DATABASE IF EXISTS {db} WITH (FORCE);'],check=True,capture_output=True)
        subprocess.run(['docker','exec',CONTAINER,'psql','-X','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-c',f'CREATE DATABASE {db};'],check=True,capture_output=True)
        run(db,dump)
    for db in ['phase4_drift','phase4_conflict']:run(db,catalog_sql())
    pending=sorted((ROOT/'supabase/migrations').glob('202610*.sql'))
    for db in ['phase4_drift','phase4_conflict']:
        for f in pending[:2]:run(db,'SET ROLE postgres; BEGIN;\n'+f.read_text()+'\nCOMMIT;')
    # Verify drift truly differs before reconciliation.
    assert_sql('phase4_drift',"(SELECT pg_get_expr(d.adbin,d.adrelid)='true' FROM pg_attrdef d JOIN pg_attribute a ON a.attrelid=d.adrelid AND a.attnum=d.adnum WHERE a.attrelid='public.reviews'::regclass AND a.attname='approved')",'production approved=true reproduced')
    for f in pending[2:]:run('phase4_drift','SET ROLE postgres; '+f.read_text())
    for db in ['phase4_clean','phase4_drift']:
        assert_sql(db,"NOT has_table_privilege('authenticated','public.reviews','INSERT')",'review INSERT revoked')
        assert_sql(db,"NOT has_column_privilege('authenticated','public.reviews','email','SELECT')",'private review column hidden')
        assert_sql(db,"NOT has_table_privilege('anon','public.referral_rewards','TRUNCATE') AND has_table_privilege('service_role','public.referral_rewards','INSERT')",'explicit reward grants')
        assert_sql(db,"NOT has_function_privilege('authenticated','public.claim_referral_paid_order(uuid,text,timestamptz,text,numeric,numeric)','EXECUTE')",'claim service-only')
        assert_sql(db,"EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.referrals'::regclass AND contype='u' AND conname='referrals_referrer_id_key')",'referrer uniqueness')
        assert_sql(db,"(SELECT pg_get_expr(d.adbin,d.adrelid)='false' FROM pg_attrdef d JOIN pg_attribute a ON a.attrelid=d.adrelid AND a.attnum=d.adnum WHERE a.attrelid='public.reviews'::regclass AND a.attname='approved')",'approved default false')
        assert_sql(db,"NOT has_function_privilege('service_role','public.claim_referrer_reward(uuid,numeric)','EXECUTE')",'unsafe old claim revoked')
        assert_sql(db,"has_function_privilege('service_role','public.create_return_request_atomic(uuid,uuid,text,text,text,text[],text,text[],jsonb)','EXECUTE') AND NOT has_function_privilege('authenticated','public.create_return_request_atomic(uuid,uuid,text,text,text,text[],text,text[],jsonb)','EXECUTE')",'atomic return RPC service-only')
        assert_sql(db,"EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='create_return_request_atomic' AND p.prosecdef AND array_to_string(p.proconfig,',')='search_path=\"\"')",'atomic return RPC hardened search_path')
    assert_sql('phase4_drift',"(SELECT count(*)=8 AND bool_and(approved) FROM public.reviews)",'eight approved reviews preserved')
    assert_sql('phase4_drift',"to_regclass('public.notification_jobs') IS NOT NULL AND to_regclass('public.newsletter_subscribers') IS NOT NULL",'durable communication tables created')
    assert_sql('phase4_drift',"NOT has_table_privilege('authenticated','public.notification_jobs','SELECT') AND NOT has_table_privilege('anon','public.newsletter_subscribers','INSERT')",'communication tables service-only')
    assert_sql('phase4_drift',"has_function_privilege('service_role','public.lease_notification_jobs(integer)','EXECUTE') AND NOT has_function_privilege('authenticated','public.lease_notification_jobs(integer)','EXECUTE')",'notification lease service-only')
    assert_sql('phase4_drift',"to_regclass('public.shopify_webhook_inbox') IS NOT NULL AND has_table_privilege('service_role','public.shopify_webhook_inbox','INSERT') AND NOT has_table_privilege('authenticated','public.shopify_webhook_inbox','SELECT')",'Shopify webhook inbox is private and service-only')
    assert_sql('phase4_drift',"has_function_privilege('service_role','public.lease_shopify_webhook_events(integer,text)','EXECUTE') AND NOT has_function_privilege('authenticated','public.lease_shopify_webhook_events(integer,text)','EXECUTE')",'Shopify webhook lease is service-only')
    assert_sql('phase4_drift',"EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='lease_shopify_webhook_events' AND p.prosecdef AND array_to_string(p.proconfig,',')='search_path=\"\"')",'Shopify webhook lease hardened search_path')
    assert_sql('phase4_drift',"EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='cart_snapshots' AND column_name='reminder_attempts')",'abandoned cart retry budget created')
    assert_sql('phase4_drift',"EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='lease_notification_jobs' AND p.prosecdef AND array_to_string(p.proconfig,',')='search_path=\"\"')",'notification lease hardened search_path')
    assert_sql('phase4_drift',"to_regclass('public.account_deletion_requests') IS NOT NULL AND to_regclass('public.operations_audit_log') IS NOT NULL",'account deletion requests and operations audit exist')
    assert_sql('phase4_drift',"has_function_privilege('service_role','public.update_return_request_admin(uuid,text,text,uuid)','EXECUTE') AND NOT has_function_privilege('authenticated','public.update_return_request_admin(uuid,text,text,uuid)','EXECUTE')",'return status transaction service-only')
    assert_sql('phase4_drift',"has_function_privilege('service_role','public.retry_notification_job_admin(uuid,uuid)','EXECUTE') AND has_function_privilege('service_role','public.retry_shopify_webhook_admin(text,uuid)','EXECUTE') AND NOT has_function_privilege('authenticated','public.retry_notification_job_admin(uuid,uuid)','EXECUTE')",'manual retries are atomic and service-only')
    assert_sql('phase4_drift',"NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.account_deletion_requests'::regclass AND contype='f' AND conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='public.account_deletion_requests'::regclass AND attname='user_id')])",'deletion audit survives auth user deletion')
    assert_sql('phase4_drift',"(SELECT count(*)=5 AND bool_and(confdeltype='a') FROM pg_constraint WHERE conname IN ('profiles_id_fkey','memberships_user_id_fkey','wishlists_user_id_fkey','cart_snapshots_user_id_fkey','referrals_referrer_id_fkey'))",'five NO ACTION FKs unchanged')
    # A bad existing row must abort before the default or constraints are altered.
    run('phase4_conflict',"INSERT INTO public.reviews(product_id,product_handle,rating,body,nickname,email) VALUES ('conflict','conflict',5,'tiny','Fixture','fixture@example.invalid');")
    failure=run('phase4_conflict','SET ROLE postgres; '+pending[2].read_text(),False)
    assert failure.returncode and 'preflight failed' in failure.stderr
    assert_sql('phase4_conflict',"(SELECT count(*)=9 FROM public.reviews)",'conflicting rows not modified/deleted')
    assert_sql('phase4_conflict',"(SELECT pg_get_expr(d.adbin,d.adrelid)='true' FROM pg_attrdef d JOIN pg_attribute a ON a.attrelid=d.adrelid AND a.attnum=d.adnum WHERE a.attrelid='public.reviews'::regclass AND a.attname='approved')",'failed migration rolled back')
    print('Migration matrix complete; no production access occurred.')
