<div align="center">

# Sarthak Creations — Order Management System

**A web-based Order Management and Production Tracking System**
built for a printing and packaging business.

[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=flat-square&logo=supabase)](https://supabase.com/)
[![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=flat-square&logo=vercel)](https://vercel.com/)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue?style=flat-square)](https://opensource.org/licenses/Apache-2.0)
[![Status](https://img.shields.io/badge/Status-Stable%2FProduction-success?style=flat-square)]()

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Database Schema](#-database-schema)
- [Getting Started](#-getting-started)
- [Supabase Setup](#-supabase-setup)
- [Application Modules](#-application-modules)
- [Filtering & Quick Views](#-filtering--quick-views)
- [Trash / Recycle Bin System](#-trash--recycle-bin-system)
- [UI & UX Principles](#-ui--ux-principles)
- [Development Phases](#-development-phases)

---

## 🧭 Overview

Sarthak Creations OMS is a full-stack web application designed to replace a fragmented, Excel-based order management workflow for a printing and packaging business. It handles the complete production pipeline — from order entry through design confirmation, client approval, finalisation, printing, and completion.

The system is built for **operational clarity** and **non-technical users**. It leverages a clean, high-density, table-centric interface reminiscent of a spreadsheet, but with the robust data integrity, logging, and multi-user capabilities of a modern relational database.

**Core Workflow:**
```
New Order Entered → Active Orders Table → Dynamic Status Progression → Completed Orders
```

---

## ✨ Features

### Orders Management
- 📋 **Active & Completed Orders** — Full data tables with inline editing, sorting, search, and dynamic filtering.
- 🔒 **Explicit Editing** — Tables are read-only by default to prevent accidental data loss. Editing requires toggling an explicit mode.
- 💾 **Staged Bulk Save** — A floating action bar commits all pending edits across multiple rows in a single API transaction.
- ⏱️ **Target Dates & Aging** — Orders calculate their age in days dynamically. Overdue orders are highlighted in red.
- 👥 **Executive Assignment** — Orders can be assigned to executives, with a historical audit log (`assignment_history`) automatically tracked.
- 🇮🇳 **Indian Number Formatting** — Quantities automatically format using the Indian numbering system (e.g. `10,00,000`) across UI and exports.

### Filtering & Views
- ⊞ **3-Part Filter System** — Highly granular rules (`[Field] [Operator] [Value]`) with AND/OR logical chaining.
- 📌 **Quick Views** — Save and reuse complex filter, sort, and column visibility configurations with one click.
- 👁 **Column Visibility** — Dynamically toggle which columns are shown to reduce clutter.

### Bulk Actions & Exports
- 🔄 **Bulk Status Update & Delete** — Apply status changes or send multiple selected rows to the Recycle Bin simultaneously.
- ⬇️ **Export Engine** — Robust CSV and PDF (jsPDF) exports supporting current views, selected rows, and Indian number formatting.
- 🖨️ **Smart Print** — Native print views for selected rows with intelligent page scaling and layout handling.

### Master Records
- 👥 **Clients & Executives** — Manage the core business relationships and employee lists.
- 🏷️ **Product Names & Types** — Decoupled product categorisation lists for granular tracking.
- 🗑️ **Recycle Bin (Soft Delete)** — All deletions move to a trash table. Records can be restored or permanently purged.

### System & Admin Features
- 📊 **Dashboard** — Live order metrics broken down by dynamic status, showing master counts and overdue alerts.
- ⚙️ **Global Settings** — Fully customisable status pipeline. Admins can create, edit, color-code, and drag-and-drop sort order statuses dynamically.
- 📜 **Activity Logs** — A comprehensive, immutable audit trail tracking all Creates, Updates, and Deletes performed by users across the platform.
- 🔐 **Authentication** — Secure, encrypted user accounts managed via Custom JWTs stored in `httpOnly` cookies.
- 👤 **Account Identity** — Top header displays the actively logged-in user.

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | [Next.js 14](https://nextjs.org/) (App Router, Server Components) |
| **Database** | [Supabase](https://supabase.com/) (PostgreSQL) |
| **Hosting** | [Vercel](https://vercel.com/) |
| **Styling** | CSS Modules (Vanilla CSS, Custom Variables) |
| **Auth** | Custom JWT (jose) + `httpOnly` cookies + Middleware |
| **Data Tools** | [PapaParse](https://www.papaparse.com/) (CSV), [jsPDF](https://github.com/parallax/jsPDF) (PDF) |

---

## 📁 Project Structure

```
sarthak-creations-oms/
│
├── app/                          # Next.js App Router
│   ├── (protected)/              # Authed routes (Orders, Masters, Dashboard, Settings, Logs)
│   ├── api/                      # Backend Route Handlers (Auth, Orders, Trash, Logs)
│   ├── globals.css               # Global theme variables and utility classes
│   └── layout.js                 # Root layout and theme injection
│
├── components/                   # Reusable UI components
│   ├── layout/                   # AppShell, Sidebar, TopHeader
│   ├── table/                    # DataTable, BulkActionBar, FloatingSaveBar, Filters
│   └── ui/                       # StatusBadge, Modals, Theme toggles
│
├── lib/                          # Utilities and helpers
│   ├── supabase.ts               # Supabase browser client
│   ├── supabase-server.ts        # Supabase server client
│   ├── auth.ts                   # JWT token generation & verification
│   └── logger.ts                 # Activity Log insertion logic
│
└── supabase/
    └── schema.sql                # Full PostgreSQL schema and functions
```

---

## 🗄️ Database Schema

The database relies on strict referential integrity, decoupled master lists, and mirrored recycle bin tables.

### Primary Entities
- **`users`**: Unified table handling authentication, roles, and the Executive master list.
- **`clients`**: Customer records (includes `phone_number` and `contact_person`).
- **`product_names` & `product_types`**: Independent master lists for granular dropdown selections.
- **`orders`**: The core transactional table. Links out to Clients, Products, Types, and Users via Foreign Keys. Includes fields for `target_date` and `assignment_history`.
- **`global_settings`**: A single-row table storing dynamic `status_options` (JSONB arrays containing names and hex colors) and print headers.
- **`activity_logs`**: An immutable audit ledger capturing the User ID, Action, Module, Record ID, and stringified JSON details of the modification.

### Trash System
Every primary table has an identical `deleted_{table_name}` counterpart (e.g. `deleted_orders`). When a record is "deleted" from the UI, the API intercepts the DELETE request, fetches the record, inserts it into the trash table, and then deletes it from the primary table.

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18.17+
- Supabase Project (PostgreSQL)

### Local Development

1. **Clone & Install**
   ```bash
   git clone https://github.com/AadityaBhure/Sarthak-Creations-OMS.git
   cd Sarthak-Creations-OMS
   npm install
   ```

2. **Environment Variables**
   Create a `.env.local` file:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   JWT_SECRET=your_secure_64_character_random_string_here
   ```

3. **Run Application**
   ```bash
   npm run dev
   ```

---

## 🟢 Supabase Setup

### Creating the Schema
Run your core SQL schema in the Supabase SQL Editor. *Ensure that all `deleted_` tables perfectly mirror the columns of their active counterparts.*

### Activity Logging
The logging system works out of the box via the Next.js API layer. Inside every mutating route handler (POST, PATCH, DELETE), the `logActivity` utility function is called to record the transaction to `activity_logs`.

---

## 🎨 UI & UX Principles

The system adheres to a strict **Minimal Corporate** design language tailored for operational density.

- **Zero Animations**: No transitions, fades, or slides that could slow down a high-volume data-entry clerk.
- **High Information Density**: The active orders table stretches full width and supports resizable columns to maximize screen real estate.
- **Contextual Expansion**: The "Remarks" text areas auto-expand vertically as the user types during Edit Mode, preventing the need for internal scrolling.
- **Theming**: Full Light Mode and Dark Mode support accessible via a navigation bar toggle.
- **Indian Numerics**: Contextual localization formatting applies automatically (`10,00,000`) for visual scanning ease without compromising backend integer storage.

---

## 📅 Development Phases

| Phase | Description |
|---|---|
| **Phase 1** | Foundation — Next.js setup, Supabase, Auth, App Shell, CSS system, Vercel deploy. |
| **Phase 2** | Masters Module — Client/Product CRUD, CSV import, Recycle Bin logic. |
| **Phase 3** | Orders Core — Active Orders table, inline editing, batch saving, Completed Orders. |
| **Phase 4** | Advanced Views — Dynamic Filtering, Quick Views JSONB architecture. |
| **Phase 5** | Bulk Actions & Export — CSV/PDF engines, bulk printing, bulk status/deletion. |
| **Phase 6** | Dashboard & Metrics — Status count cards, overdue alerts, master metrics. |
| **Phase 7** | Refactoring & Extensions — Unified Users table, Activity Logs (Audit Trail), Target Dates. |
| **Phase 8** | Dynamic Settings & Polish — Customisable status pipeline, E2E schema alignment, Indian number formatting, Account identity display. |

---

<div align="center">

**Sarthak Creations OMS** · Built with Next.js + Supabase

</div>
