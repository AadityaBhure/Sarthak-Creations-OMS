-- Apply after 20260928_vendor_job_repair_and_master_recycle.sql.
-- Module 2 only; Module 1 tables and scheduled jobs are unchanged.
BEGIN;

CREATE OR REPLACE FUNCTION public.vjt_purge_master(p_kind text,p_id uuid,p_revision integer)
RETURNS jsonb LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE table_name text; before_data jsonb;
BEGIN
  table_name:=CASE p_kind WHEN 'vendors' THEN 'vjt_vendors' WHEN 'jobs' THEN 'vjt_job_types' WHEN 'papers' THEN 'vjt_paper_types' END;
  IF table_name IS NULL THEN RAISE EXCEPTION 'Invalid master category.'; END IF;
  PERFORM 1 FROM public.vjt_number_counter WHERE id=true FOR UPDATE;
  EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE id=$1 FOR UPDATE',table_name) INTO before_data USING p_id;
  IF before_data IS NULL THEN RAISE EXCEPTION 'Master record not found. Refresh the Recycle Bin.'; END IF;
  IF (before_data->>'revision')::integer IS DISTINCT FROM p_revision THEN RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='This master changed. Refresh before deleting.'; END IF;
  IF before_data->>'deleted_at' IS NULL THEN RAISE EXCEPTION 'Only records in the Recycle Bin can be permanently deleted.'; END IF;
  IF p_kind='vendors' THEN
    IF EXISTS(SELECT 1 FROM public.vjt_stages WHERE vendor_id=p_id) THEN RAISE EXCEPTION 'Cannot permanently delete this vendor because Job Card history still references it.'; END IF;
    before_data:=before_data || jsonb_build_object('capabilities',(SELECT coalesce(jsonb_agg(job_type_id),'[]'::jsonb) FROM public.vjt_vendor_capabilities WHERE vendor_id=p_id));
    DELETE FROM public.vjt_vendor_capabilities WHERE vendor_id=p_id;
  ELSIF p_kind='jobs' THEN
    IF EXISTS(SELECT 1 FROM public.vjt_stages WHERE job_type_id=p_id) OR EXISTS(SELECT 1 FROM public.vjt_vendor_capabilities WHERE job_type_id=p_id) THEN RAISE EXCEPTION 'Cannot permanently delete this Job Type because Job Card history or vendor capabilities still reference it.'; END IF;
  ELSIF EXISTS(SELECT 1 FROM public.vjt_job_cards WHERE paper_type_id=p_id) THEN
    RAISE EXCEPTION 'Cannot permanently delete this Paper Type because Job Cards still reference it.';
  END IF;
  EXECUTE format('DELETE FROM public.%I WHERE id=$1',table_name) USING p_id;
  RETURN jsonb_build_object('id',p_id,'before',before_data,'after',null);
