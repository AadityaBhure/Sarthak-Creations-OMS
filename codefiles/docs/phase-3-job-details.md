# Phase 3 — Job Card details

Run the complete `supabase/migrations/20261028_vendor_job_details.sql` in Supabase SQL Editor after the Phase 2 numbering migration, then refresh the app. The migration is transactional and safe to rerun. It has not been applied to the live database by this task.

- Job Title is an optional varchar(200) nickname. Whitespace-only values become blank.
- Product Type is an optional selection from Module 1's existing Product Types master.
- Existing Job Cards retain blank values until edited. No Job Card Numbers, serials, quantities, history or statuses are changed by installation.
- Active Jobs allows editing both fields through Editable → Save Changes. Completed cards retain the current reopen-before-editing rule. Clearing the dropdown removes the type.
- Active, Completed and Deleted Records show both fields. The shared active/completed CSV, PDF and print output includes visible columns; filters and sorting support the new fields.
- The active master name is displayed while it exists. A small database trigger snapshots its last name before deletion, preserving existing Job Card labels even after trash retention expires. This does not block or otherwise change Module 1's delete/restore workflow. Only active master entries can be newly assigned.
- Field edits and existing card actions share a transaction, with revision checks and before/after audit data. Failed saves roll back the entire action.

Validation: `tests/vendor-job-details.test.mjs` exercises migration reruns, optional fields, invalid types, stale revisions, rollback, completion, deletion, restoration, serial preservation and master rename/deletion. Set PGLITE_MODULE to the PGlite package entry point to run the database test.

Hold/Canceled statuses and the vendor ledger are later phases.
