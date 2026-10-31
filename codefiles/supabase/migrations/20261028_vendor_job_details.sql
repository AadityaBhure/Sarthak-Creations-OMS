-- Phase 3. Run after 20261028_order_numbering.sql. Safe to rerun.
BEGIN;
ALTER TABLE public.vjt_job_cards ADD COLUMN IF NOT EXISTS job_title varchar(200);
-- Module 1 moves deleted types into a different table. Keep the ID plus a name
-- snapshot rather than a foreign key that would change its delete workflow.
ALTER TABLE public.vjt_job_cards ADD COLUMN IF NOT EXISTS product_type_id uuid;
ALTER TABLE public.vjt_job_cards ADD COLUMN IF NOT EXISTS product_type_snapshot text;
CREATE INDEX IF NOT EXISTS vjt_cards_product_type_idx ON public.vjt_job_cards(product_type_id);

CREATE OR REPLACE FUNCTION public.vjt_preserve_product_type() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  UPDATE public.vjt_job_cards SET product_type_snapshot=OLD.name WHERE product_type_id=OLD.id;
  RETURN OLD;
END; $$;
REVOKE ALL ON FUNCTION public.vjt_preserve_product_type() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS vjt_preserve_product_type ON public.product_types;
CREATE TRIGGER vjt_preserve_product_type BEFORE DELETE ON public.product_types
FOR EACH ROW EXECUTE FUNCTION public.vjt_preserve_product_type();

DO $$ DECLARE definition text; BEGIN
 IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='vjt_tracking' AND column_name='job_title') THEN
   definition:=regexp_replace(pg_get_viewdef('public.vjt_tracking'::regclass,true),';\s*$','');
   EXECUTE 'CREATE OR REPLACE VIEW public.vjt_tracking WITH (security_invoker=true) AS SELECT existing.*, card.job_title, card.product_type_id, coalesce(pt.name,card.product_type_snapshot) AS product_type FROM ('||definition||') existing JOIN public.vjt_job_cards card ON card.id=existing.id LEFT JOIN public.product_types pt ON pt.id=card.product_type_id';
 END IF;
 definition:=pg_get_viewdef('public.vjt_deleted_records'::regclass,true);
 EXECUTE 'CREATE OR REPLACE VIEW public.vjt_deleted_records WITH (security_invoker=true) AS '||definition;
END $$;

-- The existing mutation continues to own number assignment, revision checks,
-- history and status changes. Details are saved in the same transaction.
CREATE OR REPLACE FUNCTION public.vjt_mutate_details(p_action text,p_id uuid DEFAULT NULL,p_data jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE result jsonb; after_data jsonb; card public.vjt_job_cards; selected_name text; selected_id uuid; saved_id uuid; has_details boolean;
BEGIN
 has_details:=p_data ? 'job_title' OR p_data ? 'product_type_id';
 IF NOT has_details THEN RETURN public.vjt_mutate(p_action,p_id,p_data); END IF;
 IF p_action NOT IN ('create','update','save') THEN RAISE EXCEPTION 'These details cannot be changed with this action.'; END IF;
 IF p_data ? 'job_title' AND (jsonb_typeof(p_data->'job_title') IS DISTINCT FROM 'string' OR length(p_data->>'job_title')>200) THEN RAISE EXCEPTION 'Job Title must be text of up to 200 characters.'; END IF;
 PERFORM 1 FROM public.vjt_number_counter WHERE id=true FOR UPDATE;
 IF p_action<>'create' THEN
   SELECT * INTO card FROM public.vjt_job_cards WHERE id=p_id FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Job Card not found.'; END IF;
   IF card.deleted_at IS NOT NULL OR card.status<>'Active' THEN RAISE EXCEPTION 'Restore or reopen this Job Card before editing its details.'; END IF;
 END IF;
 IF p_data ? 'product_type_id' THEN
   selected_id:=(p_data->>'product_type_id')::uuid;
   IF selected_id IS NOT NULL THEN
     SELECT name INTO selected_name FROM public.product_types WHERE id=selected_id FOR SHARE;
     IF NOT FOUND THEN
       IF p_action<>'create' AND selected_id=card.product_type_id THEN selected_name:=card.product_type_snapshot;
       ELSE RAISE EXCEPTION 'This Product Type is unavailable. Refresh and choose an existing Product Type.'; END IF;
     END IF;
   END IF;
 END IF;
 result:=public.vjt_mutate(p_action,p_id,p_data - ARRAY['job_title','product_type_id']);
 saved_id:=(result->>'id')::uuid;
 UPDATE public.vjt_job_cards SET
   job_title=CASE WHEN p_data ? 'job_title' THEN nullif(btrim(p_data->>'job_title'),'') ELSE job_title END,
   product_type_id=CASE WHEN p_data ? 'product_type_id' THEN selected_id ELSE product_type_id END,
   product_type_snapshot=CASE WHEN p_data ? 'product_type_id' THEN selected_name ELSE product_type_snapshot END,
   revision=CASE WHEN p_action<>'create' AND revision=card.revision THEN revision+1 ELSE revision END
 WHERE id=saved_id;
 SELECT to_jsonb(t) INTO after_data FROM public.vjt_tracking t WHERE id=saved_id;
 RETURN jsonb_set(result,'{after}',after_data);
END; $$;
REVOKE ALL ON FUNCTION public.vjt_mutate_details(text,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.vjt_mutate_details(text,uuid,jsonb) TO service_role;
CREATE OR REPLACE FUNCTION public.vjt_schema_version() RETURNS integer LANGUAGE sql AS $$ SELECT 4 $$;
NOTIFY pgrst,'reload schema';
COMMIT;
