# Sarthak Creations — Order Management System (OMS)
## Complete Technical Architecture & System Specification

> **Purpose of this Document:** This document provides an exhaustive, end-to-end technical overview of the Sarthak Creations Order Management System (OMS). It covers the business problem, UX design philosophy, full technology stack, frontend/backend architecture, database schema, security mechanisms, API routes, and operational workflows. It is structured so that an AI model (such as ChatGPT) can gain 100% full context of the project codebase, design decisions, and data structures.

---

## 1. Executive Summary & Business Context

### 1.1 Business Background
**Sarthak Creations** is a high-volume manufacturing enterprise in the printing and packaging industry. The company operates a physical factory floor where manufacturing jobs move through multiple distinct stages: artwork design, client proofing, plate making, printing, cutting, folding, gluing, and final dispatch. Products include custom pharmaceutical cartons (e.g., Paracetamol boxes), product labels, corrugated packaging, and commercial print materials.

### 1.2 The Problem Domain (Pre-OMS)
Before this system was implemented, Sarthak Creations relied on disjointed, localized Microsoft Excel spreadsheets to manage factory operations. This manual process resulted in critical operational bottlenecks:
* **Concurrency Conflicts:** Multiple executives could not update the spreadsheet simultaneously without creating conflicting file copies.
* **Data Loss & Accidental Overrides:** Cells were frequently overwritten or deleted accidentally, with zero recovery mechanism.
* **Lack of Accountability:** Management had no audit trail to identify who changed an order quantity, modified a PO number, or altered target completion dates.
* **Tracking & Aging Inefficiencies:** Calculating overdue orders or tracking which executive was responsible for which job required tedious manual filtering.

### 1.3 System Objectives & Core Philosophy
The OMS acts as a centralized "brain" for the management, design team, and factory floor.
* **Utilitarian Spreadsheet UI:** Built specifically for non-technical users accustomed to Excel. The interface features high information density, zero visual animations, auto-expanding text inputs, and explicit `[Editable]` table modes with staged bulk saves.
* **Zero Data Loss Guarantee:** Implements a soft-delete "Recycle Bin" architecture backed by automated PostgreSQL cron jobs (`pg_cron`) that retain deleted records for 10 days before hard-purging.
* **100% Operational Transparency:** An immutable `activity_logs` table records a JSONB snapshot of every `CREATE`, `UPDATE`, or `DELETE` action across the application.
* **Localized Formatting:** All numbers and quantities enforce the **Indian Numbering System** (e.g., `10,00,000` instead of `1,000,000`) across UI, CSV exports, and generated PDFs.

---

## 2. Technology Stack & Dependencies

| Layer | Technology / Package | Purpose & Justification |
|---|---|---|
| **Framework** | Next.js 16 (App Router) | Server-side rendering (RSC), serverless API routes, edge proxy capabilities. |
| **UI Library** | React 19 & React DOM 19 | Core UI component lifecycle. |
| **Backend & DB** | Supabase (Managed PostgreSQL) | Managed relational database exposing REST endpoints, triggers, and `pg_cron`. |
| **Authentication** | `jose` (JWT) & `bcryptjs` | Stateless JWT tokens stored in `httpOnly` secure cookies; bcrypt for password hashing. |
| **Edge Proxy** | Custom `proxy.js` | Edge middleware route protection verifying JWT integrity on every request. |
| **Styling Engine** | Vanilla CSS Modules | Zero UI library overhead. Uses native CSS variables (`globals.css`) for instant Light/Dark mode toggling. |
| **Exports & Reports** | `jspdf` & `jspdf-autotable` | Client-side letterhead PDF rendering of active tables and order sheets. |
| **CSV Handling** | `papaparse` | Streamed parsing and bulk export/import of CSV order files. |
| **Excel & Compression** | `xlsx` & `jszip` | Database backup exports and Excel spreadsheet parsing. |
| **UI Components** | `react-select` | Accessible searchable dropdowns for client and product selection. |

---

## 3. System Architecture & Routing Structure

