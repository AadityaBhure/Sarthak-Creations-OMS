# Vendor Job Tracking V1 — implementation and setup

Module 2 is independent of Customer Orders. Existing source integrations include sidebar links, page-title entries, and optional instructions/confirmation wording in the shared Excel import dialog. Module 1 master pages and import APIs are unchanged. Authentication, settings, shared styles, confirmation/alert dialogs, and the existing audit logger are reused without modification.

## Master Excel imports

Vendors and Paper Types have an **Import Excel** button beside Add, matching Module 1. Upload `.xlsx`, `.xls`, or `.csv`; the first worksheet is read, with headers in row 1. Review the first 50 rows, import, then inspect Accepted or Skipped/Rejected records and reasons.

- Vendors: `Vendor Name`, `Address`, `Concerned Person(s)`, `Concerned Person Contact(s)`, `Job Capabilities`.
- Paper Types: `Paper Type Name`.

All listed headers must be present (case-insensitive, any order); only the name value is required, with a maximum of 200 characters. Keep phone cells as Text to preserve prefixes and zeroes. Use semicolons between multiple people, contacts, or capabilities. Keep people and contacts in corresponding order. Capabilities match active Job Type names, ignoring surrounding spaces and capitalization. Unknown/deleted capabilities trigger confirmation before any writes; proceeding skips the entire affected vendor row. Empty capabilities are allowed.

Imports create new records only. Duplicate names in the file or database are skipped case-insensitively; records in the Recycle Bin must be restored separately. Imports are disabled during unsaved edits, an open add form, loading, or Recycle Bin viewing.

The authenticated `/api/vendor-jobs/masters/[kind]/import` endpoint validates rows, reads all existing names using pagination, and processes groups of 200. Within each group it calls the existing save RPC per record, preserving atomic vendor/capability writes and auditing successful saves. Row write failures are reported individually. No new database migration is needed. Unlike Module 1's direct bulk inserts, these saves use one RPC per record, so large vendor imports can take longer.

Run `node --test tests/vendor-jobs-import.test.mjs` for import validation and mixed-result coverage, including more than 200 rows.

## Start locally

From PowerShell:

```powershell
cd "D:\codefiles\Sarthak Creations OMS\codefiles"
npm run dev
```

Open http://localhost:3000 and sign in normally. Run `npm install` first if dependencies have not been installed.

## Database setup required

The initial migration was applied by the user on 28 September 2026, and the original Module 2 endpoints were verified against Supabase. The repair and master recycle migration was subsequently applied by the user and verified live: schema version 3, entry defaults, and all three master recycle fields are present. The configured environment supplies REST keys, not a PostgreSQL migration connection. REST keys alone cannot install tables/functions.

Apply `supabase/migrations/20260927_vendor_job_tracking.sql` once through the project's Supabase SQL Editor, or the normal PostgreSQL migration runner. The file is a single transaction. Do not rerun the old root schema.sql or replace existing tables. This migration only creates `vjt_*` objects and seeds the normal Sarthak Creations vendor. It does not alter Module 1 tables or install retention jobs.

**Base repair: `supabase/migrations/20260928_vendor_job_repair_and_master_recycle.sql`.** It handles the initial, partially upgraded and fully upgraded database and is safe to rerun. For a fresh installation, run `20260927_vendor_job_tracking.sql` followed by this repair file, then `20260929_vendor_job_deleted_records.sql`. The older `20260928_vendor_job_workflow.sql` is superseded; do not run it after the repair file. Do not blindly execute all files in filename order.

**Centralized Deleted Records update:** run the entire `supabase/migrations/20260929_vendor_job_deleted_records.sql` in Supabase SQL Editor. It adds the deleted-record view, atomic master purge function, and the named hourly `vjt-recycle-retention` pg_cron job. It is safe to rerun and leaves Module 1's jobs unchanged. Supabase must support the pg_cron extension; the migration is transactional and rolls back if scheduler setup fails. Existing deleted records already older than the configured retention period become eligible on the next hourly run.

The Module 2 sidebar now has **Deleted Records**, with Vendors, Job Types, Paper Types, and Job Cards tabs. Master-page Deleted Records buttons open the matching central tab. Tabs, tables, pagination, checkboxes, shift-selection, 200-record bulk actions and confirmation buttons follow Module 1. Rows display the configured retention countdown; protected masters display `Protected: in use`. All permanent-delete actions retain revision checks and audit logging. Restore preserves each Job Card's original Active/Completed status; restore required masters first when restoring an Active card.

