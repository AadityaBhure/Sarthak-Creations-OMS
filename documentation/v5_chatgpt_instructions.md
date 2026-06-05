# INSTRUCTIONS FOR CHATGPT — Generate Word Document v5

---

## YOUR TASK

Create a professionally formatted Microsoft Word document titled:
**"Sarthak Creations — Order Management System | Project Documentation v5"**

This document is a finalized project specification for a web-based Order Management System built for a printing and packaging business. It replaces v4 and incorporates all decisions made during a detailed ideation session.

---

## FORMATTING RULES

- Use **Heading 1** for major section titles (numbered, e.g. "1. Project Overview")
- Use **Heading 2** for subsections (e.g. "1.1 Business Background")
- Use **Heading 3** for sub-subsections
- Use **bold** for field names, decision labels, and important terms
- Use **tables** wherever data is comparative or structured (field lists, stack, schema, etc.)
- Use **bullet points** for lists
- Use **numbered lists** for sequential workflows/steps
- Use a **callout/note box style** (shaded paragraph or bordered box) for important notices — label them **NOTE**, **IMPORTANT**, or **DECISION**
- The document should feel like a professional enterprise specification — clean, structured, corporate
- Font: **Calibri** body, **Calibri Light** headings
- Color scheme: Black text on white — minimal color use (only for table headers: light gray shading)
- Page margins: Normal (2.54 cm all sides)
- Include a **Title Page** at the start with:
  - Document title
  - Client name: Sarthak Creations
  - Version: v5
  - Date: June 2026
  - Status: Finalized
- Include a **Table of Contents** after the title page (manual or auto-generated)
- Add **page numbers** in the footer

---

## FULL DOCUMENT CONTENT

Write the following content into the Word document exactly as structured below.

---

# 1. Project Overview

## 1.1 Business Background

Sarthak Creations is a printing and packaging business that currently manages its operations using Microsoft Excel spreadsheets. The client requires a migration to a modern web-based application that simplifies order tracking, production workflow management, filtering, exporting, printing, and operational visibility.

Products handled by the business include medicine cartons, labels, box designs, t-shirt labels, and related printing materials.

## 1.2 Project Objective

Design and develop a web-based Order Management and Production Tracking System that serves as a modernized but familiar replacement for the existing Excel-based workflow. The system must be intuitive enough for tech-illiterate employees while providing the operational power needed for day-to-day business management.

## 1.3 Document Status

This is version 5 of the project documentation. All major decisions have been finalized during the ideation phase. This document represents the complete and approved specification before development begins.

---

# 2. Core Product Philosophy

This section defines the non-negotiable design principles that must govern every decision made during development.

- **Simplicity First** — The application must prioritize simplicity and operational speed over features.
- **Familiarity** — Employees are considered tech-illiterate. The interface must feel familiar to Excel users.
- **Table-Centric** — The system is built around data tables, not dashboards or visualizations.
- **Minimal Stimulation** — A flood of visual information, decorative UI elements, animations, or complex interactions is strictly prohibited. The interface must be calm and focused.
- **Visible Actions** — All actions must be visibly labeled. Nothing should be hidden behind hover effects, icons-only buttons, or collapsed menus.
- **Operational Clarity** — Every screen must have a single clear purpose. Users should never be confused about what a page does.
- **Reduce Typing** — Wherever possible, use dropdowns and searchable selects instead of free-text input to reduce errors.

> **IMPORTANT**: These principles are not aesthetic preferences. They are operational requirements. Any UI decision that conflicts with these principles must be reconsidered.

---

# 3. Technology Stack

> **DECISION**: The following technology stack was finalized during the ideation session.

| Layer | Technology | Reason |
|---|---|---|
| Frontend Framework | Next.js 14 (App Router) | Full-stack, server components, API routes, cron job support |
| Database | Supabase (PostgreSQL) | Managed Postgres, free tier, pg_cron built-in, real-time capable |
| Hosting | Vercel (Hobby/Free Tier) | Zero-config Next.js deployment, cron job support |
| Styling | CSS Modules (Vanilla CSS) | No external dependencies, full control, per-component scoping |
| Font | Inter (Google Fonts) | Clean, professional, highly legible at small sizes |
| Authentication | Custom JWT Session | Single shared login — Supabase Auth not required |
| CSV Parsing | PapaParse | Industry-standard CSV parser, browser and server capable |
| PDF Export | jsPDF + jspdf-autotable | Client-side table-to-PDF generation, no server required |