```
Sarthak Creations OMS/
├── codefiles/
│   ├── TECHNICAL_SPECIFICATION.md     # This comprehensive specification document
│   ├── proxy.js                       # Next.js 16 Edge Proxy / Authentication Guard
│   ├── app/
│   │   ├── (protected)/               # Authenticated Route Group (Requires JWT)
│   │   │   ├── layout.js              # Protected App Shell (Sidebar, Header, Navigation)
│   │   │   ├── dashboard/             # Executive Dashboard & Visual Funnels
│   │   │   ├── orders/                # Active Orders Table & Pipeline Grid
│   │   │   │   ├── completed/         # Completed Orders Archive Table
│   │   │   │   └── new/               # New Order Creation Form
│   │   │   ├── masters/               # System Dictionary Masters
│   │   │   │   ├── clients/           # Customer Master Directory
│   │   │   │   ├── product-names/     # Product Dictionary (Linked to Clients)
│   │   │   │   ├── product-types/     # Product Type Dictionary (Carton, Box, etc.)
│   │   │   │   ├── executives/        # Executive / Staff Administration
│   │   │   │   └── deleted/           # Trash / Recycle Bin Management
│   │   │   ├── quick-views/           # Saved Relational Filter Configurations
│   │   │   ├── settings/              # Dynamic Status & Print Settings
│   │   │   └── help-desk/             # System Documentation & Support
│   │   ├── api/                       # Backend Serverless Route Handlers
│   │   │   ├── auth/ (login, logout, verify-password)
│   │   │   ├── orders/ (CRUD, search, migrate-status)
│   │   │   ├── clients/ (CRUD, bulk, import)
│   │   │   ├── executives/ (CRUD)
│   │   │   ├── product-names/ & product-types/
│   │   │   ├── trash/ (restore, purge)
│   │   │   ├── logs/ (fetch, cleanup, export)
│   │   │   ├── export-database/ & keepalive/
│   │   └── globals.css                # CSS Variables & Global Typography
│   ├── lib/                           # Core Utilities & Privileged Clients
│   │   ├── supabaseClient.js          # Server & Browser Supabase Instances
│   │   ├── auth.js                    # JWT Sign / Verify & DB Revocation Checks
│   │   └── logger.js                  # Audit Trail Ingestion Utility
│   └── supabase/
│       └── schema.sql                 # Master PostgreSQL Schema & Triggers
```

---

## 4. Complete Database Schema (PostgreSQL / Supabase)

### 4.1 Primary Operational Tables