After applying it, open **Vendor Job Tracking → Job Types / Paper Types / Vendors** to populate masters, then create a Job Card. The application uses the existing environment variables; no new runtime dependency or secret is required. Until installation, Module 2 APIs report that setup is required.

## Delivered workflow

| Phase                          | Delivered behavior                                                                                                                                  |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Existing-system inspection  | Existing routes, authentication, tables, filters, audit and recycle behavior reviewed. Module 1 business code preserved.                            |
| 2. Isolated foundation         | UUID Job Cards, ordered stages, namespaced masters/APIs, RLS and service-role-only RPC access.                                                      |
| 3. Masters                     | Vendor contacts as plain text, multiple Job Type capabilities, Job Types and Paper Types; add and staged edit. Master names remain live references. |
| 4. Job Card entry              | Automatic number and creation timestamp, one batch quantity, Paper Type, remarks, atomic first-stage creation.                                      |
| 5. Tracking table              | Eleven approved business columns, sorting, selection, pagination, column visibility, three-part AND/OR filters.                                     |
| 6. Editable records            | Staged Save/Discard; visible number, quantity, paper and remarks; deliberate duplicate-number confirmation.                                         |
| 7. Progress                    | Append a stage with automatic time; allow repeated vendors and Sarthak at any position.                                                             |
| 8. History correction          | Add/remove/reorder stages and edit references/timestamps. Final sequence position determines current work.                                          |
| 9. Completion                  | Explicit Active → Completed; completion timestamp; durations use this frozen endpoint; separate Completed Jobs.                                     |
| 10. Recycle Bin                | Soft delete and restore preserve the card and its stages; explicit permanent deletion removes only that card and its owned stages.                  |
| 11. Integration and validation | Navigation, reused audit logging, production build, isolated database tests and browser smoke checks. Live database installation remains required.  |

## Revised UI workflow (28 September 2026)

- Current Vendor and Current Job are selectable in the default Active Jobs table. Changes are staged; Save appends one stage using the chosen pair. Discard makes no database changes. Selecting the existing pair does not add a duplicate stage.
- Status is always a badge-style dropdown: Active / Mark Completed in Active Jobs, Completed / Send to Active in Completed Jobs. Status changes are staged with the same Save/Discard controls.
- A row's field edits, progress and completion are saved in one database transaction. A failure rolls back the entire row.
- Editable enables other field corrections and turns the Vendor History control into Edit Sequence. Update Progress and Mark Completed buttons have been removed from the Actions column.
- New Job Card mirrors the New Order form: editable Date of Entry and Job Card Number, master dropdowns, quantity, remarks and matching footer buttons. A changed date is stored at IST midnight; an unchanged date preserves the server-provided timestamp. The first stage is still timestamped at Save.
- Duplicate-number warnings on creation and number edits consider only non-deleted Active Jobs. Cancel makes no change; Continue Anyway creates a distinct UUID.
- Toolbars, table headers, 26px status badges, 32px table dropdowns, form spacing, pagination and master layouts mirror Module 1. CSV/PDF/Print use the displayed page or selected rows as in Order List. Quick Views reuse the existing API with separate vendor_jobs_active/completed/deleted module keys; no Module 1 route or component was edited.

## Data and concurrency

- Relationships and operations use UUIDs. `job_card_number` has a non-unique index, never a unique constraint.
- Creation and manual number edits lock the same singleton counter row. Generation increments until it finds an unused number, checking only non-deleted Active Jobs. Completed numbers can be reissued after deliberate manual entry. Manual edits and manually numbered creation never update the counter. The New Job Card form shows a server-generated candidate and editable date. If another automatic creation takes that candidate, Save rejects the stale preview and refreshes it for review rather than silently assigning a different number. Failed creation rolls back the number and first stage together.
- Card mutations lock the card and require its current `revision`; stale requests receive a conflict instead of overwriting another employee's changes. Master edits have the same revision protection.
- Stage positions have a deferred per-card unique constraint so reordering is atomic. The tracking view selects the largest position, independent of timestamps.
- Existing stage timestamps are omitted from correction payloads unless explicitly edited, preserving PostgreSQL timestamp precision. UI times and date filters use India Standard Time. Durations display whole elapsed 24-hour periods.
- Soft deletion uses `deleted_at` on the parent; stage rows stay attached. Existing Module 1 trash tables and purge routines are unchanged.
- Foreign keys from stages/cards/capabilities to masters restrict deletion. The only cascades are Job Card → its owned stage and completed-interval records.
- Every successful route mutation submits before/after data to the existing `logActivity` utility. Its existing best-effort behavior is unchanged; audit insertion is not part of the database mutation transaction.
- Browser clients cannot directly access new tables/functions as anonymous or Supabase authenticated roles. Server routes verify the existing OMS session and call the service-role RPCs.