> **NOTE**: Supabase Auth is intentionally not used. Since all employees share one login credential, a lightweight custom authentication system using environment variable credentials and an httpOnly JWT cookie is sufficient and avoids unnecessary complexity.

---

# 4. Authentication

## 4.1 Login System

- A single shared username and password is used by all employees.
- There are no individual user accounts in this version.
- A login page is provided at /login.
- All other pages are protected and redirect to /login if the user is not authenticated.

## 4.2 Technical Implementation

Authentication flow:
1. User navigates to any protected page and is redirected to /login.
2. User enters the shared username and password.
3. The login API endpoint validates credentials against environment variables.
4. On success, the server sets a signed httpOnly JWT cookie with a 7-day expiry.
5. Next.js middleware checks this cookie on every request.
6. The logout endpoint clears the cookie and redirects to /login.

## 4.3 Environment Variables

The following environment variables must be configured on Vercel before deployment:

| Variable | Description |
|---|---|
| APP_USERNAME | The shared login username |
| APP_PASSWORD | The shared login password |
| JWT_SECRET | A random 64-character string used to sign the session token |
| NEXT_PUBLIC_SUPABASE_URL | The Supabase project URL |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | The Supabase anonymous public key |
| SUPABASE_SERVICE_ROLE_KEY | The Supabase service role key (server-only, never exposed to client) |

---

# 5. System Modules

The application is organized into three modules:

## Module 1 — Orders
- Active Orders
- Completed Orders
- New Order Entry

## Module 2 — Masters
- Client List
- Product Name List
- Product Type List
- Deleted Records (Recycle Bin)

## Module 3 — Dashboard
- Order counts by production status

> **NOTE**: CSV Import has been removed from the Orders module entirely. Order data can only be entered manually through the New Order form. CSV Import is available exclusively in the Masters module (one import button per master page).

> **NOTE**: "Saved Views" have been renamed to "Quick Views" throughout the application.

---

# 6. Database Schema

## 6.1 Primary Tables

### clients

| Column | Type | Constraints |
|---|---|---|
| id | UUID | Primary Key, auto-generated |
| name | TEXT | Not Null, Unique |
| created_at | TIMESTAMPTZ | Default: now() |
| updated_at | TIMESTAMPTZ | Default: now() |

### product_names

| Column | Type | Constraints |
|---|---|---|
| id | UUID | Primary Key, auto-generated |
| name | TEXT | Not Null, Unique |
| created_at | TIMESTAMPTZ | Default: now() |
| updated_at | TIMESTAMPTZ | Default: now() |

### product_types

| Column | Type | Constraints |
|---|---|---|
| id | UUID | Primary Key, auto-generated |
| name | TEXT | Not Null, Unique |
| created_at | TIMESTAMPTZ | Default: now() |
| updated_at | TIMESTAMPTZ | Default: now() |

> **DECISION**: There is no join table between product_names and product_types. Both fields are completely independent in all parts of the system — including the Orders table and the Masters module. No association is stored or enforced between them.

### orders

| Column | Type | Constraints |
|---|---|---|
| id | UUID | Primary Key, auto-generated |
| date_of_entry | DATE | Not Null, Default: today's date |
| po_number | TEXT | Not Null, alphanumeric, non-unique |
| client_id | UUID | Foreign Key → clients.id, Not Null |
| product_name_id | UUID | Foreign Key → product_names.id, Not Null |
| product_type_id | UUID | Foreign Key → product_types.id, Not Null |
| quantity | INTEGER | Not Null, must be greater than 0 |
| status | TEXT | Not Null, Default: 'Design Confirmed' |
| remark | TEXT | Optional, no character limit |
| created_at | TIMESTAMPTZ | Default: now() |
| updated_at | TIMESTAMPTZ | Default: now() |

> **NOTE**: "Days Old" is never stored in the database. It is always computed dynamically as: Today's Date minus Date of Entry.

