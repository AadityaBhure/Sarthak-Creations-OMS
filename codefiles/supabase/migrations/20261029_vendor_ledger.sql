-- Phase 5. Apply after 20261029_vendor_job_statuses.sql. Safe to rerun.
BEGIN;
-- One row per saved stage, including repeat visits to the same vendor.
-- Current card fields are deliberately separate from the stage vendor/job.
CREATE OR REPLACE VIEW public.vjt_vendor_ledger WITH (security_invoker=true) AS
SELECT s.id,s.job_card_id,s.vendor_id,v.name AS vendor,
       s.job_type_id,j.name AS job_type,s.position AS stage_number,s.started_at AS stage_started_at,
       c.serial_number,c.job_card_number,c.job_title,c.quantity,
       c.paper_type_id,p.name AS paper_type,c.product_type_id,
       coalesce(pt.name,c.product_type_snapshot) AS product_type,c.status,c.deleted_at
FROM public.vjt_stages s
JOIN public.vjt_job_cards c ON c.id=s.job_card_id
JOIN public.vjt_vendors v ON v.id=s.vendor_id
JOIN public.vjt_job_types j ON j.id=s.job_type_id
JOIN public.vjt_paper_types p ON p.id=c.paper_type_id
LEFT JOIN public.product_types pt ON pt.id=c.product_type_id;
REVOKE ALL ON public.vjt_vendor_ledger FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.vjt_vendor_ledger TO service_role;
CREATE INDEX IF NOT EXISTS vjt_stages_vendor_started_idx ON public.vjt_stages(vendor_id,started_at DESC,id);
NOTIFY pgrst,'reload schema';
COMMIT;
