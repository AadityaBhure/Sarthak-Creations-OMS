<div align="center">

# Sarthak Creations — Order Management System (OMS)

**A highly specialized, high-density web application designed to replace fragmented Excel workflows with a robust, cloud-native operational pipeline.**

[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=flat-square&logo=supabase)](https://supabase.com/)
[![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=flat-square&logo=vercel)](https://vercel.com/)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue?style=flat-square)](https://opensource.org/licenses/Apache-2.0)
[![Status](https://img.shields.io/badge/Status-Production%20Ready-success?style=flat-square)]()

</div>

---

## 📋 Comprehensive Table of Contents

1. [Overview & Objectives](#1-overview--objectives)
2. [Core Philosophy & UI Design](#2-core-philosophy--ui-design)
3. [Architecture & Technology Stack](#3-architecture--technology-stack)
4. [Project Structure](#4-project-structure)
5. [Database Schema & Data Flow](#5-database-schema--data-flow)
   - [Primary Entities](#primary-entities)
   - [The Trash / Recycle Bin System (Soft Deletes)](#the-trash--recycle-bin-system-soft-deletes)
   - [Immutable Activity Logs](#immutable-activity-logs)
6. [Core Features & Modules](#6-core-features--modules)
   - [Orders Pipeline & Lifecycle](#orders-pipeline--lifecycle)
   - [Advanced Filtering & Quick Views](#advanced-filtering--quick-views)
   - [Export, PDF, and Smart Print](#export-pdf-and-smart-print)
   - [Global Settings & Customization](#global-settings--customization)
7. [Security & Authentication](#7-security--authentication)
8. [Local Setup & Installation](#8-local-setup--installation)
9. [Supabase Configuration & Triggers](#9-supabase-configuration--triggers)
10. [Vercel Deployment Guide](#10-vercel-deployment-guide)

---

## 1. Overview & Objectives

**Sarthak Creations OMS** is a full-stack, enterprise-grade web application tailored for a printing and packaging business. Prior to this system, the business relied on disjointed Excel spreadsheets, leading to data loss, tracking inefficiencies, and a lack of accountability. 

This OMS acts as a centralized brain for the factory floor, design team, and management. It tracks every order from initial entry through design confirmation, client approval, finalisation, printing, and ultimate completion. It calculates exact aging metrics (days overdue), tracks which executive is handling what order, and provides an immutable audit trail of every single modification made by any employee.

---

## 2. Core Philosophy & UI Design

The system was engineered specifically for **non-technical users** whose primary prior experience is interacting with dense Excel spreadsheets. Therefore, the UI principles are incredibly strict:

- **Minimal Corporate Aesthetic:** Strictly black, white, and grays. Meaningful colors (reds, greens, ambers) are reserved exclusively for status badges and critical alerts.
- **Zero Animations:** There are no visual transitions, page fade-ins, or bouncing elements. The application must feel as instantaneous and utilitarian as a native spreadsheet.
- **High Information Density:** The data tables stretch to fill the viewport and minimize padding. 
- **Contextual Expansion:** Large text inputs (like the "Remarks" field) auto-expand seamlessly to prevent the user from having to scroll within a small text box.
- **Localization:** Quantities and monetary-adjacent metrics are formatted utilizing the **Indian Numbering System** (e.g., `10,00,000` rather than `1,000,000`) globally across the UI, CSV exports, and generated PDFs.
- **Explicit Editing States:** To prevent accidental data overrides, tables are read-only by default. Users must explicitly toggle an `[Editable]` mode. Once enabled, changes are staged locally and committed to the database in a single bulk transaction via a floating "Save" action bar.

---

## 3. Architecture & Technology Stack

The application is built on a modern, serverless architecture ensuring zero-maintenance scaling and high availability.

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend Framework** | [Next.js 14](https://nextjs.org/) | App Router utilizing React Server Components for optimal SEO and rapid initial payload delivery. |
| **Backend / Database** | [Supabase](https://supabase.com/) | A managed PostgreSQL database exposing secure REST APIs and native Row Level Security (RLS). |
| **Authentication** | `jose` (Custom JWT) | Stateless session management using securely encrypted, `httpOnly` cookies. |
| **Hosting & CI/CD** | [Vercel](https://vercel.com/) | Edge networking, automatic deployments, and serverless route execution. |
| **Styling Engine** | Vanilla CSS Modules | Completely custom-written CSS utilizing CSS variables to allow instant Light/Dark mode toggling without heavy UI libraries. |
| **Data Parsing** | `PapaParse` | Client-side ingestion, validation, and parsing of bulk CSV uploads. |
| **PDF Generation** | `jsPDF` & `jspdf-autotable` | High-fidelity, client-side PDF rendering of data tables and order sheets. |

---

## 4. Project Structure

The codebase is strictly organized to separate UI components from business logic and database interactions.

```
Sarthak Creations OMS/
│
├── codefiles/
│   ├── app/                          # Next.js 14 App Router
│   │   ├── (protected)/              # All internal authenticated pages
│   │   │   ├── dashboard/            # High-level metrics & status funnels
│   │   │   ├── orders/               # Active & Completed Order tables
│   │   │   ├── masters/              # Clients, Products, Types, Executives
│   │   │   ├── settings/             # Dynamic status configuration
│   │   │   └── logs/                 # System-wide Audit Trail
│   │   ├── api/                      # Backend Serverless Route Handlers
│   │   │   ├── auth/                 # Login / Registration endpoints
│   │   │   ├── orders/               # Order CRUD and Bulk operations
│   │   │   ├── trash/                # Recycle Bin restore/purge logic
│   │   │   └── logs/                 # Activity log recording layer
│   │   ├── globals.css               # CSS Variables & foundational styles
│   │   └── layout.js                 # Root App Shell injection
│   │
│   ├── components/                   # Reusable React UI Components
│   │   ├── layout/                   # Sidebar, TopHeader, Navigation
│   │   ├── table/                    # Complex DataTable, Filters, Toolbar
│   │   └── ui/                       # Badges, Modals, Spinners, Theme Toggle
│   │
│   ├── lib/                          # Core Logic & Utilities
│   │   ├── supabase.ts               # Browser-safe Supabase client
│   │   ├── supabase-server.ts        # Privileged Node.js Supabase client
│   │   ├── auth.ts                   # JWT token lifecycle management
│   │   └── logger.ts                 # Audit trail ingestion function
│   │
│   └── e2e.js                        # Custom End-to-End Test Suite script
│
└── README.md                         # This documentation file
```

---

## 5. Database Schema & Data Flow

The underlying PostgreSQL database hosted on Supabase enforces strict referential integrity. 

### Primary Entities

1. **`users` (Executives & Admins)**
   Handles authentication, role-based access control, and acts as the master list of executives to whom orders can be assigned.
   - *Columns:* `id`, `first_name`, `last_name`, `username`, `phone_number`, `password_hash`, `role`.

2. **`clients`**
   The master record of all customers. 
   - *Columns:* `id`, `name`, `contact_person`, `phone_number`.

3. **`product_names` & `product_types`**
   Two completely independent, decoupled dictionaries. This avoids massive "Join Table" nightmares and allows a user to select "Carton" from types, and "Paracetamol 500mg" from names.

4. **`orders`**
   The core transactional ledger. Every row here represents a physical job moving through the factory.
   - *Foreign Keys:* Links to `client_id`, `product_name_id`, `product_type_id`, and `executive_id`.
   - *Key Columns:* `po_number`, `quantity`, `status` (dynamic string), `date_of_entry`, `target_date`, `assignment_history` (JSONB), and `remark`.

5. **`global_settings`**
   A single-row configuration table holding JSON arrays for dynamic, user-defined statuses, colors, global print headers, and UI density preferences.

### The Trash / Recycle Bin System (Soft Deletes)

To prevent catastrophic accidental deletions, **no record is ever hard-deleted from the UI**.
For every primary table (`orders`, `clients`, etc.), an exact mirrored schema exists prefixed with `deleted_` (e.g., `deleted_orders`). 

When a user clicks "Delete":
1. The Next.js API intercepts the command.
2. The exact record is queried from the primary table.
3. The record is inserted into the corresponding `deleted_` table alongside a `deleted_at` timestamp.
4. The record is purged from the primary table.

**Auto-Purge System:**
A background database CRON job (`pg_cron`) automatically runs every night at midnight, querying all `deleted_` tables and permanently dropping records where `deleted_at` is older than 10 days.

### Immutable Activity Logs

The `activity_logs` table provides a 100% transparent audit ledger. 
- *Columns:* `id`, `user_id`, `action` (`CREATE`, `UPDATE`, `DELETE`), `module_name`, `record_id`, `details` (JSONB before/after snapshot).
Every serverless API route natively wraps its operations in the `logActivity` utility function, ensuring that no change bypasses the ledger. Admins can view this log in the UI to see exactly who changed a quantity, altered a PO number, or deleted a client.

---

## 6. Core Features & Modules

### Orders Pipeline & Lifecycle

- **Active Orders Page:** The main operational hub. Shows all orders that have not yet reached the `Completed` status.
- **Inline Editing & Staged Saves:** When the table is unlocked, users can navigate cell-by-cell like an Excel sheet. Edits are tracked in React state. A floating bar appears at the bottom allowing the user to either discard everything or commit all changes in one bulk network request.
- **Target Dates & Overdue Highlighting:** Orders feature a `target_date`. If `target_date` surpasses `CURRENT_DATE`, the row visually flags itself as overdue in red.
- **Dynamic Status Progression:** The pipeline isn't hardcoded. The stages (e.g., `Design Confirmed` -> `Printing`) are pulled dynamically from `global_settings`, meaning management can adapt the workflow without requiring a developer.

### Advanced Filtering & Quick Views

- **3-Part Relational Filtering:** Users can stack infinite filters using the `[Field] [Operator] [Value]` paradigm. Example: `(Status IS "Printing") AND (Quantity GREATER THAN 5000)`.
- **Quick Views (Saved Views):** Complex filter setups, along with specific column visibilities and sorting parameters, can be saved to the database as a "Quick View". Users can bounce between their customized views with a single click in the top toolbar.

### Safe Bulk Imports (Excel/CSV)

- **Batched Processing:** Uploads of thousands of rows are processed in chunks of 200 via the backend, guaranteeing the browser never freezes.
- **Strict Duplicate Prevention:** The database actively intercepts duplicates based on unique identifiers and silently skips them to maintain data integrity.
- **Interactive Import Summaries:** After importing, a modal presents exact totals of accepted vs. rejected rows. Users can click to see a detailed table of exactly why each rejected row failed (e.g., "Duplicate entry", "Invalid format").

### Export, PDF, and Smart Print

- **Bulk Export:** The system integrates `PapaParse` to instantly stream selected rows to a cleanly formatted `.csv` file. 
- **PDF Generation:** Utilizing `jsPDF-autotable`, the system maps the current HTML table state into a highly professional, letter-headed PDF document ready for emailing.
- **Smart Print:** A custom CSS print-media query strips away the sidebar, headers, and UI controls, expanding the table to fit a standard A4 sheet perfectly. It respects user-selected columns and row checkboxes.

### Global Settings & Customization

The `/settings` dashboard is restricted to Admin users. It allows for:
- **Status Pipeline Customization:** A drag-and-drop interface to add new statuses, reorder the operational pipeline, and assign custom hexadecimal colors to the status badges.
- **Global Print Overrides:** Uploading company headers and configuring the precise address blocks that appear on exported PDFs.
- **Adaptive UI Density:** Users can toggle between *Comfortable* (spacious) and *Compact* (data-dense) table rendering, dynamically updating globally without a page reload.

---

## 7. Security & Authentication

- **Custom JWT Session Engine:** Because Supabase's native GoTrue Auth can occasionally be overkill for shared internal B2B tools, this system implements a hyper-fast custom JWT solution.
- **Encrypted Cookies:** Upon login, a `jose`-signed JWT containing the User ID, Name, and Role is securely stored in a browser `httpOnly`, `Secure` cookie. It cannot be accessed by client-side JavaScript, effectively neutralizing XSS token theft.
- **Next.js Middleware:** The `middleware.js` file at the root of the project intercepts every single page request. If a valid JWT is not present, it forcibly redirects the user to `/login` at the edge, before the page even renders.

---

## 8. Local Setup & Installation

Follow these steps to run the application locally on your machine.

**1. Clone the repository**
```bash
git clone https://github.com/AadityaBhure/Sarthak-Creations-OMS.git
cd "Sarthak Creations OMS/codefiles"
```

**2. Install dependencies**
```bash
npm install
```

**3. Configure Environment Variables**
Create a `.env.local` file inside the `codefiles` directory. You will need to extract these keys from your Supabase dashboard.
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5c...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5c...

# Generate a strong 64 character random string for signing cookies
JWT_SECRET=b7f8e...
```

**4. Start the Development Server**
```bash
npm run dev
```
The application will boot up at `http://localhost:3000`.

---

## 9. Supabase Configuration & Triggers

To deploy this architecture from scratch, you must configure the Supabase database. 

1. **Execute Schema SQL:** Navigate to the SQL Editor in Supabase and execute the master schema provided in `supabase/schema.sql`.
2. **Setup Auto-Updated Timestamps:** The schema relies on PostgreSQL triggers to ensure `updated_at` timestamps are perfectly accurate.
```sql
CREATE OR REPLACE FUNCTION update_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_orders BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();
-- (Repeat for clients, users, product_names, etc.)
```
3. **Setup the Auto-Purge Cron:** Enable the `pg_cron` extension and run:
```sql
SELECT cron.schedule('purge-deleted-records', '0 0 * * *', $$
  DELETE FROM deleted_orders WHERE deleted_at < NOW() - INTERVAL '10 days';
  DELETE FROM deleted_clients WHERE deleted_at < NOW() - INTERVAL '10 days';
  -- (Repeat for all deleted_ tables)
$$);
```

---

## 10. Vercel Deployment Guide

Deploying this application to production is entirely seamless via Vercel.

1. Create a free account at [Vercel.com](https://vercel.com/).
2. Click **Add New Project** and link your GitHub repository.
3. In the **Environment Variables** section, paste all the keys from your `.env.local` file.
4. Click **Deploy**.
5. Vercel will automatically run `npm run build`, execute the Next.js server compilation, and deploy to a global edge network.
6. *Note on Keep-Alive:* Vercel is configured via `vercel.json` to ping the `/api/keepalive` endpoint every 3 days. This ensures that the free-tier Supabase database is never paused due to inactivity.

---

<div align="center">
  <br/>
  <b>Engineered & Maintained for Sarthak Creations</b><br/>
  <i>Streamlining print operations, one row at a time.</i>
</div>
