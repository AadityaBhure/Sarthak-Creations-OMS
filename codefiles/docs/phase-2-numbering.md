# Phase 2: permanent serials and customer Order Numbers

## Install

Run the complete `supabase/migrations/20261028_order_numbering.sql` in Supabase SQL Editor after the September 29 vendor Deleted Records migration. Use a quiet period because the transaction briefly locks orders, deleted_orders and vjt_job_cards during backfill. Refresh the application after successful execution. Do not run the old schema.sql file.

The migration is transactional and safe to rerun. It does not change PO Numbers or Job Card Numbers. It has been validated against an isolated PostgreSQL-compatible database; this task does not apply it to the live database.

## Behaviour

- Each module has an independent, immutable Serial Number starting at 1. Existing records are numbered by creation timestamp, oldest first, including completed and recoverable deleted records. Missing customer creation timestamps fall back to Date of Entry; ties use record ID.
- New successfully saved records receive the next serial. Moving, completing, restoring or editing a record preserves it. Permanent deletion leaves the allocation in a restricted register, so serials are never reused. Already-purged records from before installation cannot be backfilled.
- Existing customer Order Numbers stay blank. The first new order defaults to 1; the business may replace it. Saving a new order as 10 makes the next suggestion 11. Choosing a different number on a subsequent new order establishes that new starting point.
- Editing an older order, including filling its previously blank number, does not move the next-number counter. Customer Order Numbers are positive whole numbers. Existing records can retain a blank number.
- Duplicate Order Numbers require Cancel or Continue Anyway. The check includes the last number retained for deleted/purged records. Confirmation never merges records. Serial Number remains the permanent distinct reference.
- Concurrent automatic suggestions are checked at save time. If another order takes the suggestion first, the form refreshes it and asks the user to review and save again.
- Serial Numbers are visible in active, completed and deleted tables for both modules. Customer tables also show editable Order Numbers. CSV/PDF exports and table filtering/sorting include the new fields.
- New-entry forms show that Serial Number is assigned on save. Existing PO Number and Job Card Number behaviour is unchanged.

The maximum Serial Number represents the number of records allocated since the backfill, including subsequent permanent deletions; it is not the count of rows currently visible.

## Verification

`tests/order-numbering.test.mjs` exercises backfill, rerunning the migration, independent modules, service-role privileges, duplicate confirmation, stale suggestions, immutable serials, older-order edits, delete/restore, permanent purge and rollback on failed saves. Set `PGLITE_MODULE` to an installed PGlite entry point and run `node --test tests/*.test.mjs`.

`tests/order-numbering.browser.mjs` checks the form and editable-table confirmation flow using mocked endpoints on a local test server. It never writes business records.