> **NOTE**: Client name is stored as a Foreign Key (client_id), not as plain text. If a client's name is corrected in Masters, all historical orders automatically reflect the corrected name.

> **NOTE**: PO Number is alphanumeric and is intentionally non-unique. The same PO number can appear on multiple rows.

### quick_views

| Column | Type | Constraints |
|---|---|---|
| id | UUID | Primary Key, auto-generated |
| name | TEXT | Not Null |
| filters | JSONB | Not Null, Default: empty array |
| filter_logic | TEXT | Not Null, Default: 'AND' — values: 'AND' or 'OR' |
| sort_field | TEXT | Optional |
| sort_direction | TEXT | Optional — values: 'asc' or 'desc' |
| visible_columns | JSONB | Not Null, Default: empty array |
| created_at | TIMESTAMPTZ | Default: now() |
| updated_at | TIMESTAMPTZ | Default: now() |

## 6.2 Trash Tables (Recycle Bin)

Each trash table mirrors its source table exactly, with one additional column: deleted_at.

| Trash Table | Mirrors |
|---|---|
| deleted_clients | clients |
| deleted_product_names | product_names |
| deleted_product_types | product_types |
| deleted_orders | orders |

Each trash table includes:
- All columns from its source table (full record preserved)
- deleted_at (TIMESTAMPTZ) — timestamp of when the record was deleted

Records in trash tables are automatically and permanently purged after 10 days via a scheduled database job.

## 6.3 Database Triggers

An updated_at trigger is applied to all primary tables. Whenever a record is updated, the updated_at column is automatically set to the current timestamp. No manual update is required from the application layer.

## 6.4 Auto-Purge Scheduled Job (pg_cron)

A PostgreSQL scheduled job runs every day at midnight and permanently deletes any records from the trash tables where deleted_at is older than 10 days.

This job is configured using Supabase's built-in pg_cron extension, which is available on the free tier. No Vercel compute or external service is required for this job.

---

# 7. Orders Module

## 7.1 Active Orders Page

This is the central and most important page of the application. It displays all orders where status is not 'Completed'.

### Table Columns

| Column | Field Type | Editable | Notes |
|---|---|---|---|
| ☐ (Checkbox) | — | No | Row selection for bulk actions |
| Date of Entry | Date | Yes | Defaults to today. Can be freely changed or backdated. |
| PO Number | Text | Yes | Alphanumeric, non-unique |
| Client Name | Searchable Dropdown | Yes | Must exist in Client master list |
| Product Name | Searchable Dropdown | Yes | Must exist in Product Name master list |
| Product Type | Searchable Dropdown | Yes | Must exist in Product Type master list. Independent from Product Name. |
| Quantity | Number | Yes | Must be a positive integer |
| Days Old | Number | No | Auto-computed: Today minus Date of Entry. Never stored. |
| Status | Dropdown | Yes | Fixed list. Can be changed in any direction. |
| Remark | Text | Yes | Free text. No character limit. |
| Actions | Buttons | — | Row-level delete button (moves record to Recycle Bin) |

### Toolbar Layout

The toolbar above the table contains the following controls, in order:

[ + New Order ] | [ Search... ] | [ Filter ] [ Quick Views ] | [ Columns ] | [ Export ] [ Print ] | [ Editable ☐ ]

### Editing Behavior

> **DECISION**: All editing follows a staged-save model. No auto-save on blur.

1. The table is read-only by default.
2. The user must enable the **Editable** toggle checkbox in the toolbar before any editing is possible.
3. When Editable is ON, the user can click on any cell to edit it.
4. Any edit immediately causes a **floating Save button** to appear (sticky, bottom-right corner of the screen).
5. The Save button displays the number of pending edits: e.g., "Save Changes (3 edits)".
6. The user can make as many edits across as many rows and fields as they want.
7. When the user clicks Save, all staged changes are sent to the server in a single API call.
8. A **Discard** button appears alongside Save to revert all unsaved changes.
9. Edited but unsaved cells are visually highlighted with a subtle border or tint.

### Status Workflow

The status field follows this production pipeline:

1. Design Confirmed
2. Client Approval
3. Finalised
4. Printing
5. Completed

