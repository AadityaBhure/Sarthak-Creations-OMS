-- Phase 2. Apply after the September 29 Module 2 migration. Safe to rerun.
-- Serial registers intentionally survive permanent business-record deletion.
BEGIN;
LOCK TABLE public.orders,public.deleted_orders,public.vjt_job_cards IN ACCESS EXCLUSIVE MODE;
CREATE TABLE IF NOT EXISTS public.oms_number_counters (
  module text PRIMARY KEY CHECK(module IN ('customer','vendor')),
  last_serial bigint NOT NULL DEFAULT 0,
  next_order_number bigint NOT NULL DEFAULT 1
);
INSERT INTO public.oms_number_counters(module) VALUES('customer'),('vendor') ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS public.oms_serial_register (
  module text NOT NULL REFERENCES public.oms_number_counters(module),
  record_id uuid NOT NULL,
  serial_number bigint NOT NULL CHECK(serial_number>0),
  order_number bigint,
  PRIMARY KEY(module,record_id), UNIQUE(module,serial_number)
);
CREATE INDEX IF NOT EXISTS oms_register_order_number_idx ON public.oms_serial_register(module,order_number) WHERE order_number IS NOT NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS serial_number bigint;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_number bigint CHECK(order_number BETWEEN 1 AND 9007199254740990);
ALTER TABLE public.deleted_orders ADD COLUMN IF NOT EXISTS serial_number bigint;
ALTER TABLE public.deleted_orders ADD COLUMN IF NOT EXISTS order_number bigint CHECK(order_number BETWEEN 1 AND 9007199254740990);
ALTER TABLE public.vjt_job_cards ADD COLUMN IF NOT EXISTS serial_number bigint;

-- Stable ties use ID; missing creation timestamps fall back to Date of Entry.
WITH source AS (
 SELECT id,coalesce(created_at,date_of_entry::timestamptz,'epoch'::timestamptz) born FROM public.orders
 UNION ALL SELECT id,coalesce(created_at,date_of_entry::timestamptz,'epoch'::timestamptz) FROM public.deleted_orders
), missing AS (
 SELECT id,min(born) born FROM source s WHERE NOT EXISTS(SELECT 1 FROM public.oms_serial_register r WHERE r.module='customer' AND r.record_id=s.id) GROUP BY id
)
INSERT INTO public.oms_serial_register(module,record_id,serial_number)
SELECT 'customer',id,(SELECT last_serial FROM public.oms_number_counters WHERE module='customer')+row_number() OVER(ORDER BY born,id) FROM missing;
WITH missing AS (
 SELECT id,created_at FROM public.vjt_job_cards c WHERE NOT EXISTS(SELECT 1 FROM public.oms_serial_register r WHERE r.module='vendor' AND r.record_id=c.id)
)
INSERT INTO public.oms_serial_register(module,record_id,serial_number)
SELECT 'vendor',id,(SELECT last_serial FROM public.oms_number_counters WHERE module='vendor')+row_number() OVER(ORDER BY created_at,id) FROM missing;
UPDATE public.oms_number_counters c SET last_serial=greatest(last_serial,coalesce((SELECT max(serial_number) FROM public.oms_serial_register r WHERE r.module=c.module),0));
UPDATE public.orders t SET serial_number=r.serial_number FROM public.oms_serial_register r WHERE r.module='customer' AND r.record_id=t.id AND t.serial_number IS DISTINCT FROM r.serial_number;
UPDATE public.deleted_orders t SET serial_number=r.serial_number FROM public.oms_serial_register r WHERE r.module='customer' AND r.record_id=t.id AND t.serial_number IS DISTINCT FROM r.serial_number;
UPDATE public.vjt_job_cards t SET serial_number=r.serial_number FROM public.oms_serial_register r WHERE r.module='vendor' AND r.record_id=t.id AND t.serial_number IS DISTINCT FROM r.serial_number;
ALTER TABLE public.orders ALTER COLUMN serial_number SET NOT NULL;
ALTER TABLE public.deleted_orders ALTER COLUMN serial_number SET NOT NULL;
ALTER TABLE public.vjt_job_cards ALTER COLUMN serial_number SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS orders_serial_number_idx ON public.orders(serial_number);
CREATE UNIQUE INDEX IF NOT EXISTS deleted_orders_serial_number_idx ON public.deleted_orders(serial_number);
CREATE UNIQUE INDEX IF NOT EXISTS vjt_cards_serial_number_idx ON public.vjt_job_cards(serial_number);