## Deferred policy boundaries

These decisions do not block the implemented lifecycle:

1. **Master deletion:** each Vendor, Job Type and Paper Type Master has Delete and a link to centralized Deleted Records. Deletion is blocked if any non-deleted Active Job references the master, including an earlier history stage. Deleted masters are excluded from new selections. Names remain reserved until permanent deletion. Referenced masters cannot be permanently deleted; deleting an unreferenced vendor atomically removes its capability links. Active Job Cards require their masters to be restored first.
2. **Completed-job reopening — now resolved:** the Status dropdown can send a Completed Job back to Active. Reopening records the interval from completion to reopening. Both durations subtract completed intervals overlapping their respective creation/stage-to-now window. Repeated completion/reopening cycles are supported. A duplicate Active number on reopening requires confirmation.
3. **Completed-duration recalculation:** completed card and stage mutations are withheld. Deleting/restoring a completed card preserves its completion endpoint and status. Future correction policy can be added to the existing mutation boundary.
4. **Timestamp-order validation:** dates must parse, but no chronological ordering, future-date restriction or duration clamp is imposed. Sequence positions remain authoritative. Consequently an explicitly entered future stage time can yield a negative duration pending policy resolution.
5. **Module 2 purge policy (approved September 29):** an hourly database job reads `global_settings.recycle_retention_days` (default 10). It purges expired Job Cards with their stages and completed intervals first, then unreferenced expired vendors, Job Types, and Paper Types. Masters referenced by surviving cards/stages or vendor capabilities remain protected. Automated purges write activity logs. The same retention setting is shared with Module 1, whose purge implementation is unchanged.

## Validation

Production compilation: `npm run build`.

Basic domain/filter checks:

```powershell
node --test tests/vendor-jobs.test.mjs tests/vendor-jobs-workflow.test.mjs tests/vendor-jobs-repair.test.mjs
```

To include the SQL integration suite, install PGlite in a temporary tools directory (not as an application dependency) and point `PGLITE_MODULE` at its module:

```powershell
npm install --prefix "$env:TEMP/sarthak-vjt-validation" --no-audit --no-fund --ignore-scripts @electric-sql/pglite@0.3.14
$env:PGLITE_MODULE = "$env:TEMP/sarthak-vjt-validation/node_modules/@electric-sql/pglite/dist/index.js"
node --test tests/vendor-jobs.test.mjs tests/vendor-jobs-workflow.test.mjs
```

The SQL suite covers installation, numbering/manual rename/candidate skipping, duplicate confirmation, creation rollback, revision conflicts, stage order, exact timestamp preservation, ownership validation, live master renaming, completion restrictions, delete/restore, owned-record deletion, and database permissions. PGlite is single-session; true multi-connection lock contention still requires staging PostgreSQL verification.

`tests/vendor-jobs.browser.mjs` runs against a **separate local test server** with `JWT_SECRET=vendor-job-local-test-secret`, test-only Supabase configuration, and default URL http://localhost:3102. It uses headless installed Microsoft Edge and a temporary Playwright module specified by `PLAYWRIGHT_MODULE`. It intercepts all data endpoints, so it tests UI behavior and payloads without touching real records. Never use the test secret in the ordinary app or deployment. The suite covers creation, duplicate confirmation, sequence timestamp omission, progress, completion, recycle restore and vendor contact fields. These browser checks do not replace live Supabase integration validation.

The inherited application shell uses its existing sidebar collapse control on narrow screens. Module 2 forms adapt to one column, and tracking tables remain horizontally scrollable.

## Repair verification

Read-only live checks confirmed version 3 and successful responses from New Job Card, entry defaults, and master lists. The isolated repair suite tests installation from the initial schema, a partial upgrade, and the prior full workflow; repeated execution; all three master types; historical Active-stage references; preservation of completed/deleted Job Cards; restore; stale revisions; and database permissions. Browser tests cover Delete → Recycle Bin → Restore for all master pages and a failed entry-default request followed by Retry. No live business records were created or deleted for these checks.