> **DECISION**: Status can be changed in any direction. There is no forward-only enforcement. Employees can manually set any status at any time.

### Filtering System

The filtering panel opens below the toolbar and supports multiple filter rules.

Each filter row has three parts: [Field] [Operator] [Value]

Dynamic operators based on field type:

| Field Type | Available Operators |
|---|---|
| Text | is, is not, contains |
| Number | equals, greater than, less than, less than or equal, greater than or equal, between |
| Date | before, after, between |

Multiple filter rows can be combined using AND or OR logic (toggled with a single button).

Filter values for dropdown-based fields (Client, Status, etc.) use searchable dropdowns populated from the database.

Buttons in the filter panel: Add Filter, Remove (per row), Clear All, Apply, Save as Quick View.

### Quick Views

Quick Views are saved filter configurations that allow employees to apply a complex filter set with one click.

- Saved views include: filter rules, AND/OR logic, sort field, sort direction, and visible columns.
- All Quick Views are shared across all users. Any user can create, edit, or delete them.
- Quick Views appear in a dropdown in the toolbar.
- Clicking a Quick View instantly applies all its settings to the table.
- Users can save the current filter state as a new Quick View by providing a name.

### Bulk Actions

When one or more rows are selected via checkbox, a bulk action bar appears at the top or bottom of the table with the following options:

- **Update Status** — Apply a selected status to all chosen rows
- **Delete** — Move all selected rows to the Recycle Bin
- **Export** — Export selected rows to CSV or PDF
- **Print** — Print selected rows
- **Clear Selection** — Deselect all rows

### Pagination

- Page size options: 25, 50, or 100 rows per page
- Navigation: Previous / Next buttons with page number
- Status line: "Showing X to Y of Z records"

## 7.2 Completed Orders Page

The Completed Orders page displays all orders where status equals 'Completed'.

- The status filter is applied server-side and cannot be removed by the user.
- The page is fully editable — the Editable toggle works identically to Active Orders.
- Status can be changed in any direction, including moving an order back to a non-completed status (e.g., back to Printing).
- All other features are available: search, filter, sort, export, print, bulk actions, Quick Views.

## 7.3 New Order Form

A full-page form for entering a single new order manually.

| Field | Input Type | Default | Validation |
|---|---|---|---|
| Date of Entry | Date Picker | Today's date | Required |
| PO Number | Text Input | — | Required |
| Client Name | Searchable Select | — | Required. Must exist in Client master. |
| Product Name | Searchable Select | — | Required. Must exist in Product Name master. |
| Product Type | Searchable Select | — | Required. Must exist in Product Type master. Independent of Product Name. |
| Quantity | Number Input | — | Required. Must be greater than 0. |
| Status | Dropdown | Design Confirmed | Required. |
| Remark | Textarea | — | Optional. No character limit. |

Form action buttons:
- **Save Order** — saves and returns to Active Orders
- **Save & Add Another** — saves and resets the form for the next order
- **Cancel** — returns to Active Orders without saving

---

# 8. Masters Module

## 8.1 Client List

- Displays a table of all active clients: Name, Date Added, Actions.
- **Add Client**: Button at the top that adds a new row inline or opens a simple modal.
- **Edit**: Inline editing of client name.
- **Delete**: Moves the client to the Recycle Bin (not permanent).
- **Import CSV**: Button to import clients from a CSV file (see Section 8.5 for workflow).
- **Search**: Filter the list by name.

## 8.2 Product Name List

- Displays a table of all active product names: Name, Date Added, Actions.
- **Add Product Name**: Inline or modal entry.
- **Edit**: Inline editing.
- **Delete**: Moves to Recycle Bin.
- **Import CSV**: Per-page CSV import with DB validation.
- **Search**: Filter by name.

> **DECISION**: Product Names have no stored association with Product Types. They are completely independent. The many-to-many join table has been removed from the design.

## 8.3 Product Type List

- Displays a table of all active product types: Name, Date Added, Actions.
- **Add Product Type**: Inline or modal entry.
- **Edit**: Inline editing.
- **Delete**: Moves to Recycle Bin.
- **Import CSV**: Per-page CSV import with DB validation.
- **Search**: Filter by name.

## 8.4 Deleted Records — Recycle Bin

