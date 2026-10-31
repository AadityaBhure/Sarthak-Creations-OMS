-- Phase 4. Run after 20261028_vendor_job_details.sql. Safe to rerun.
BEGIN;
ALTER TABLE public.vjt_job_cards ADD COLUMN IF NOT EXISTS canceled_at timestamptz;
ALTER TABLE public.vjt_job_cards DROP CONSTRAINT IF EXISTS vjt_job_cards_status_check;
ALTER TABLE public.vjt_job_cards DROP CONSTRAINT IF EXISTS vjt_job_cards_check;
ALTER TABLE public.vjt_job_cards DROP CONSTRAINT IF EXISTS vjt_job_cards_status_times_check;
ALTER TABLE public.vjt_job_cards ADD CONSTRAINT vjt_job_cards_status_check CHECK(status IN ('Active','Hold','Completed','Canceled'));
ALTER TABLE public.vjt_job_cards ADD CONSTRAINT vjt_job_cards_status_times_check CHECK(
 (status IN ('Active','Hold') AND completed_at IS NULL AND canceled_at IS NULL) OR
 (status='Completed' AND completed_at IS NOT NULL AND canceled_at IS NULL) OR
 (status='Canceled' AND canceled_at IS NOT NULL AND completed_at IS NULL));

-- Preserve column order for existing consumers and include canceled downtime in
-- the same elapsed-time calculations used for completed jobs. Hold never pauses.
DO $$ DECLARE definition text; columns_sql text; BEGIN
 IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='vjt_tracking' AND column_name='canceled_at') THEN
   definition:=regexp_replace(pg_get_viewdef('public.vjt_tracking'::regclass,true),';\s*$','');
   SELECT string_agg(CASE column_name
     WHEN 'total_days' THEN 'floor((extract(epoch FROM (coalesce(card.completed_at,card.canceled_at,now())-card.created_at))-paused.total_seconds)/86400)::integer AS total_days'
     WHEN 'days_at_current_job' THEN 'floor((extract(epoch FROM (coalesce(card.completed_at,card.canceled_at,now())-existing.current_stage_started_at))-paused.stage_seconds)/86400)::integer AS days_at_current_job'
     ELSE format('existing.%I',column_name) END,', ' ORDER BY ordinal_position)
   INTO columns_sql FROM information_schema.columns WHERE table_schema='public' AND table_name='vjt_tracking';
   EXECUTE 'CREATE OR REPLACE VIEW public.vjt_tracking WITH (security_invoker=true) AS SELECT '||columns_sql||', card.canceled_at FROM ('||definition||') existing JOIN public.vjt_job_cards card ON card.id=existing.id LEFT JOIN LATERAL (
     SELECT coalesce(sum(greatest(0,extract(epoch FROM (least(i.reopened_at,coalesce(card.completed_at,card.canceled_at,now()))-greatest(i.completed_at,card.created_at))))),0) AS total_seconds,
     coalesce(sum(greatest(0,extract(epoch FROM (least(i.reopened_at,coalesce(card.completed_at,card.canceled_at,now()))-greatest(i.completed_at,existing.current_stage_started_at))))),0) AS stage_seconds
     FROM public.vjt_completed_intervals i WHERE i.job_card_id=card.id) paused ON true';
 END IF;
 definition:=pg_get_viewdef('public.vjt_deleted_records'::regclass,true);
 EXECUTE 'CREATE OR REPLACE VIEW public.vjt_deleted_records WITH (security_invoker=true) AS '||definition;
END $$;