END; $$;
REVOKE ALL ON FUNCTION public.vjt_purge_master(text,uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.vjt_purge_master(text,uuid,integer) TO service_role;

CREATE OR REPLACE VIEW public.vjt_deleted_records WITH (security_invoker=true) AS
SELECT v.id,'vendors'::text AS kind,to_jsonb(v) || jsonb_build_object(
  'capability_names',(SELECT string_agg(j.name,'; ' ORDER BY j.name) FROM public.vjt_vendor_capabilities c JOIN public.vjt_job_types j ON j.id=c.job_type_id WHERE c.vendor_id=v.id),
  'purge_blocked',EXISTS(SELECT 1 FROM public.vjt_stages s WHERE s.vendor_id=v.id)) AS record
FROM public.vjt_vendors v WHERE v.deleted_at IS NOT NULL
UNION ALL
SELECT j.id,'jobs',to_jsonb(j) || jsonb_build_object('purge_blocked',
  EXISTS(SELECT 1 FROM public.vjt_stages s WHERE s.job_type_id=j.id) OR EXISTS(SELECT 1 FROM public.vjt_vendor_capabilities c WHERE c.job_type_id=j.id))
FROM public.vjt_job_types j WHERE j.deleted_at IS NOT NULL
UNION ALL
SELECT p.id,'papers',to_jsonb(p) || jsonb_build_object('purge_blocked',EXISTS(SELECT 1 FROM public.vjt_job_cards c WHERE c.paper_type_id=p.id))
FROM public.vjt_paper_types p WHERE p.deleted_at IS NOT NULL
UNION ALL
SELECT c.id,'cards',to_jsonb(c) || jsonb_build_object('purge_blocked',false)
FROM public.vjt_tracking c WHERE c.deleted_at IS NOT NULL;
REVOKE ALL ON public.vjt_deleted_records FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.vjt_deleted_records TO service_role;

CREATE OR REPLACE FUNCTION public.vjt_purge_expired()
RETURNS integer LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE retention integer; cutoff timestamptz; item record; result jsonb; removed integer:=0;
BEGIN
  SELECT recycle_retention_days INTO retention FROM public.global_settings WHERE id='default';
  retention:=coalesce(retention,10);
  IF retention < 1 THEN RAISE EXCEPTION 'Recycle retention must be at least one day.'; END IF;
  cutoff:=now()-make_interval(days=>retention);
  PERFORM 1 FROM public.vjt_number_counter WHERE id=true FOR UPDATE;
  -- Cards first so expired history does not indefinitely retain expired masters.
  FOR item IN SELECT id,revision FROM public.vjt_job_cards WHERE deleted_at<=cutoff LOOP
    result:=public.vjt_mutate('purge',item.id,jsonb_build_object('revision',item.revision));
    INSERT INTO public.activity_logs(user_id,username,action,module,record_id,details)
      VALUES(null,'System','PERMANENT_DELETE','Vendor Job Tracking',item.id,jsonb_build_object('automatic',true,'Record',jsonb_build_object('old',result->'before','new',null)));
    removed:=removed+1;
  END LOOP;
  -- Separate passes re-evaluate references after vendor capability cleanup.
  FOR item IN SELECT id,revision FROM public.vjt_vendors v WHERE deleted_at<=cutoff AND NOT EXISTS(SELECT 1 FROM public.vjt_stages s WHERE s.vendor_id=v.id) LOOP
    result:=public.vjt_purge_master('vendors',item.id,item.revision);
    INSERT INTO public.activity_logs(user_id,username,action,module,record_id,details) VALUES(null,'System','PERMANENT_DELETE','Vendor Job Tracking / vendors',item.id,jsonb_build_object('automatic',true,'Record',jsonb_build_object('old',result->'before','new',null)));
    removed:=removed+1;
  END LOOP;
  FOR item IN SELECT id,revision FROM public.vjt_job_types j WHERE deleted_at<=cutoff AND NOT EXISTS(SELECT 1 FROM public.vjt_stages s WHERE s.job_type_id=j.id) AND NOT EXISTS(SELECT 1 FROM public.vjt_vendor_capabilities c WHERE c.job_type_id=j.id) LOOP
    result:=public.vjt_purge_master('jobs',item.id,item.revision);
    INSERT INTO public.activity_logs(user_id,username,action,module,record_id,details) VALUES(null,'System','PERMANENT_DELETE','Vendor Job Tracking / jobs',item.id,jsonb_build_object('automatic',true,'Record',jsonb_build_object('old',result->'before','new',null)));
    removed:=removed+1;
  END LOOP;
  FOR item IN SELECT id,revision FROM public.vjt_paper_types p WHERE deleted_at<=cutoff AND NOT EXISTS(SELECT 1 FROM public.vjt_job_cards c WHERE c.paper_type_id=p.id) LOOP
    result:=public.vjt_purge_master('papers',item.id,item.revision);
    INSERT INTO public.activity_logs(user_id,username,action,module,record_id,details) VALUES(null,'System','PERMANENT_DELETE','Vendor Job Tracking / papers',item.id,jsonb_build_object('automatic',true,'Record',jsonb_build_object('old',result->'before','new',null)));
    removed:=removed+1;
  END LOOP;
  RETURN removed;
END; $$;
REVOKE ALL ON FUNCTION public.vjt_purge_expired() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.vjt_purge_expired() TO service_role;

CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('vjt-recycle-retention','0 * * * *','SELECT public.vjt_purge_expired();');
CREATE OR REPLACE FUNCTION public.vjt_recycle_ready() RETURNS boolean LANGUAGE sql SET search_path=public,pg_temp AS $$ SELECT true $$;
REVOKE ALL ON FUNCTION public.vjt_recycle_ready() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.vjt_recycle_ready() TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