#### `users` (Executives & Administrators)
Stores system user accounts, hashed credentials, and roles.
```sql
CREATE TABLE users (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name     TEXT        NOT NULL,
  last_name      TEXT        NOT NULL,
  username       TEXT        NOT NULL UNIQUE,
  phone_number   TEXT        NOT NULL UNIQUE,
  password_hash  TEXT        NOT NULL,
  role           TEXT        NOT NULL DEFAULT 'executive', -- 'admin' or 'executive'
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### `clients` (Master Customer List)
```sql
CREATE TABLE clients (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL UNIQUE,
  address    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### `product_names` & `product_types` (Decoupled Dictionaries)
Separated to prevent complex join tables while allowing flexible combinations (e.g., Type: `Carton`, Name: `Paracetamol 500mg`).
```sql
CREATE TABLE product_names (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  client_id  UUID        REFERENCES clients(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE product_types (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### `orders` (Core Production Ledger)
```sql
CREATE TABLE orders (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  date_of_entry    DATE        NOT NULL DEFAULT CURRENT_DATE,
  po_number        TEXT        NOT NULL,
  client_id        UUID        NOT NULL REFERENCES clients(id),
  product_name_id  UUID        NOT NULL REFERENCES product_names(id),
  product_type_id  UUID        NOT NULL REFERENCES product_types(id),
  quantity         INTEGER     NOT NULL CHECK (quantity > 0),
  status           TEXT        NOT NULL DEFAULT 'Design Confirmed'
                               CHECK (status IN ('Design Confirmed','Client Approval','Finalised','Printing','Completed')),
  remark           TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### `activity_logs` (Immutable System Audit Ledger)
Captures full before-and-after snapshots of record modifications.
```sql
CREATE TABLE activity_logs (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID,       -- Not FK constrained so logs persist if user is deleted
  username       TEXT,       -- Stored explicitly for historical clarity
  action         TEXT        NOT NULL, -- 'CREATE', 'UPDATE', 'DELETE'
  module         TEXT        NOT NULL, -- 'orders', 'clients', 'executives', etc.
  record_id      UUID,
  details        JSONB,      -- Contains { before: {...}, after: {...} }
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### `quick_views` (Saved Relational Filters)
```sql
CREATE TABLE quick_views (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT        NOT NULL,
  filters        JSONB       NOT NULL DEFAULT '[]',
  filter_logic   TEXT        NOT NULL DEFAULT 'AND' CHECK (filter_logic IN ('AND','OR')),
  sort_field     TEXT,
  sort_direction TEXT        CHECK (sort_direction IN ('asc','desc')),
  visible_columns JSONB      NOT NULL DEFAULT '[]',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

### 4.2 Soft-Delete (Trash) Architecture & Auto-Purge Cron

To prevent catastrophic accidental deletions, no primary record is hard-deleted from the API. Mirrored tables store archived records:
* `deleted_clients`
* `deleted_product_names`
* `deleted_product_types`
* `deleted_orders`

Each trash table includes a `deleted_at TIMESTAMPTZ NOT NULL DEFAULT now()` column.

#### Automated `pg_cron` Purge Job
A background PostgreSQL cron job executes every midnight, dropping trash older than 10 days:
```sql
SELECT cron.schedule(
  'purge-trash-daily',
  '0 0 * * *',
  $$
    DELETE FROM deleted_clients       WHERE deleted_at < now() - INTERVAL '10 days';
    DELETE FROM deleted_product_names WHERE deleted_at < now() - INTERVAL '10 days';
    DELETE FROM deleted_product_types WHERE deleted_at < now() - INTERVAL '10 days';
    DELETE FROM deleted_orders        WHERE deleted_at < now() - INTERVAL '10 days';
  $$
);
```

---

## 5. Security & Authentication Flow

### 5.1 Stateless JWT Sessions
* **Cookie-Based Sessions:** Upon successful authentication (`/api/auth/login`), the server signs a JWT using the `jose` library (HS256 algorithm) containing `userId`, `username`, and `role`.
* **Cookie Attributes:** Stored in an `httpOnly`, `SameSite=Lax`, `Path=/` cookie named `session` with a 7-day expiration. Accessible only by Node.js server routes and Next.js proxy middleware.

### 5.2 Next.js Edge Proxy (`proxy.js`)
Every incoming HTTP request passes through `proxy.js`:
1. **Public Paths:** Bypass verification for `/login`, `/api/auth/login`, `/api/auth/logout`.
2. **Token Verification:** Extracts the `session` cookie and runs `verifyToken(token)`.
3. **Database Liveness Check:** `verifyToken` not only checks cryptographic signature but also queries `users.id` in PostgreSQL to immediately revoke sessions if an executive was deleted or disabled by an admin.
4. **Redirection:** Unauthenticated requests are immediately redirected to `/login` before page rendering occurs.

---

## 6. Key Feature Implementations & UX Mechanics

### 6.1 Spreadsheet-Style Data Grid & Staged Bulk Saves
* **Default Read-Only:** Table cells are non-editable by default to avoid accidental keypresses.
* **Editable Mode Toggle:** Users click an `[Editable]` action button to unlock the grid.
* **State Staging:** Cell edits are staged in React component state (`editedRows`). Modified cells display subtle visual indicators.
* **Bulk Transaction:** A floating action bar prompts the user to either "Discard" or "Save Changes". Clicking "Save" dispatches a single bulk HTTP request (`POST /api/orders/bulk` or `PATCH`), updating PostgreSQL in a single database transaction.

### 6.2 Target Dates & Visual Overdue Metrics
* Orders feature entry dates (`date_of_entry`) and target completion dates (`target_date`).
* The system dynamically evaluates `target_date < CURRENT_DATE`.
* Overdue orders render in high-contrast red warning badges indicating exact days overdue (e.g., `+4 Days Overdue`).

### 6.3 3-Part Relational Filtering Engine
Users can stack arbitrary dynamic filters using a 3-part paradigm: `[Field] [Operator] [Value]`.
* Example: `(Status EQUALS "Printing") AND (Quantity GREATER THAN 5000)`.
* Filter state can be saved as a reusable preset into `quick_views` and recalled with a single click.

### 6.4 PDF Generation & Smart Print
* **PDF Export:** Integrates `jsPDF` and `jspdf-autotable` to format current table states into printable, letter-headed PDF order sheets with Indian Numbering formatting (`10,00,000`).
* **Smart Print:** `@media print` CSS rules automatically hide sidebars, top headers, action buttons, and pagination controls, expanding the data grid to perfectly fit standard A4 paper.

---

## 7. Developer & Operations Guide

### 7.1 Environment Variables (`.env.local`)
```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-id>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
JWT_SECRET=64_character_random_string...
```

### 7.2 Database Maintenance Endpoint (`/api/keepalive`)
Configured via `vercel.json` to receive periodic automated pings every 3 days, ensuring free-tier Supabase database instances do not pause due to inactivity.

---
*Document compiled for Sarthak Creations OMS — Architecture & Engineering Specification.*