This page shows all records that have been deleted from any master table or from the Orders table.

Layout: Tabbed view with four tabs — Clients | Product Names | Product Types | Orders

Each record in the Recycle Bin displays:

| Column | Description |
|---|---|
| Record Details | All original fields of the record |
| Deleted On | The date and time the record was deleted |
| Purge In | Countdown to permanent deletion (e.g., "7 days", "1 day", "Purging today") |
| Actions | Restore button, Delete Permanently button |

Actions:
- **Restore**: Moves the record back to its original active table. It reappears as if it was never deleted.
- **Delete Permanently**: Immediately and irreversibly removes the record from the Recycle Bin, before the 10-day auto-purge.

Bulk actions available: Bulk Restore, Bulk Permanent Delete.

> **NOTE**: The auto-purge runs daily at midnight via pg_cron. Any record in the Recycle Bin older than 10 days is automatically and permanently deleted with no further notification.

## 8.5 CSV Import (Per Master Page)

Each master page (Clients, Product Names, Product Types) has its own CSV import system. The same workflow applies to all three.

### CSV Import Workflow

1. User clicks the **Import CSV** button on the master page.
2. A file picker opens. Only .csv files are accepted.
3. The file is uploaded and parsed using PapaParse.
4. The server validates every row against the existing database before any insert.
5. A preview window opens showing all rows categorized as:
   - Valid (green) — new record, ready to import
   - Warning (yellow) — record already exists in the database, will be skipped
   - Error (red) — empty or invalid name, will be skipped
6. The user reviews the preview and clicks **Import Valid Records** or **Cancel**.
7. Only valid, non-duplicate records are inserted into the database.
8. A summary is shown: e.g., "8 imported · 2 skipped (already exist) · 1 skipped (empty name)"

### CSV Template

Each master page provides a **Download Template** button that downloads a blank .csv file with the correct column headers for that entity.

### Error Messages

All error messages shown to the user must be business-readable. Technical or database-level errors must never be exposed. Examples:

- "Row 3 — Name is empty. This row will be skipped."
- "Row 7 — 'Reliance Packaging' already exists. This row will be skipped."

---

# 9. Dashboard

The Dashboard is the first page users see after logging in.

## 9.1 Layout

The Dashboard displays one card for each status value, plus one card for Total Active Orders.

Cards displayed:

| Card Label | Shows |
|---|---|
| Design Confirmed | Count of orders with this status |
| Client Approval | Count of orders with this status |
| Finalised | Count of orders with this status |
| Printing | Count of orders with this status |
| Completed | Count of orders with this status |
| Total Active | Count of all orders where status is not 'Completed' |

## 9.2 Behavior

- Data is fetched fresh on every Dashboard load.
- Clicking any status card navigates to the Active Orders page (or Completed Orders for the Completed card) with that status pre-applied as a filter.

---

# 10. Export and Print

## 10.1 CSV Export

- Available from the toolbar (Export button) and from the bulk action bar.
- If rows are selected: exports only the selected rows.
- If no rows are selected: exports all records on the current page.
- Only currently visible columns are included in the export.

## 10.2 PDF Export

- Uses jsPDF and jspdf-autotable libraries (client-side generation).
- If rows are selected: exports only the selected rows.
- If no rows are selected: exports all records on the current page.
- Column headers are the visible column names.
- File is named: sarthak-orders-YYYY-MM-DD.pdf

## 10.3 Print

- Opens a print-specific view.
- If rows and/or columns are selected: prints only those rows and columns.
- If nothing is selected: prints all records on the current page with all visible columns.
- The browser's native print dialog opens automatically.
- All toolbar, navigation, and action UI is hidden in print view.

---

# 11. Trash and Recycle Bin System

## 11.1 How It Works

Deletion in this system is never immediate or permanent from the user's perspective. The process is:

1. User deletes a record (single or bulk) from any table.
2. The record is removed from the primary table.
3. The full record is inserted into the corresponding trash table (e.g., deleted_clients), along with a deleted_at timestamp.
4. The record appears in the Recycle Bin (Masters > Deleted Records) with a purge countdown.
5. After 10 days, the record is automatically and permanently purged by a daily scheduled database job.

## 11.2 User Actions on Trash Records