CREATE OR REPLACE FUNCTION vjt_internal.set_status(p_id uuid,p_status text,p_revision integer,p_confirm boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE card public.vjt_job_cards; before_data jsonb; after_data jsonb; stage record;
BEGIN
 PERFORM 1 FROM public.vjt_number_counter WHERE id=true FOR UPDATE;
 SELECT * INTO card FROM public.vjt_job_cards WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Job Card not found.'; END IF;
 IF card.revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='This Job Card changed. Refresh and review your edits before saving.'; END IF;
 IF card.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'Restore this Job Card before changing its status.'; END IF;
 IF p_status IS NULL OR p_status NOT IN ('Active','Hold','Completed','Canceled') THEN RAISE EXCEPTION 'Select a valid Status.'; END IF;
 SELECT to_jsonb(t) INTO before_data FROM public.vjt_tracking t WHERE id=p_id;
 IF card.status=p_status THEN RETURN jsonb_build_object('id',p_id,'before',before_data,'after',before_data); END IF;
 IF card.status IN ('Completed','Canceled') THEN
   IF p_status<>'Active' THEN RAISE EXCEPTION 'Send this Job Card to Active before changing its status again.'; END IF;
   PERFORM vjt_internal.require_master('papers',card.paper_type_id);
   FOR stage IN SELECT vendor_id,job_type_id FROM public.vjt_stages WHERE job_card_id=p_id LOOP
     PERFORM vjt_internal.require_master('vendors',stage.vendor_id);
     PERFORM vjt_internal.require_master('jobs',stage.job_type_id);
   END LOOP;
   IF EXISTS(SELECT 1 FROM public.vjt_job_cards WHERE id<>p_id AND lower(job_card_number)=lower(card.job_card_number) AND status IN ('Active','Hold') AND deleted_at IS NULL) AND NOT coalesce(p_confirm,false) THEN
     RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='Job Card Number '||card.job_card_number||' already exists in Active Jobs. Do you want to continue?';
   END IF;
   -- This existing interval table records periods excluded after reopening,
   -- whether the previous terminal status was Completed or Canceled.
   INSERT INTO public.vjt_completed_intervals(job_card_id,completed_at,reopened_at) VALUES(p_id,coalesce(card.completed_at,card.canceled_at),now());
 END IF;
 UPDATE public.vjt_job_cards SET status=p_status,
   completed_at=CASE WHEN p_status='Completed' THEN now() ELSE NULL END,
   canceled_at=CASE WHEN p_status='Canceled' THEN now() ELSE NULL END,
   revision=revision+1 WHERE id=p_id;
 SELECT to_jsonb(t) INTO after_data FROM public.vjt_tracking t WHERE id=p_id;
 RETURN jsonb_build_object('id',p_id,'before',before_data,'after',after_data);
END; $$;
REVOKE ALL ON FUNCTION vjt_internal.set_status(uuid,text,integer,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION vjt_internal.set_status(uuid,text,integer,boolean) TO service_role;

-- Existing sequence, delete/restore and detail implementations are retained.
-- Extend their lifecycle guards, without changing their write logic.
DO $$ DECLARE definition text; BEGIN
 definition:=pg_get_functiondef('vjt_internal.vjt_mutate(text,uuid,jsonb)'::regprocedure);
 definition:=replace(definition,'card.status = ''Completed'' AND p_action','card.status IN (''Completed'',''Canceled'') AND p_action');
 definition:=replace(definition,'Completed jobs are read-only. Reopening and correction policies are pending.','Completed or canceled jobs are read-only. Send the Job Card to Active before editing.');
 EXECUTE definition;
 definition:=pg_get_functiondef('public.vjt_mutate_details(text,uuid,jsonb)'::regprocedure);
 definition:=replace(definition,'card.status<>''Active''','card.status NOT IN (''Active'',''Hold'')');
 EXECUTE definition;
 definition:=pg_get_functiondef('public.vjt_master_lifecycle(text,uuid,text,integer)'::regprocedure);
 definition:=replace(definition,'status=''Active''','status IN (''Active'',''Hold'')');
 EXECUTE definition;
END $$;

-- Updated entry-number and card mutation definitions follow.

CREATE OR REPLACE FUNCTION public.vjt_entry_defaults() RETURNS jsonb LANGUAGE plpgsql
SET search_path = public, pg_temp AS $$
DECLARE n bigint; candidate text;
BEGIN
  SELECT last_number INTO n FROM public.vjt_number_counter WHERE id = true;
  LOOP
    n := n + 1;
    candidate := 'JB' || lpad(n::text,greatest(4,length(n::text)),'0');
    EXIT WHEN NOT EXISTS(SELECT 1 FROM public.vjt_job_cards WHERE lower(job_card_number)=lower(candidate) AND status IN ('Active','Hold') AND deleted_at IS NULL);
  END LOOP;
  RETURN jsonb_build_object('job_card_number',candidate,'created_at',now());
END; $$;

CREATE OR REPLACE FUNCTION public.vjt_mutate(p_action text,p_id uuid DEFAULT NULL,p_data jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE card public.vjt_job_cards; candidate text; n bigint; before_data jsonb; result jsonb; working_revision integer; patch jsonb; stage_check record;
BEGIN
  -- Global lock order: number counter, then card. Completion/reopen/restore can
  -- change the active-number set, so they serialize with number assignment too.
  PERFORM 1 FROM public.vjt_number_counter WHERE id=true FOR UPDATE;
  IF p_action IN ('create','update','progress','save') THEN
    IF p_data ? 'vendor_id' THEN PERFORM vjt_internal.require_master('vendors',(p_data->>'vendor_id')::uuid); END IF;
    IF p_data ? 'job_type_id' THEN PERFORM vjt_internal.require_master('jobs',(p_data->>'job_type_id')::uuid); END IF;
    IF p_data ? 'paper_type_id' THEN PERFORM vjt_internal.require_master('papers',(p_data->>'paper_type_id')::uuid); END IF;
  ELSIF p_action='sequence' THEN
    FOR stage_check IN SELECT value FROM jsonb_array_elements(p_data->'stages') LOOP
      PERFORM vjt_internal.require_master('vendors',(stage_check.value->>'vendor_id')::uuid);
      PERFORM vjt_internal.require_master('jobs',(stage_check.value->>'job_type_id')::uuid);
    END LOOP;
  END IF;
  IF p_action = 'create' THEN
    IF p_data ? 'job_card_number' THEN
      candidate := btrim(p_data->>'job_card_number');
      IF candidate IS NULL OR candidate='' THEN RAISE EXCEPTION 'Enter a Job Card Number.'; END IF;
      IF EXISTS(SELECT 1 FROM public.vjt_job_cards WHERE lower(job_card_number)=lower(candidate) AND status IN ('Active','Hold') AND deleted_at IS NULL)
         AND NOT coalesce((p_data->>'confirm_duplicate')::boolean,false) THEN
        RAISE EXCEPTION USING ERRCODE='P0002', MESSAGE='Job Card Number ' || candidate || ' already exists in Active Jobs. Do you want to continue?';
      END IF;
    ELSE
      SELECT last_number INTO n FROM public.vjt_number_counter WHERE id=true;
      LOOP
        n:=n+1; candidate:='JB' || lpad(n::text,greatest(4,length(n::text)),'0');
        EXIT WHEN NOT EXISTS(SELECT 1 FROM public.vjt_job_cards WHERE lower(job_card_number)=lower(candidate) AND status IN ('Active','Hold') AND deleted_at IS NULL);
      END LOOP;
      IF p_data ? 'expected_number' AND p_data->>'expected_number' <> candidate THEN
        RAISE EXCEPTION USING ERRCODE='P0003', MESSAGE='Another Job Card was saved while this form was open. Review the refreshed number and save again.';
      END IF;
      UPDATE public.vjt_number_counter SET last_number=n WHERE id=true;
    END IF;
    INSERT INTO public.vjt_job_cards(job_card_number,created_at,quantity,paper_type_id,remarks)
    VALUES(candidate,coalesce((p_data->>'created_at')::timestamptz,now()),(p_data->>'quantity')::integer,(p_data->>'paper_type_id')::uuid,coalesce(p_data->>'remarks','')) RETURNING * INTO card;
    INSERT INTO public.vjt_stages(job_card_id,vendor_id,job_type_id,position)
    VALUES(card.id,(p_data->>'vendor_id')::uuid,(p_data->>'job_type_id')::uuid,1);
    SELECT to_jsonb(t) INTO result FROM public.vjt_tracking t WHERE id=card.id;
    RETURN jsonb_build_object('id',card.id,'before',null,'after',result);
  END IF;
  SELECT * INTO card FROM public.vjt_job_cards WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Job Card not found.'; END IF;
  IF (p_data->>'revision')::integer IS DISTINCT FROM card.revision THEN
    RAISE EXCEPTION USING ERRCODE='40001', MESSAGE='This Job Card changed. Refresh and review your edits before saving.';
  END IF;
  SELECT to_jsonb(t) INTO before_data FROM public.vjt_tracking t WHERE id=p_id;
  IF p_action IN ('complete','reopen','hold','cancel','set_status') THEN
    RETURN vjt_internal.set_status(p_id,CASE p_action WHEN 'complete' THEN 'Completed' WHEN 'reopen' THEN 'Active' WHEN 'hold' THEN 'Hold' WHEN 'cancel' THEN 'Canceled' ELSE p_data->>'status' END,card.revision,coalesce((p_data->>'confirm_duplicate')::boolean,false));
  END IF;
  IF p_action='reopen' OR (p_action='restore' AND card.status IN ('Active','Hold')) THEN
    PERFORM vjt_internal.require_master('papers',card.paper_type_id);
    FOR stage_check IN SELECT vendor_id,job_type_id FROM public.vjt_stages WHERE job_card_id=p_id LOOP
      PERFORM vjt_internal.require_master('vendors',stage_check.vendor_id);
      PERFORM vjt_internal.require_master('jobs',stage_check.job_type_id);
    END LOOP;
  END IF;
  IF p_action='save' THEN
    -- One Save applies field edits, one new stage and a status change atomically.
    working_revision:=card.revision;
    patch:=p_data - ARRAY['revision','vendor_id','job_type_id','status','confirm_duplicate'];
    IF patch <> '{}'::jsonb THEN
      result:=public.vjt_mutate('update',p_id,patch || jsonb_build_object('revision',working_revision,'confirm_duplicate',coalesce((p_data->>'confirm_duplicate')::boolean,false)));
      working_revision:=(result->'after'->>'revision')::integer;
    END IF;
    IF p_data ? 'vendor_id' OR p_data ? 'job_type_id' THEN
      IF (p_data->>'vendor_id')::uuid IS DISTINCT FROM (before_data->>'current_vendor_id')::uuid OR
         (p_data->>'job_type_id')::uuid IS DISTINCT FROM (before_data->>'current_job_id')::uuid THEN
        result:=public.vjt_mutate('progress',p_id,jsonb_build_object('revision',working_revision,'vendor_id',p_data->>'vendor_id','job_type_id',p_data->>'job_type_id'));
        working_revision:=(result->'after'->>'revision')::integer;
      END IF;
    END IF;
    IF p_data ? 'status' AND p_data->>'status' <> card.status THEN
      IF p_data->>'status' NOT IN ('Active','Hold','Completed','Canceled') THEN RAISE EXCEPTION 'Select a valid Status.'; END IF;
      result:=public.vjt_mutate(CASE p_data->>'status' WHEN 'Completed' THEN 'complete' WHEN 'Canceled' THEN 'cancel' WHEN 'Hold' THEN 'hold' ELSE 'reopen' END,p_id,jsonb_build_object('revision',working_revision,'confirm_duplicate',coalesce((p_data->>'confirm_duplicate')::boolean,false)));
    END IF;
    SELECT to_jsonb(t) INTO result FROM public.vjt_tracking t WHERE id=p_id;
    RETURN jsonb_build_object('id',p_id,'before',before_data,'after',result);
  ELSIF p_action='update' THEN
    candidate:=btrim(coalesce(p_data->>'job_card_number',card.job_card_number));
    IF candidate<>card.job_card_number AND EXISTS(SELECT 1 FROM public.vjt_job_cards WHERE id<>p_id AND lower(job_card_number)=lower(candidate) AND status IN ('Active','Hold') AND deleted_at IS NULL)
       AND NOT coalesce((p_data->>'confirm_duplicate')::boolean,false) THEN
      RAISE EXCEPTION USING ERRCODE='P0002', MESSAGE='Job Card Number ' || candidate || ' already exists in Active Jobs. Do you want to continue?';
    END IF;
    p_data:=p_data || jsonb_build_object('confirm_duplicate',true);
  END IF;
  RETURN vjt_internal.vjt_mutate(p_action,p_id,p_data);
END; $$;
REVOKE ALL ON FUNCTION public.vjt_entry_defaults() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.vjt_mutate(text,uuid,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vjt_entry_defaults() TO service_role;
GRANT EXECUTE ON FUNCTION public.vjt_mutate(text,uuid,jsonb) TO service_role;


CREATE OR REPLACE FUNCTION public.vjt_schema_version() RETURNS integer LANGUAGE sql AS $$ SELECT 5 $$;
NOTIFY pgrst,'reload schema';
COMMIT;
