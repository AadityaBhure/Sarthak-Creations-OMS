-- Apply after 20260927_vendor_job_tracking.sql. Module 2 only.
BEGIN;

CREATE TABLE public.vjt_completed_intervals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_card_id uuid NOT NULL REFERENCES public.vjt_job_cards(id) ON DELETE CASCADE,
  completed_at timestamptz NOT NULL,
  reopened_at timestamptz NOT NULL
);
CREATE INDEX vjt_completed_intervals_card ON public.vjt_completed_intervals(job_card_id);
ALTER TABLE public.vjt_completed_intervals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vjt_completed_intervals FROM anon, authenticated;
GRANT ALL ON public.vjt_completed_intervals TO service_role;

CREATE OR REPLACE VIEW public.vjt_tracking WITH (security_invoker = true) AS
SELECT c.*, p.name AS paper_type,
       current_stage.vendor_id AS current_vendor_id,
       current_stage.job_type_id AS current_job_id,
       v.name AS current_vendor, j.name AS current_job,
       current_stage.started_at AS current_stage_started_at,
       floor((extract(epoch FROM (coalesce(c.completed_at, now()) - c.created_at)) - paused.total_seconds)/86400)::integer AS total_days,
       floor((extract(epoch FROM (coalesce(c.completed_at, now()) - current_stage.started_at)) - paused.stage_seconds)/86400)::integer AS days_at_current_job,
       coalesce(history.stages, '[]'::jsonb) AS stages,
       history.vendor_history
FROM public.vjt_job_cards c
JOIN public.vjt_paper_types p ON p.id = c.paper_type_id
LEFT JOIN LATERAL (
  SELECT s.* FROM public.vjt_stages s WHERE s.job_card_id = c.id ORDER BY s.position DESC LIMIT 1
) current_stage ON true
LEFT JOIN public.vjt_vendors v ON v.id = current_stage.vendor_id
LEFT JOIN public.vjt_job_types j ON j.id = current_stage.job_type_id
LEFT JOIN LATERAL (
  SELECT jsonb_agg(to_jsonb(s) || jsonb_build_object('vendor_name',sv.name,'job_name',sj.name) ORDER BY s.position) AS stages,
         string_agg(sv.name || ' — ' || sj.name, ' → ' ORDER BY s.position) AS vendor_history
  FROM public.vjt_stages s
  JOIN public.vjt_vendors sv ON sv.id = s.vendor_id
  JOIN public.vjt_job_types sj ON sj.id = s.job_type_id
  WHERE s.job_card_id = c.id
) history ON true
LEFT JOIN LATERAL (
  SELECT coalesce(sum(greatest(0,extract(epoch FROM
    (least(i.reopened_at,coalesce(c.completed_at,now())) - greatest(i.completed_at,c.created_at))))),0) AS total_seconds,
    coalesce(sum(greatest(0,extract(epoch FROM
    (least(i.reopened_at,coalesce(c.completed_at,now())) - greatest(i.completed_at,current_stage.started_at))))),0) AS stage_seconds
  FROM public.vjt_completed_intervals i WHERE i.job_card_id = c.id
) paused ON true;

-- Preserve the installed lifecycle implementation in a non-REST schema.
CREATE SCHEMA vjt_internal;
REVOKE ALL ON SCHEMA vjt_internal FROM PUBLIC;
GRANT USAGE ON SCHEMA vjt_internal TO service_role;
ALTER FUNCTION public.vjt_mutate(text,uuid,jsonb) SET SCHEMA vjt_internal;

CREATE FUNCTION public.vjt_entry_defaults() RETURNS jsonb LANGUAGE plpgsql
SET search_path = public, pg_temp AS $$
DECLARE n bigint; candidate text;
BEGIN
  SELECT last_number INTO n FROM public.vjt_number_counter WHERE id = true;
  LOOP
    n := n + 1;
    candidate := 'JB' || lpad(n::text,greatest(4,length(n::text)),'0');
    EXIT WHEN NOT EXISTS(SELECT 1 FROM public.vjt_job_cards WHERE lower(job_card_number)=lower(candidate) AND status='Active' AND deleted_at IS NULL);
  END LOOP;
  RETURN jsonb_build_object('job_card_number',candidate,'created_at',now());