- **Restore**: Record is moved back to its source table and reactivated.
- **Delete Permanently**: Record is immediately and irreversibly removed from the Recycle Bin.

## 11.3 Auto-Purge Schedule

- Method: Supabase pg_cron (built-in PostgreSQL scheduler, available on free tier)
- Schedule: Daily at midnight
- Action: Deletes all records from all trash tables where deleted_at is older than 10 days
- Cost: Zero — runs entirely inside the database, no external compute required

---

# 12. Keep-Alive System

## 12.1 Problem

Supabase free-tier projects are automatically paused after 7 days of inactivity. A paused project takes approximately 30 seconds to wake up, which would appear as an outage to users.

## 12.2 Solution

A Vercel Cron Job runs every 3 days and sends a lightweight HTTP request to the application's own /api/keepalive endpoint. This endpoint performs a minimal database query to keep the Supabase project active.

## 12.3 Configuration

Vercel is configured via a vercel.json file in the project root:

Schedule: Every 3 days at midnight (cron expression: 0 0 */3 * *)
Target: /api/keepalive

The /api/keepalive endpoint performs a single minimal database query (fetch one record from the clients table) and returns HTTP 200 OK. The response data is discarded.

## 12.4 Cost

- Vercel Cron Jobs: Included in the free Hobby tier (approximately 10 invocations per month)
- Supabase queries: Negligible (one lightweight query per invocation)
- Total additional cost: Zero

---

# 13. UI Design Principles

> **IMPORTANT**: These principles are mandatory. They are not suggestions. Any deviation requires explicit client approval.

## 13.1 Core Mandate

The UI must be strictly minimal and calm. Employees are less tech-literate and are accustomed to Excel. A visually stimulating, decorative, or complex interface will cause confusion and operational errors.

Every element on screen must earn its presence. If it does not directly help the user complete a task, it should not be there.

## 13.2 Theme

- Primary theme: Black and White corporate style
- Default mode: Light Mode
- Light Mode: White background, dark near-black text, light gray borders, black buttons
- Dark Mode: Dark gray / near-black background, light text, muted borders
- A Light/Dark mode toggle is available in the top navigation bar
- No brand accent colors. The only use of color in the interface is for status badges, which use muted, desaturated tones.

### Status Badge Colors (muted in both modes)

| Status | Badge Color |
|---|---|
| Design Confirmed | Gray |
| Client Approval | Muted amber / yellow |
| Finalised | Muted blue |
| Printing | Muted indigo / purple |
| Completed | Muted green |

## 13.3 Typography

- Font: Inter (loaded from Google Fonts)
- Table cells: 13–14px, regular weight
- Column headers: 14px, medium weight
- Page titles: Heading sizes, no decorative fonts
- No font mixing

## 13.4 Layout

- Fixed left sidebar navigation with clear text labels (no icon-only navigation)
- Tables are full-width, not contained inside cards or panels
- Adequate whitespace between elements — nothing cramped
- Minimum supported viewport: 1280px wide (desktop only — no mobile support in this version)

## 13.5 Interactions

- Zero animations — no transitions, no slide-ins, no fades, no keyframe effects
- Buttons respond instantly; loading spinners are shown only during server requests
- Hover states: subtle background tint only — no transforms, no box shadows
- Focus states: clear keyboard focus ring (for accessibility)
- All actions are visibly labeled — nothing hidden behind hover-only reveals or icon-only buttons

## 13.6 Forms and Inputs

- Large, clearly bordered input fields
- Dropdown fields use a searchable select (user can type to filter options)
- Error messages appear inline, directly below the field, in plain business language
- Required fields are marked with an asterisk (*)

## 13.7 Empty and Error States

- Empty table: Centered message — "No orders found." with an optional action button
- Network error: Banner at the top — "Could not load data. Please refresh."
- Validation error: Inline below the field — written in plain language, never technical

---

# 14. Application Routes

## 14.1 Page Routes

