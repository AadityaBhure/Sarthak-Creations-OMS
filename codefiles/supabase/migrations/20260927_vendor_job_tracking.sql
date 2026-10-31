-- Module 2 only. Does not alter Module 1 tables, functions, policies or cron jobs.
BEGIN;

CREATE TABLE public.vjt_job_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  revision integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX vjt_job_types_name ON public.vjt_job_types (lower(name));
CREATE TABLE public.vjt_paper_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  revision integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX vjt_paper_types_name ON public.vjt_paper_types (lower(name));
CREATE TABLE public.vjt_vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  address text NOT NULL DEFAULT '',
  concerned_persons text NOT NULL DEFAULT '',
  concerned_contacts text NOT NULL DEFAULT '',
  revision integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX vjt_vendors_name ON public.vjt_vendors (lower(name));
CREATE TABLE public.vjt_vendor_capabilities (
  vendor_id uuid NOT NULL REFERENCES public.vjt_vendors(id) ON DELETE RESTRICT,
  job_type_id uuid NOT NULL REFERENCES public.vjt_job_types(id) ON DELETE RESTRICT,
  PRIMARY KEY (vendor_id, job_type_id)
);
INSERT INTO public.vjt_vendors(name) VALUES ('Sarthak Creations');

-- A locked counter is independent of editable business numbers; it also rolls back
-- if creation fails. All writes to business numbers take the same lock.
CREATE TABLE public.vjt_number_counter (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  last_number bigint NOT NULL DEFAULT 0
);
INSERT INTO public.vjt_number_counter DEFAULT VALUES;
CREATE TABLE public.vjt_job_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_card_number text NOT NULL CHECK (length(btrim(job_card_number)) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  quantity integer NOT NULL CHECK (quantity > 0),
  paper_type_id uuid NOT NULL REFERENCES public.vjt_paper_types(id) ON DELETE RESTRICT,
  remarks text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Completed')),
  completed_at timestamptz,
  deleted_at timestamptz,
  revision integer NOT NULL DEFAULT 1,
  CHECK ((status = 'Active' AND completed_at IS NULL) OR
         (status = 'Completed' AND completed_at IS NOT NULL))
);
-- Intentionally NOT UNIQUE. Duplicates require confirmation in the write RPC.
CREATE INDEX vjt_job_cards_number ON public.vjt_job_cards (lower(job_card_number));
CREATE INDEX vjt_job_cards_lifecycle ON public.vjt_job_cards(status, deleted_at);
CREATE TABLE public.vjt_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_card_id uuid NOT NULL REFERENCES public.vjt_job_cards(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES public.vjt_vendors(id) ON DELETE RESTRICT,
  job_type_id uuid NOT NULL REFERENCES public.vjt_job_types(id) ON DELETE RESTRICT,
  position integer NOT NULL CHECK (position > 0),
  started_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(job_card_id, position) DEFERRABLE INITIALLY DEFERRED
);

-- Sequence position, never timestamp order, defines current work. Completion
-- freezes the endpoint of both duration calculations. No timestamp-order policy.
CREATE VIEW public.vjt_tracking WITH (security_invoker = true) AS
SELECT c.*, p.name AS paper_type,
       current_stage.vendor_id AS current_vendor_id,
       current_stage.job_type_id AS current_job_id,
       v.name AS current_vendor, j.name AS current_job,
       current_stage.started_at AS current_stage_started_at,
       floor(extract(epoch FROM (coalesce(c.completed_at, now()) - c.created_at))/86400)::integer AS total_days,
       floor(extract(epoch FROM (coalesce(c.completed_at, now()) - current_stage.started_at))/86400)::integer AS days_at_current_job,
       coalesce(history.stages, '[]'::jsonb) AS stages,
       history.vendor_history