END; $$;

CREATE FUNCTION public.vjt_mutate(p_action text,p_id uuid DEFAULT NULL,p_data jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE card public.vjt_job_cards; candidate text; n bigint; before_data jsonb; result jsonb; working_revision integer; patch jsonb;
BEGIN
  -- Global lock order: number counter, then card. Completion/reopen/restore can
  -- change the active-number set, so they serialize with number assignment too.
  PERFORM 1 FROM public.vjt_number_counter WHERE id=true FOR UPDATE;
  IF p_action = 'create' THEN
    IF p_data ? 'job_card_number' THEN
      candidate := btrim(p_data->>'job_card_number');
      IF candidate IS NULL OR candidate='' THEN RAISE EXCEPTION 'Enter a Job Card Number.'; END IF;
      IF EXISTS(SELECT 1 FROM public.vjt_job_cards WHERE lower(job_card_number)=lower(candidate) AND status='Active' AND deleted_at IS NULL)
         AND NOT coalesce((p_data->>'confirm_duplicate')::boolean,false) THEN
        RAISE EXCEPTION USING ERRCODE='P0002', MESSAGE='Job Card Number ' || candidate || ' already exists in Active Jobs. Do you want to continue?';
      END IF;
    ELSE
      SELECT last_number INTO n FROM public.vjt_number_counter WHERE id=true;
      LOOP
        n:=n+1; candidate:='JB' || lpad(n::text,greatest(4,length(n::text)),'0');
        EXIT WHEN NOT EXISTS(SELECT 1 FROM public.vjt_job_cards WHERE lower(job_card_number)=lower(candidate) AND status='Active' AND deleted_at IS NULL);
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
      IF p_data->>'status' NOT IN ('Active','Completed') THEN RAISE EXCEPTION 'Select a valid Status.'; END IF;
      result:=public.vjt_mutate(CASE WHEN p_data->>'status'='Completed' THEN 'complete' ELSE 'reopen' END,p_id,jsonb_build_object('revision',working_revision,'confirm_duplicate',coalesce((p_data->>'confirm_duplicate')::boolean,false)));
    END IF;
    SELECT to_jsonb(t) INTO result FROM public.vjt_tracking t WHERE id=p_id;
    RETURN jsonb_build_object('id',p_id,'before',before_data,'after',result);
  ELSIF p_action='reopen' THEN
    IF card.deleted_at IS NOT NULL OR card.status<>'Completed' THEN RAISE EXCEPTION 'Only a completed Job Card outside the Recycle Bin can be sent to Active Jobs.'; END IF;
    IF EXISTS(SELECT 1 FROM public.vjt_job_cards WHERE id<>p_id AND lower(job_card_number)=lower(card.job_card_number) AND status='Active' AND deleted_at IS NULL)
       AND NOT coalesce((p_data->>'confirm_duplicate')::boolean,false) THEN
      RAISE EXCEPTION USING ERRCODE='P0002', MESSAGE='Job Card Number ' || card.job_card_number || ' already exists in Active Jobs. Do you want to continue?';
    END IF;
    INSERT INTO public.vjt_completed_intervals(job_card_id,completed_at,reopened_at) VALUES(p_id,card.completed_at,now());
    UPDATE public.vjt_job_cards SET status='Active',completed_at=null,revision=revision+1 WHERE id=p_id;
    SELECT to_jsonb(t) INTO result FROM public.vjt_tracking t WHERE id=p_id;
    RETURN jsonb_build_object('id',p_id,'before',before_data,'after',result);
  ELSIF p_action='update' THEN
    candidate:=btrim(coalesce(p_data->>'job_card_number',card.job_card_number));
    IF candidate<>card.job_card_number AND EXISTS(SELECT 1 FROM public.vjt_job_cards WHERE id<>p_id AND lower(job_card_number)=lower(candidate) AND status='Active' AND deleted_at IS NULL)
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
NOTIFY pgrst, 'reload schema';
COMMIT;
