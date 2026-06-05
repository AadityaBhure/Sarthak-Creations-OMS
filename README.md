<div align="center">

# 🖨️ Sarthak Creations — Order Management System

**A web-based Order Management and Production Tracking System**
built for a printing and packaging business.

[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=flat-square&logo=supabase)](https://supabase.com/)
[![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=flat-square&logo=vercel)](https://vercel.com/)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue?style=flat-square)](https://opensource.org/licenses/Apache-2.0)
[![Status](https://img.shields.io/badge/Status-In%20Development-orange?style=flat-square)]()

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Database Schema](#-database-schema)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Local Development](#local-development)
  - [Environment Variables](#environment-variables)
- [Supabase Setup](#-supabase-setup)
  - [Create Tables](#create-tables)
  - [Set Up Triggers](#set-up-triggers)
  - [Set Up pg_cron (Auto-Purge)](#set-up-pg_cron-auto-purge)
- [Deployment (Vercel)](#-deployment-vercel)
- [Application Modules](#-application-modules)
  - [Dashboard](#dashboard)
  - [Orders Module](#orders-module)
  - [Masters Module](#masters-module)
- [Filtering Architecture](#-filtering-architecture)
- [Trash / Recycle Bin System](#-trash--recycle-bin-system)
- [Keep-Alive System](#-keep-alive-system)
- [UI Design Principles](#-ui-design-principles)
- [Development Phases](#-development-phases)
- [Contributing](#-contributing)

---

## 🧭 Overview

Sarthak Creations OMS is a full-stack web application designed to replace an Excel-based order management workflow for a printing and packaging business. It handles the complete production pipeline — from order entry through design confirmation, client approval, finalisation, printing, and completion.

The system is built for **operational clarity** and **non-technical users**. It deliberately avoids complex UI patterns, animations, and hidden interactions in favour of a clean, table-centric interface that feels familiar to Excel users.

**Core Workflow:**
```
New Order Entered → Active Orders Table → Status Updated Manually → Completed Orders
```

**Products handled by the business:**
Medicine cartons · Labels · Box designs · T-shirt labels · General printing materials

---

## ✨ Features

### Orders
- 📋 **Active Orders Table** — Full data table with inline editing, sorting, search, filtering
- ✅ **Completed Orders Table** — Same structure, filtered by Completed status
- ➕ **New Order Form** — Full-page form with validation and searchable dropdowns
- 🔒 **Editable Toggle** — Table is read-only by default; editing requires explicit toggle
- 💾 **Staged Save** — Floating Save button commits all pending edits in one API call
- 🔢 **Days Old** — Auto-computed from Date of Entry to today (never stored)

### Filtering & Views
- 🔍 **Global Search** — Server-side text search across all fields
- ⊞ **3-Part Filter System** — `[Field] [Operator] [Value]` with AND/OR logic
- 📌 **Quick Views** — Save and reuse filter/sort/column configurations with one click
- ↕️ **Column Sorting** — Click any column header to sort ascending/descending
- 👁 **Column Visibility** — Toggle which columns are shown

### Bulk Actions
- 🔄 **Bulk Status Update** — Apply a status to multiple selected rows at once
- 🗑️ **Bulk Delete** — Move selected rows to Recycle Bin
- ⬇️ **Bulk Export** — CSV and PDF export for selected rows
- 🖨️ **Bulk Print** — Print selected rows and columns

### Export & Print
- 📄 **CSV Export** — Selected rows or current page
- 📑 **PDF Export** — Client-side generation using jsPDF
- 🖨️ **Smart Print** — Prints selected rows/columns, or current page if nothing selected

### Masters Module
- 👥 **Client List** — CRUD with CSV import and DB validation
- 🏷️ **Product Name List** — CRUD with CSV import
- 📦 **Product Type List** — CRUD with CSV import
- 🗑️ **Recycle Bin** — Restore or permanently delete records with 10-day purge countdown

### System
- 🔐 **Simple Auth** — Single shared login via httpOnly JWT cookie
- 📊 **Dashboard** — Live order counts per status with click-through navigation
- 🌙 **Light / Dark Mode** — Toggle in the navigation bar
- 🔄 **Keep-Alive Cron** — Prevents Supabase free-tier pausing
- ⏱️ **Auto-Purge** — pg_cron deletes trash records older than 10 days

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | [Next.js 14](https://nextjs.org/) (App Router) |
| **Database** | [Supabase](https://supabase.com/) (PostgreSQL) |
| **Hosting** | [Vercel](https://vercel.com/) (Hobby/Free) |
| **Styling** | CSS Modules (Vanilla CSS) |
| **Font** | [Inter](https://fonts.google.com/specimen/Inter) (Google Fonts) |
| **Auth** | Custom JWT — httpOnly cookie + Next.js middleware |
| **CSV Parsing** | [PapaParse](https://www.papaparse.com/) |
| **PDF Export** | [jsPDF](https://github.com/parallax/jsPDF) + [jspdf-autotable](https://github.com/simonbengtsson/jsPDF-AutoTable) |
| **Scheduled Jobs** | Supabase pg_cron (DB-level) + Vercel Cron (keep-alive) |

---

## 📁 Project Structure

```
sarthak-creations-oms/
│
├── app/                          # Next.js App Router
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx          # Login page
│   ├── (protected)/              # All protected routes
│   │   ├── dashboard/
│   │   │   └── page.tsx          # Dashboard — status count cards
│   │   ├── orders/
│   │   │   ├── page.tsx          # Active Orders table
│   │   │   ├── completed/
│   │   │   │   └── page.tsx      # Completed Orders table
│   │   │   └── new/
│   │   │       └── page.tsx      # New Order form
│   │   └── masters/
│   │       ├── clients/
│   │       │   └── page.tsx      # Client List
│   │       ├── product-names/
│   │       │   └── page.tsx      # Product Name List
│   │       ├── product-types/
│   │       │   └── page.tsx      # Product Type List
│   │       └── deleted/
│   │           └── page.tsx      # Recycle Bin
│   └── api/                      # API routes
│       ├── auth/
│       │   ├── login/route.ts
│       │   └── logout/route.ts
│       ├── keepalive/route.ts     # Vercel cron target
│       ├── orders/
│       │   ├── route.ts          # GET (list), POST (create)
│       │   ├── [id]/route.ts     # PATCH, DELETE
│       │   └── bulk/route.ts     # Bulk actions
│       ├── clients/
│       │   ├── route.ts
│       │   ├── [id]/route.ts
│       │   └── import/route.ts   # CSV import
│       ├── product-names/
│       │   ├── route.ts
│       │   ├── [id]/route.ts
│       │   └── import/route.ts
│       ├── product-types/
│       │   ├── route.ts
│       │   ├── [id]/route.ts
│       │   └── import/route.ts
│       ├── trash/
│       │   └── [table]/
│       │       ├── route.ts      # GET (list), DELETE (permanent)
│       │       └── restore/route.ts
│       └── quick-views/
│           ├── route.ts
│           └── [id]/route.ts
│
├── components/                   # Reusable UI components
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   └── AppShell.tsx
│   ├── table/
│   │   ├── DataTable.tsx
│   │   ├── TableToolbar.tsx
│   │   ├── FilterPanel.tsx
│   │   ├── QuickViewsDropdown.tsx
│   │   ├── BulkActionBar.tsx
│   │   └── FloatingSaveBar.tsx
│   ├── forms/
│   │   ├── NewOrderForm.tsx
│   │   ├── SearchableSelect.tsx
│   │   └── DatePicker.tsx
│   ├── csv/
│   │   ├── CsvImportModal.tsx
│   │   └── CsvPreviewTable.tsx
│   └── ui/
│       ├── StatusBadge.tsx
│       ├── Button.tsx
│       └── ThemeToggle.tsx
│
├── lib/                          # Utilities and helpers
│   ├── supabase.ts               # Supabase client (browser)
│   ├── supabase-server.ts        # Supabase client (server)
│   ├── auth.ts                   # JWT helpers
│   ├── filter-builder.ts         # Supabase query builder from filter config
│   ├── export-csv.ts             # CSV export utility
│   ├── export-pdf.ts             # PDF export utility
│   └── constants.ts              # Status values, column definitions, etc.
│
├── middleware.ts                 # Auth protection for all routes
├── vercel.json                   # Vercel cron job configuration
├── .env.local                    # Local environment variables (gitignored)
├── .env.example                  # Environment variable template
└── supabase/
    └── schema.sql                # Full database schema SQL
```

---

## 🗄️ Database Schema

### Primary Tables

#### `clients`
```sql
CREATE TABLE clients (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### `product_names`
```sql
CREATE TABLE product_names (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### `product_types`
```sql
CREATE TABLE product_types (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

> **Note:** `product_names` and `product_types` are completely independent. There is no join table — both fields are selected independently on all order forms.

#### `orders`
```sql
CREATE TABLE orders (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date_of_entry    DATE NOT NULL DEFAULT CURRENT_DATE,
  po_number        TEXT NOT NULL,
  client_id        UUID NOT NULL REFERENCES clients(id),
  product_name_id  UUID NOT NULL REFERENCES product_names(id),
  product_type_id  UUID NOT NULL REFERENCES product_types(id),
  quantity         INTEGER NOT NULL CHECK (quantity > 0),
  status           TEXT NOT NULL DEFAULT 'Design Confirmed'
                   CHECK (status IN (
                     'Design Confirmed',
                     'Client Approval',
                     'Finalised',
                     'Printing',
                     'Completed'
                   )),
  remark           TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);
```

> **Note:** `po_number` is intentionally non-unique. The same PO number can appear on multiple rows.
> **Note:** `days_old` is never stored — always computed as `CURRENT_DATE - date_of_entry`.

#### `quick_views`
```sql
CREATE TABLE quick_views (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  filters         JSONB NOT NULL DEFAULT '[]',
  filter_logic    TEXT NOT NULL DEFAULT 'AND' CHECK (filter_logic IN ('AND', 'OR')),
  sort_field      TEXT,
  sort_direction  TEXT CHECK (sort_direction IN ('asc', 'desc')),
  visible_columns JSONB NOT NULL DEFAULT '[]',
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
```

### Trash Tables (Recycle Bin)

```sql
CREATE TABLE deleted_clients        AS TABLE clients        WITH NO DATA;
CREATE TABLE deleted_product_names  AS TABLE product_names  WITH NO DATA;
CREATE TABLE deleted_product_types  AS TABLE product_types  WITH NO DATA;
CREATE TABLE deleted_orders         AS TABLE orders         WITH NO DATA;

-- Add deleted_at to each trash table
ALTER TABLE deleted_clients       ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE deleted_product_names ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE deleted_product_types ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE deleted_orders        ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT now();
```

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18.17 or later
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)
- A [Supabase](https://supabase.com/) account (free tier)
- A [Vercel](https://vercel.com/) account (free Hobby tier)

### Local Development

```bash
# 1. Clone the repository
git clone https://github.com/your-org/sarthak-creations-oms.git
cd sarthak-creations-oms

# 2. Install dependencies
npm install

# 3. Copy the environment variable template
cp .env.example .env.local

# 4. Fill in your environment variables (see below)
# Edit .env.local with your values

# 5. Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Environment Variables

Create a `.env.local` file in the project root with the following variables:

```env
# ─── Authentication ───────────────────────────────────────────
# Shared login credentials used by all employees
APP_USERNAME=your_username_here
APP_PASSWORD=your_secure_password_here

# Secret key for signing JWT session tokens
# Generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=your_64_character_random_string_here

# ─── Supabase ─────────────────────────────────────────────────
# Found in: Supabase Dashboard → Project Settings → API
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here

# Server-only key — never expose this to the client
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

> ⚠️ **Never commit `.env.local` to version control.** It is already listed in `.gitignore`.

---

## 🟢 Supabase Setup

### Create Tables

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Open your project → **SQL Editor**
3. Run the full schema from `supabase/schema.sql`

### Set Up Triggers

The `updated_at` column must auto-update on every record modification. Run this in the SQL Editor:

```sql
-- Create the trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all primary tables
CREATE TRIGGER set_updated_at_clients
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_product_names
  BEFORE UPDATE ON product_names
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_product_types
  BEFORE UPDATE ON product_types
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_orders
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_quick_views
  BEFORE UPDATE ON quick_views
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### Set Up pg_cron (Auto-Purge)

This job permanently deletes Recycle Bin records older than 10 days. Run once in the SQL Editor:

```sql
-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily purge at midnight
SELECT cron.schedule(
  'purge-deleted-records',
  '0 0 * * *',
  $$
    DELETE FROM deleted_clients
      WHERE deleted_at < NOW() - INTERVAL '10 days';

    DELETE FROM deleted_product_names
      WHERE deleted_at < NOW() - INTERVAL '10 days';

    DELETE FROM deleted_product_types
      WHERE deleted_at < NOW() - INTERVAL '10 days';

    DELETE FROM deleted_orders
      WHERE deleted_at < NOW() - INTERVAL '10 days';
  $$
);
```

> **Verify the job is active:** In Supabase Dashboard → Database → Extensions → `pg_cron`, or run `SELECT * FROM cron.job;`

---

## ▲ Deployment (Vercel)

### Step 1 — Connect Repository

1. Go to [vercel.com](https://vercel.com) and click **Add New Project**
2. Import your GitHub repository
3. Vercel will auto-detect Next.js — no build settings needed

### Step 2 — Add Environment Variables

In Vercel Project Settings → **Environment Variables**, add all six variables from `.env.local`.

### Step 3 — Deploy

Click **Deploy**. Vercel builds and deploys automatically on every push to `main`.

### Step 4 — Verify Keep-Alive Cron

After deployment, go to **Vercel Dashboard → Project → Cron Jobs** and confirm the `/api/keepalive` cron is listed (runs every 3 days). This is configured via `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/keepalive",
      "schedule": "0 0 */3 * *"
    }
  ]
}
```

---

## 📦 Application Modules

### Dashboard

The landing page after login. Shows the current state of the production pipeline at a glance.

| Card | Shows |
|---|---|
| Design Confirmed | Count of orders in this status |
| Client Approval | Count of orders in this status |
| Finalised | Count of orders in this status |
| Printing | Count of orders in this status |
| Completed | Count of orders in this status |
| **Total Active** | All orders where status ≠ Completed |

Clicking any card navigates to the relevant Orders page with the status pre-filtered.

---

### Orders Module

#### Active Orders (`/orders`)

The core page of the system. All orders where `status ≠ 'Completed'`.

**Table columns:**

| Column | Editable | Notes |
|---|---|---|
| Date of Entry | ✅ | Defaults to today. Freely backdatable. |
| PO Number | ✅ | Alphanumeric, non-unique |
| Client Name | ✅ | Searchable dropdown |
| Product Name | ✅ | Searchable dropdown |
| Product Type | ✅ | Searchable dropdown, independent of Product Name |
| Quantity | ✅ | Positive integer |
| Days Old | ❌ | `CURRENT_DATE - date_of_entry` (computed, not stored) |
| Status | ✅ | Bidirectional — any direction allowed |
| Remark | ✅ | Free text, no limit |

**Edit flow:**
1. Enable `[✏ Editable]` toggle in toolbar
2. Click any cell to edit it
3. Make as many changes as needed across any rows
4. Click the floating **Save Changes (n edits)** button to commit all at once
5. Or click **Discard** to revert everything

**Status values (bidirectional — any order allowed):**
```
Design Confirmed → Client Approval → Finalised → Printing → Completed
```

#### Completed Orders (`/orders/completed`)

Identical to Active Orders. Status filter (`= 'Completed'`) is locked server-side but the page is fully editable — orders can be moved back to any earlier status.

#### New Order (`/orders/new`)

Full-page form. Fields: Date of Entry, PO Number, Client, Product Name, Product Type, Quantity, Status, Remark.
Actions: **Save Order** / **Save & Add Another** / **Cancel**

---

### Masters Module

All three master pages share the same layout and features:

| Feature | Detail |
|---|---|
| View | Table with Name, Date Added, Actions |
| Add | Inline row or simple modal |
| Edit | Inline editing |
| Delete | Moves to Recycle Bin (not permanent) |
| Search | Filter by name |
| Import CSV | Per-page button — runs DB validation before insert |

**CSV Import Workflow:**

```
Upload .csv → Parse (PapaParse) → Validate vs. DB
    ↓
Preview Window:
  ✅ Valid rows (new record)
  ⚠️ Warning rows (already exists — will skip)
  ❌ Error rows (empty name — will skip)
    ↓
User clicks [Import Valid Records]
    ↓
Only valid, non-duplicate records inserted
    ↓
Summary: "8 imported · 2 skipped (exist) · 1 skipped (empty)"
```

**Recycle Bin (`/masters/deleted`):**

Tabbed view: `Clients | Product Names | Product Types | Orders`

Each record shows the original data, deletion date, purge countdown (e.g., *"7 days until deletion"*), and two action buttons: **Restore** and **Delete Permanently**.

---

## 🔍 Filtering Architecture

### Filter Rule Structure

```typescript
interface FilterRule {
  id: string
  field: string       // 'status' | 'client_id' | 'date_of_entry' | 'quantity' | ...
  operator: string    // see operator table below
  value: string | [string, string]  // single or [from, to] for 'between'
}

interface FilterConfig {
  rules: FilterRule[]
  logic: 'AND' | 'OR'
}
```

### Operator Reference

| UI Label | Backend Key | Field Types |
|---|---|---|
| is | `eq` | Text, Status |
| is not | `neq` | Text, Status |
| contains | `like` | Text |
| equals | `eq` | Number |
| greater than | `gt` | Number, Date |
| less than | `lt` | Number, Date |
| ≥ | `gte` | Number |
| ≤ | `lte` | Number |
| between | `between` | Number, Date |
| before | `lt` | Date |
| after | `gt` | Date |

### Quick Views JSONB Example

```json
{
  "name": "Printing Orders — Reliance",
  "filters": [
    { "field": "status",    "operator": "eq", "value": "Printing" },
    { "field": "client_id", "operator": "eq", "value": "uuid-here" }
  ],
  "filter_logic": "AND",
  "sort_field": "date_of_entry",
  "sort_direction": "asc",
  "visible_columns": ["date_of_entry", "po_number", "client_id", "status", "quantity"]
}
```

---

## 🗑️ Trash / Recycle Bin System

```
User deletes record
       ↓
Record removed from primary table (clients / orders / etc.)
       ↓
Full record inserted into trash table (deleted_clients / deleted_orders / etc.)
  + deleted_at = now()
       ↓
Record visible in /masters/deleted with purge countdown
       ↓
       ├── User clicks [Restore] → record moved back to primary table
       ├── User clicks [Delete Permanently] → record immediately purged
       └── pg_cron runs daily at midnight
              → DELETE WHERE deleted_at < NOW() - INTERVAL '10 days'
```

**No data is ever silently lost.** Every deletion is reversible for 10 days.

---

## 🔄 Keep-Alive System

Supabase free-tier projects pause after **7 days of inactivity**. To prevent this:

```
Vercel Cron (every 3 days at midnight)
       ↓
GET /api/keepalive
       ↓
SELECT id FROM clients LIMIT 1  ← minimal Supabase query
       ↓
Returns HTTP 200 OK (response discarded)
```

**Cost:** Zero. Runs ~10 times/month, well within Vercel's free tier limits.

---

## 🎨 UI Design Principles

This project follows a strict **minimal corporate** design philosophy due to the target users being non-technical employees.

| Principle | Rule |
|---|---|
| **Theme** | Black & white corporate — no accent colors except status badges |
| **Modes** | Light (default) and Dark — toggled in the nav bar |
| **Animations** | **Zero** — no transitions, fades, slides, or keyframes |
| **Font** | Inter — clean, legible, professional |
| **Tables** | Full-width, dense but readable, similar to spreadsheet density |
| **Actions** | Always visibly labeled — no icon-only buttons, no hover-reveal |
| **Errors** | Business-readable language — no technical error codes ever shown |
| **Navigation** | Fixed left sidebar with text labels — no icon-only nav |
| **Viewport** | Desktop only — minimum 1280px wide |

**Status badge colors (muted in both modes):**

| Status | Color |
|---|---|
| Design Confirmed | Gray |
| Client Approval | Muted amber |
| Finalised | Muted blue |
| Printing | Muted indigo |
| Completed | Muted green |

---

## 📅 Development Phases

| Phase | Focus | Timeline |
|---|---|---|
| **Phase 1** | Foundation — Next.js setup, Supabase, Auth, App Shell, CSS system, Vercel deploy | Week 1 |
| **Phase 2** | Masters Module — Client/Product CRUD, CSV import, Recycle Bin | Week 2 |
| **Phase 3** | Orders Core — Active Orders table, editing, save, Completed Orders page | Week 3 |
| **Phase 4** | Advanced Orders — Filtering, Quick Views, New Order form | Week 4 |
| **Phase 5** | Bulk Actions & Export — CSV/PDF export, print, column visibility | Week 5 |
| **Phase 6** | Dashboard & Infrastructure — Status cards, keep-alive cron, env docs | Week 6 |
| **Phase 7** | QA & Polish — E2E testing, dark mode, browser testing, UI audit | Week 7 |

---

## 🤝 Contributing

This is a private project for Sarthak Creations. No external contributions are accepted at this time.

For internal team members:

1. **Branch naming:** `feature/`, `fix/`, `chore/` prefixes
2. **Commit style:** Use conventional commits (`feat:`, `fix:`, `chore:`)
3. **PRs:** Always target `main` — require one approval before merge
4. **Environment:** Never commit `.env.local` or any secrets

---

<div align="center">

**Sarthak Creations OMS** · Built with Next.js + Supabase · June 2026

</div>