CREATE OR REPLACE FUNCTION public.oms_assign_numbering() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE kind text:=TG_ARGV[0]; saved public.oms_serial_register; next_num bigint;
BEGIN
 IF TG_OP='UPDATE' THEN
   IF NEW.id IS DISTINCT FROM OLD.id OR NEW.serial_number IS DISTINCT FROM OLD.serial_number THEN RAISE EXCEPTION 'Serial Number and record identity cannot be changed.'; END IF;
   IF kind='vendor' THEN RETURN NEW; END IF;
   IF NEW.order_number IS NOT DISTINCT FROM OLD.order_number THEN RETURN NEW; END IF;
 END IF;
 PERFORM 1 FROM public.oms_number_counters WHERE module=kind FOR UPDATE;
 SELECT * INTO saved FROM public.oms_serial_register WHERE module=kind AND record_id=NEW.id;
 IF TG_OP='INSERT' AND saved.record_id IS NOT NULL THEN
   IF NEW.serial_number IS NOT NULL AND NEW.serial_number<>saved.serial_number THEN RAISE EXCEPTION 'Serial Number cannot be changed during restoration.'; END IF;
   NEW.serial_number:=saved.serial_number;
   IF kind='customer' AND NEW.order_number IS DISTINCT FROM saved.order_number THEN RAISE EXCEPTION 'Restore the original Order Number with this record.'; END IF;
   RETURN NEW;
 END IF;
 IF TG_OP='INSERT' THEN
   IF NEW.serial_number IS NOT NULL THEN RAISE EXCEPTION 'Serial Number is assigned automatically.'; END IF;
   IF TG_TABLE_NAME='deleted_orders' THEN RAISE EXCEPTION 'Only existing orders can be moved to Deleted Records.'; END IF;
   UPDATE public.oms_number_counters SET last_serial=last_serial+1 WHERE module=kind RETURNING last_serial INTO NEW.serial_number;
 END IF;
 IF kind='customer' THEN
   IF TG_OP='INSERT' THEN
     SELECT next_order_number INTO next_num FROM public.oms_number_counters WHERE module=kind;
     NEW.order_number:=coalesce(NEW.order_number,next_num);
   END IF;
   IF NEW.order_number IS NOT NULL AND (NEW.order_number<1 OR NEW.order_number>9007199254740990) THEN RAISE EXCEPTION 'Order Number must be a positive whole number within the supported range.'; END IF;
   IF NEW.order_number IS NOT NULL AND EXISTS(SELECT 1 FROM public.oms_serial_register WHERE module=kind AND record_id<>NEW.id AND order_number=NEW.order_number)
      AND current_setting('oms.confirm_duplicate',true) IS DISTINCT FROM 'yes' THEN
     RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='Order Number '||NEW.order_number||' has already been used by another customer order. Continue with this duplicate number?';
   END IF;
   IF TG_OP='INSERT' THEN UPDATE public.oms_number_counters SET next_order_number=NEW.order_number+1 WHERE module=kind; END IF;
   INSERT INTO public.oms_serial_register VALUES(kind,NEW.id,NEW.serial_number,NEW.order_number)
     ON CONFLICT(module,record_id) DO UPDATE SET order_number=excluded.order_number;
 ELSE
   INSERT INTO public.oms_serial_register(module,record_id,serial_number) VALUES(kind,NEW.id,NEW.serial_number);
 END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS oms_numbering ON public.orders;
CREATE TRIGGER oms_numbering BEFORE INSERT OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.oms_assign_numbering('customer');
DROP TRIGGER IF EXISTS oms_numbering ON public.deleted_orders;
CREATE TRIGGER oms_numbering BEFORE INSERT OR UPDATE ON public.deleted_orders FOR EACH ROW EXECUTE FUNCTION public.oms_assign_numbering('customer');
DROP TRIGGER IF EXISTS oms_numbering ON public.vjt_job_cards;
CREATE TRIGGER oms_numbering BEFORE INSERT OR UPDATE ON public.vjt_job_cards FOR EACH ROW EXECUTE FUNCTION public.oms_assign_numbering('vendor');

CREATE OR REPLACE FUNCTION public.oms_order_defaults() RETURNS jsonb LANGUAGE sql SET search_path=public,pg_temp AS $$
 SELECT jsonb_build_object('order_number',next_order_number) FROM public.oms_number_counters WHERE module='customer'
