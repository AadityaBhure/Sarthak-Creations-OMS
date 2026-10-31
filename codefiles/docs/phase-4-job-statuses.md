# Phase 4 — Hold and Canceled jobs

Run the complete `supabase/migrations/20261029_vendor_job_statuses.sql` after the Phase 3 Job Card details migration in Supabase SQL Editor, then refresh the application. The migration is transactional and safe to rerun. This task does not apply it to the live database.

## Behaviour

- New jobs start Active. Active and Hold share the Active Jobs tab.
- Hold only changes the displayed status. Editing, history, running day counters, duplicate-number checks and protection of referenced masters continue as for Active.
- Completed jobs remain in Completed Jobs. Canceled jobs go to Canceled Jobs. Both retain the same serial, Job Card number, title, product type and vendor history.
- Completed and Canceled records allow Send to Active. Reopening requires available paper/vendor/job masters and confirmation of a duplicate number among Active/Hold cards. Other edits require reopening first.
- Canceled is not Deleted: cancellation does not start retention or purge. Deletion uses the existing Deleted Records workflow; restoring preserves the previous status.
- Day counters stop at completion/cancellation. Reopening excludes the closed period from subsequent elapsed time. The existing interval table holds both completed and canceled intervals; canceled_at records cancellation separately from completed_at. Hold never creates an excluded interval.
- Row changes and status transitions save atomically with revision checks. Filters, quick views, CSV/PDF/print exports and the shared table work on Canceled Jobs too.
- Sidebar order: New Job Card, Active Jobs, Completed Jobs, Canceled Jobs.

Existing Active/Completed records and their history are unchanged by installation. The SQL extends existing constraints, views and functions; it does not renumber or delete records.

Tests cover status validation, migration reruns, Hold editing and master protection, duplicate conflicts, rollback, elapsed time, stale revisions, reopening, completion, cancel/delete/restore, and immutable serials. Browser tests cover movement across tabs and the new status controls.

The vendor-wise ledger remains the next phase.