| Route | Description |
|---|---|
| / | Redirects to /dashboard if logged in, or /login if not |
| /login | Login page — shared credentials |
| /dashboard | Dashboard with order counts by status |
| /orders | Active Orders table (all orders where status is not Completed) |
| /orders/completed | Completed Orders table (status = Completed) |
| /orders/new | New Order form (full page) |
| /masters/clients | Client List master page |
| /masters/product-names | Product Name List master page |
| /masters/product-types | Product Type List master page |
| /masters/deleted | Deleted Records — Recycle Bin (tabbed by entity type) |

## 14.2 API Routes

| Route | Method | Description |
|---|---|---|
| /api/auth/login | POST | Validates credentials and sets httpOnly JWT cookie |
| /api/auth/logout | POST | Clears the session cookie |
| /api/keepalive | GET | Lightweight DB ping for Supabase keep-alive cron |
| /api/orders | GET, POST | List orders (with filter/sort/pagination), create new order |
| /api/orders/[id] | PATCH, DELETE | Update order, or move to Recycle Bin |
| /api/orders/bulk | POST | Bulk status update, bulk delete, bulk export |
| /api/clients | GET, POST | List clients, create new client |
| /api/clients/[id] | PATCH, DELETE | Update client, or move to Recycle Bin |
| /api/clients/import | POST | Master CSV import with DB validation |
| /api/product-names | GET, POST | List product names, create new |
| /api/product-names/[id] | PATCH, DELETE | Update, or move to Recycle Bin |
| /api/product-names/import | POST | Master CSV import with DB validation |
| /api/product-types | GET, POST | List product types, create new |
| /api/product-types/[id] | PATCH, DELETE | Update, or move to Recycle Bin |
| /api/product-types/import | POST | Master CSV import with DB validation |
| /api/trash/[table] | GET, DELETE | List trash records, permanently delete a record |
| /api/trash/[table]/restore | POST | Restore a record from Recycle Bin to its source table |
| /api/quick-views | GET, POST | List all Quick Views, create new |
| /api/quick-views/[id] | PATCH, DELETE | Update or delete a Quick View |

---

# 15. Development Phases

Development is planned across 7 phases over approximately 7 weeks.

## Phase 1 — Foundation (Week 1)

- Initialize Next.js 14 project with App Router
- Connect Supabase project and configure environment variables
- Create all database tables (primary tables and trash tables) via Supabase SQL editor
- Set up pg_cron auto-purge job in Supabase
- Set up updated_at auto-update triggers on all primary tables
- Implement authentication: login page, API route, Next.js middleware, cookie session
- Build application shell: sidebar navigation, header, page layout
- Set up CSS design system: CSS variables, typography scale, table styles, button styles, form styles
- Deploy skeleton to Vercel and verify all environment variables are live

## Phase 2 — Masters Module (Week 2)

- Build Client List page: full CRUD (add, edit inline, delete to Recycle Bin) with CSV import
- Build Product Name List page: full CRUD with CSV import
- Build Product Type List page: full CRUD with CSV import
- Build per-master CSV import system: parse, validate against DB, preview window, summary
- Build Deleted Records / Recycle Bin page: tabbed view, restore, permanent delete, purge countdown

## Phase 3 — Orders Core (Week 3)

- Build Active Orders table with pagination
- Implement column sorting
- Implement global search
- Implement Editable toggle and cell-level click-to-edit behavior
- Implement floating Save / Discard button with edit count
- Implement inline status dropdown with badge rendering
- Implement row-level delete (move to Recycle Bin)
- Build Completed Orders page (same structure, filtered by status)

## Phase 4 — Orders Advanced (Week 4)

- Build filtering panel: 3-part filter rows, dynamic operators, AND/OR logic
- Implement filter processing on the backend (Supabase query builder)
- Build Quick Views: save current config, list saved views, apply, edit, delete
- Build New Order form (full page at /orders/new)

## Phase 5 — Bulk Actions and Export (Week 5)

- Implement bulk row selection (per-row checkbox and select-all)
- Implement bulk status update
- Implement bulk delete (move to Recycle Bin)
- Implement bulk CSV export
- Implement bulk PDF export (jsPDF + jspdf-autotable)
- Implement print functionality
- Implement column visibility toggle

## Phase 6 — Dashboard and System (Week 6)

- Build Dashboard page with status count cards
- Implement dashboard card navigation (click to orders with pre-applied filter)
- Implement keep-alive Vercel cron job
- Add vercel.json cron configuration
- Write environment variable setup documentation