$$;
CREATE OR REPLACE FUNCTION public.oms_save_order(p_id uuid DEFAULT NULL,p_data jsonb DEFAULT '{}',p_confirm_duplicate boolean DEFAULT false,p_expected_order_number bigint DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result jsonb; record_data public.orders; columns_sql text; key text; next_num bigint;
BEGIN
 IF jsonb_typeof(p_data)<>'object' THEN RAISE EXCEPTION 'Invalid order data.'; END IF;
 FOR key IN SELECT jsonb_object_keys(p_data) LOOP
   IF key NOT IN ('date_of_entry','po_number','client_id','product_name_id','product_type_id','quantity','status','remark','executive_id','target_date','assignment_history','order_number') THEN RAISE EXCEPTION 'This order field cannot be edited: %',key; END IF;
 END LOOP;
 SELECT next_order_number INTO next_num FROM public.oms_number_counters WHERE module='customer' FOR UPDATE;
 PERFORM set_config('oms.confirm_duplicate',CASE WHEN p_confirm_duplicate THEN 'yes' ELSE 'no' END,true);
 IF p_id IS NULL THEN
   IF p_expected_order_number IS NOT NULL AND p_expected_order_number<>next_num THEN RAISE EXCEPTION USING ERRCODE='P0003',MESSAGE='The suggested Order Number changed. Review the refreshed number and save again.'; END IF;
   record_data:=jsonb_populate_record(NULL::public.orders,p_data);
   INSERT INTO public.orders(date_of_entry,po_number,client_id,product_name_id,product_type_id,quantity,status,remark,executive_id,target_date,order_number)
   VALUES(record_data.date_of_entry,record_data.po_number,record_data.client_id,record_data.product_name_id,record_data.product_type_id,record_data.quantity,coalesce(record_data.status,'Design Confirmed'),coalesce(record_data.remark,''),record_data.executive_id,record_data.target_date,record_data.order_number)
   RETURNING to_jsonb(orders.*) INTO result;
 ELSE
   SELECT * INTO record_data FROM public.orders WHERE id=p_id FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Order not found. Refresh the list.'; END IF;
   SELECT string_agg(format('%I = src.%I',k,k),', ') INTO columns_sql FROM jsonb_object_keys(p_data) k;
   IF columns_sql IS NULL THEN RETURN to_jsonb(record_data); END IF;
   EXECUTE format('UPDATE public.orders t SET %s FROM jsonb_populate_record(NULL::public.orders,$1) src WHERE t.id=$2 RETURNING to_jsonb(t.*)',columns_sql) INTO result USING to_jsonb(record_data)||p_data,p_id;
 END IF;
 PERFORM set_config('oms.confirm_duplicate','no',true);
 RETURN result;
END; $$;

-- Append to the existing view without replacing any workflow/duration calculations.
DO $$ DECLARE definition text; BEGIN
 IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='vjt_tracking' AND column_name='serial_number') THEN
   definition:=regexp_replace(pg_get_viewdef('public.vjt_tracking'::regclass,true),';\s*$','');
   EXECUTE 'CREATE OR REPLACE VIEW public.vjt_tracking WITH (security_invoker=true) AS SELECT existing.*, card.serial_number FROM ('||definition||') existing JOIN public.vjt_job_cards card ON card.id=existing.id';
 END IF;
END $$;
-- The deleted-record view stores a row as JSON; refresh its card arm for the appended field.
DO $$ DECLARE definition text; BEGIN
 IF to_regclass('public.vjt_deleted_records') IS NOT NULL THEN
   definition:=pg_get_viewdef('public.vjt_deleted_records'::regclass,true);
   EXECUTE 'CREATE OR REPLACE VIEW public.vjt_deleted_records WITH (security_invoker=true) AS '||definition;
 END IF;
END $$;
ALTER TABLE public.oms_number_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oms_serial_register ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.oms_number_counters,public.oms_serial_register FROM PUBLIC,anon,authenticated,service_role;
-- Trigger owner writes the permanent register; application callers cannot reset it.
GRANT SELECT ON public.oms_number_counters,public.oms_serial_register TO service_role;
REVOKE ALL ON FUNCTION public.oms_assign_numbering() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.oms_order_defaults() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.oms_save_order(uuid,jsonb,boolean,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.oms_order_defaults(),public.oms_save_order(uuid,jsonb,boolean,bigint) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
