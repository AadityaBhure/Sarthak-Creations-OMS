# Phase 5 — Vendor-wise Ledger

Run `supabase/migrations/20261029_vendor_ledger.sql` in Supabase SQL Editor after the Phase 4 status migration. Refresh the application. The migration is transactional and safe to rerun; it adds a read-only view and a stage lookup index, without changing business records. This task does not apply it to the live database.

Vendor Job Tracking → Jobs → Vendor-wise Ledger shows one row per saved stage, including repeated visits to the same vendor on the same card. The displayed vendor and work come from that stage, not the card's current vendor/job. Existing saved history appears immediately; new saved progress stages appear on refresh. Unsaved dropdown changes never create entries.

The page provides a vendor selector (including deleted vendors), advanced filters, quick views, sorting, column selection, pagination, row selection, CSV/PDF export and print. Exports use selected rows or the current page and visible columns, following the existing table pattern; print uses the current page.

Active, Hold, Completed and Canceled cards are included. Cards in Deleted Records are excluded by default and can be included with the checkbox. Their deletion date is shown. Permanently purged cards/stages cannot be reconstructed. Stage corrections, reordering and removals update this report; it is a view of saved history, not an immutable audit log or a financial ledger.

Stage date/time is the saved stage start in India time. Stage No. is the position in that card's sequence. Quantity, title, paper, product type and status reflect the card's current details. Quantity repeats across visits and must not be summed as distinct production quantities. There are no prices, payments or balances in this phase.

Module 1 workflows and all existing Job Card mutations remain unchanged.