FROM public.vjt_job_cards c
JOIN public.vjt_paper_types p ON p.id = c.paper_type_id
LEFT JOIN LATERAL (
  SELECT s.* FROM public.vjt_stages s WHERE s.job_card_id = c.id
  ORDER BY s.position DESC LIMIT 1
) current_stage ON true
LEFT JOIN public.vjt_vendors v ON v.id = current_stage.vendor_id
LEFT JOIN public.vjt_job_types j ON j.id = current_stage.job_type_id
LEFT JOIN LATERAL (
  SELECT jsonb_agg(to_jsonb(s) || jsonb_build_object('vendor_name', sv.name, 'job_name', sj.name) ORDER BY s.position) AS stages,
         string_agg(sv.name || ' — ' || sj.name, ' → ' ORDER BY s.position) AS vendor_history
  FROM public.vjt_stages s
  JOIN public.vjt_vendors sv ON sv.id = s.vendor_id
  JOIN public.vjt_job_types sj ON sj.id = s.job_type_id
  WHERE s.job_card_id = c.id
) history ON true;

CREATE FUNCTION public.vjt_mutate(p_action text, p_id uuid DEFAULT NULL, p_data jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  card public.vjt_job_cards;
  old_data jsonb;
  new_data jsonb;
  candidate text;
  counter_value bigint;
  stage jsonb;
  stage_id uuid;
  stage_ids uuid[] := ARRAY[]::uuid[];
  sequence_position integer := 0;
BEGIN
  IF p_action NOT IN ('create', 'update', 'progress', 'sequence', 'complete', 'delete', 'restore', 'purge') THEN
    RAISE EXCEPTION 'This action is not available.';
  END IF;
  -- Serialize generated numbers and manual renames, including duplicate checks.
  IF p_action IN ('create', 'update') THEN
    SELECT last_number INTO counter_value FROM public.vjt_number_counter WHERE id = true FOR UPDATE;
  END IF;
  IF p_action = 'create' THEN
    LOOP
      counter_value := counter_value + 1;
      candidate := 'JB' || lpad(counter_value::text, greatest(4, length(counter_value::text)), '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.vjt_job_cards WHERE lower(job_card_number) = lower(candidate));
    END LOOP;
    UPDATE public.vjt_number_counter SET last_number = counter_value WHERE id = true;
    INSERT INTO public.vjt_job_cards(job_card_number, quantity, paper_type_id, remarks)
    VALUES(candidate, (p_data->>'quantity')::integer, (p_data->>'paper_type_id')::uuid, coalesce(p_data->>'remarks',''))
    RETURNING * INTO card;
    INSERT INTO public.vjt_stages(job_card_id, vendor_id, job_type_id, position)
    VALUES(card.id, (p_data->>'vendor_id')::uuid, (p_data->>'job_type_id')::uuid, 1);
    p_id := card.id;
  ELSE
    SELECT * INTO card FROM public.vjt_job_cards WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Job Card not found.'; END IF;
    IF (p_data->>'revision')::integer IS DISTINCT FROM card.revision THEN
      RAISE EXCEPTION USING MESSAGE = 'This Job Card changed. Refresh and review your edits before saving.', ERRCODE = '40001';
    END IF;
    SELECT to_jsonb(t) INTO old_data FROM public.vjt_tracking t WHERE id = p_id;
    IF p_action IN ('restore','purge') THEN
      IF card.deleted_at IS NULL THEN RAISE EXCEPTION 'Move this Job Card to the Recycle Bin first.'; END IF;
    ELSIF card.deleted_at IS NOT NULL THEN
      RAISE EXCEPTION 'Restore this Job Card before making changes.';
    END IF;
    -- Deferred policy boundary: no reopening or completed-history edits.
    IF card.status = 'Completed' AND p_action NOT IN ('delete','restore','purge') THEN
      RAISE EXCEPTION 'Completed jobs are read-only. Reopening and correction policies are pending.';
    END IF;
    IF p_action = 'update' THEN
      candidate := btrim(coalesce(p_data->>'job_card_number',card.job_card_number));
      IF candidate <> card.job_card_number AND EXISTS (
        SELECT 1 FROM public.vjt_job_cards WHERE id <> p_id AND lower(job_card_number) = lower(candidate)
      ) AND coalesce((p_data->>'confirm_duplicate')::boolean,false) = false THEN
        RAISE EXCEPTION USING MESSAGE = 'Job Card Number ' || candidate || ' already exists. Do you want to continue?', ERRCODE = 'P0002';
      END IF;
      UPDATE public.vjt_job_cards SET job_card_number = candidate,
        quantity = coalesce((p_data->>'quantity')::integer,quantity),
        paper_type_id = coalesce((p_data->>'paper_type_id')::uuid,paper_type_id),
        remarks = coalesce(p_data->>'remarks',remarks) WHERE id = p_id;
    ELSIF p_action = 'progress' THEN
      SELECT coalesce(max(position),0)+1 INTO sequence_position FROM public.vjt_stages WHERE job_card_id = p_id;
      INSERT INTO public.vjt_stages(job_card_id,vendor_id,job_type_id,position)
      VALUES(p_id,(p_data->>'vendor_id')::uuid,(p_data->>'job_type_id')::uuid,sequence_position);
    ELSIF p_action = 'sequence' THEN
      IF jsonb_typeof(p_data->'stages') IS DISTINCT FROM 'array' OR jsonb_array_length(p_data->'stages') = 0 THEN
        RAISE EXCEPTION 'Keep at least one stage in the Vendor History.';
      END IF;
      FOR stage IN SELECT value FROM jsonb_array_elements(p_data->'stages') LOOP
        sequence_position := sequence_position + 1;
        IF stage->>'id' IS NOT NULL THEN
          stage_id := (stage->>'id')::uuid;
          IF stage_id = ANY(stage_ids) OR NOT EXISTS (SELECT 1 FROM public.vjt_stages WHERE id = stage_id AND job_card_id = p_id) THEN
            RAISE EXCEPTION 'A history stage is invalid. Refresh and try again.';
          END IF;
          UPDATE public.vjt_stages SET vendor_id = (stage->>'vendor_id')::uuid,
            job_type_id = (stage->>'job_type_id')::uuid, position = sequence_position,
            started_at = CASE WHEN stage ? 'started_at' THEN (stage->>'started_at')::timestamptz ELSE started_at END
          WHERE id = stage_id;
        ELSE
          INSERT INTO public.vjt_stages(job_card_id,vendor_id,job_type_id,position,started_at)
          VALUES(p_id,(stage->>'vendor_id')::uuid,(stage->>'job_type_id')::uuid,sequence_position,
                 coalesce((stage->>'started_at')::timestamptz,now())) RETURNING id INTO stage_id;
        END IF;
        stage_ids := array_append(stage_ids,stage_id);
      END LOOP;
      DELETE FROM public.vjt_stages WHERE job_card_id = p_id AND NOT(id = ANY(stage_ids));
    ELSIF p_action = 'complete' THEN
      UPDATE public.vjt_job_cards SET status = 'Completed', completed_at = now() WHERE id = p_id;
    ELSIF p_action = 'delete' THEN
      UPDATE public.vjt_job_cards SET deleted_at = now() WHERE id = p_id;
    ELSIF p_action = 'restore' THEN
      UPDATE public.vjt_job_cards SET deleted_at = NULL WHERE id = p_id;
    ELSIF p_action = 'purge' THEN
      -- The only cascade is from this Module 2 parent to its owned stages.
      DELETE FROM public.vjt_job_cards WHERE id = p_id;
      RETURN jsonb_build_object('id',p_id,'before',old_data,'after',NULL);
    END IF;
    UPDATE public.vjt_job_cards SET revision = revision + 1 WHERE id = p_id;
  END IF;
  SELECT to_jsonb(t) INTO new_data FROM public.vjt_tracking t WHERE id = p_id;
  RETURN jsonb_build_object('id',p_id,'before',old_data,'after',new_data);
END;
$$;

CREATE FUNCTION public.vjt_save_master(p_kind text, p_id uuid DEFAULT NULL, p_data jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  table_name text;
  old_data jsonb;
  new_data jsonb;
  name_value text := btrim(p_data->>'name');
BEGIN
  table_name := CASE p_kind WHEN 'vendors' THEN 'vjt_vendors' WHEN 'jobs' THEN 'vjt_job_types' WHEN 'papers' THEN 'vjt_paper_types' END;
  IF table_name IS NULL THEN RAISE EXCEPTION 'Invalid master list.'; END IF;
  IF name_value IS NULL OR name_value = '' THEN RAISE EXCEPTION 'Name is required.'; END IF;
  IF p_id IS NOT NULL THEN
    EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE id = $1 FOR UPDATE',table_name) INTO old_data USING p_id;
    IF old_data IS NULL THEN RAISE EXCEPTION 'Master record not found.'; END IF;
    IF (p_data->>'revision')::integer IS DISTINCT FROM (old_data->>'revision')::integer THEN
      RAISE EXCEPTION USING MESSAGE = 'This master record changed. Refresh before saving.', ERRCODE = '40001';
    END IF;
    EXECUTE format('UPDATE public.%I SET name = $1, revision = revision + 1 WHERE id = $2',table_name) USING name_value,p_id;
  ELSE
    EXECUTE format('INSERT INTO public.%I(name) VALUES($1) RETURNING id',table_name) INTO p_id USING name_value;
  END IF;
  IF p_kind = 'vendors' THEN
    old_data := old_data || jsonb_build_object('capabilities', (SELECT coalesce(jsonb_agg(job_type_id),'[]'::jsonb) FROM public.vjt_vendor_capabilities WHERE vendor_id = p_id));
    UPDATE public.vjt_vendors SET address = coalesce(p_data->>'address',''),
      concerned_persons = coalesce(p_data->>'concerned_persons',''),
      concerned_contacts = coalesce(p_data->>'concerned_contacts','') WHERE id = p_id;
    DELETE FROM public.vjt_vendor_capabilities WHERE vendor_id = p_id;
    INSERT INTO public.vjt_vendor_capabilities(vendor_id,job_type_id)
    SELECT p_id,value::uuid FROM jsonb_array_elements_text(coalesce(p_data->'capabilities','[]'::jsonb)) ON CONFLICT DO NOTHING;
  END IF;
  EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE id = $1',table_name) INTO new_data USING p_id;
  IF p_kind = 'vendors' THEN
    new_data := new_data || jsonb_build_object('capabilities',(SELECT coalesce(jsonb_agg(job_type_id),'[]'::jsonb) FROM public.vjt_vendor_capabilities WHERE vendor_id = p_id));
  END IF;
  RETURN jsonb_build_object('id',p_id,'before',old_data,'after',new_data);
END;
$$;

-- Custom OMS cookies are verified in the server routes; no anonymous access to
-- Module 2 data or RPCs. Existing Module 1 security is untouched.
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['vjt_job_types','vjt_paper_types','vjt_vendors','vjt_vendor_capabilities','vjt_number_counter','vjt_job_cards','vjt_stages'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated',t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
  END LOOP;
END $$;
REVOKE ALL ON public.vjt_tracking FROM anon, authenticated;
GRANT SELECT ON public.vjt_tracking TO service_role;
REVOKE ALL ON FUNCTION public.vjt_mutate(text,uuid,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.vjt_save_master(text,uuid,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vjt_mutate(text,uuid,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.vjt_save_master(text,uuid,jsonb) TO service_role;
-- No master deletion function, reopening function, timestamp-order constraint,
-- completed-history mutation, retention enforcement, or purge cron is installed.
NOTIFY pgrst, 'reload schema';
COMMIT;