## Phase 7 — Quality Assurance and Polish (Week 7)

- End-to-end testing of all workflows
- Test all error states: empty tables, network failures, validation errors
- Implement and test Light/Dark mode toggle across all pages
- Verify desktop layout at minimum 1280px width
- Cross-browser testing: Chrome and Edge
- Performance check: table load time, filter response time
- UI audit: confirm zero animations, no visual noise, all actions visible
- Final review with client

---

# 16. Global Features Summary

| Feature | Status |
|---|---|
| Export to CSV | Included — selected rows or current page |
| Export to PDF | Included — selected rows or current page |
| Selective Printing | Included — selected rows/columns or current page |
| Bulk Actions | Included — status update, delete, export, print |
| Filtering | Included — 3-part filter, dynamic operators, AND/OR |
| Column Sorting | Included |
| Global Search | Included |
| Inline Editing (cell-level) | Included — requires Editable toggle |
| Staged Save | Included — floating Save button, single commit |
| Quick Views | Included — shared, editable by all users |
| CSV Import | Included — Masters module only (per entity) |
| Recycle Bin (10-day trash) | Included — with restore and manual delete |
| Dashboard | Included — status count cards |
| Light/Dark Mode | Included — toggle in navigation bar |
| Keep-Alive Cron | Included — every 3 days via Vercel |
| Auto-Purge (pg_cron) | Included — daily at midnight, 10-day threshold |
| Mobile Support | Not included in this version |
| Role-Based Access Control | Not included in this version |
| Audit Log | Not included in this version |
| Per-User Accounts | Not included in this version |

---

# 17. Out of Scope (This Version)

The following items have been explicitly discussed and confirmed as out of scope for the current version:

- Mobile or tablet support
- Role-based access control or permission levels
- Per-user accounts (single shared login only)
- Audit logging (who changed what)
- Order history or version tracking
- Automated notifications or email alerts
- Aging order visual alerts (e.g., red highlight after 7 days)
- CSV import for the Orders module
- Supplier or vendor management
- Invoice or billing generation
- Integration with any external system

---

# 18. Decisions Reference Table

> Use this table for quick reference to all key decisions made during the ideation phase.

| Decision Area | Decision Made |
|---|---|
| Tech stack | Next.js 14 + Supabase + Vercel |
| Hosting | Vercel Hobby (free tier) |
| Database | Supabase PostgreSQL (free tier) |
| Authentication | Single shared login — one username and password for all employees |
| Auth method | Custom JWT cookie — no Supabase Auth |
| Product Name / Product Type relationship | Completely independent — no join table |
| PO Number | Alphanumeric, non-unique |
| Days Old calculation | Today minus Date of Entry — never stored |
| Date of Entry default | Today's date, freely editable and backdatable |
| Inline edit save behavior | Staged edits — floating Save button commits all changes at once |
| Status direction | Bidirectional — can be changed to any status at any time |
| Completed Orders editing | Fully editable — same behavior as Active Orders |
| New Order entry | Full-page form at /orders/new |
| CSV import scope | Masters module only (Clients, Product Names, Product Types) |
| Order deletion | Moves to Recycle Bin (10-day trash), not permanent |
| Recycle Bin restore | Available — Restore button per record |
| Recycle Bin manual delete | Available — Delete Permanently button per record |
| Auto-purge method | Supabase pg_cron — daily at midnight, 10-day threshold |
| Purge countdown visibility | Yes — shown per record in Recycle Bin |
| Keep-alive mechanism | Vercel cron every 3 days → /api/keepalive → minimal Supabase query |
| Audit log | Removed — not included |
| Dashboard | Yes — status count cards, clickable to filtered Orders page |
| Quick Views (Saved Views) | Shared by all users — any user can create, edit, or delete |
| Theme | Black and White corporate — Light/Dark mode toggle |
| Animations | Zero — strictly none |
| Mobile support | Not included in this version |
| Minimum viewport | 1280px wide (desktop only) |

---

END OF DOCUMENT

---

> This document was prepared based on ideation sessions conducted in June 2026. All decisions listed are finalized and approved. Development may begin upon receipt of this document by the development team.
