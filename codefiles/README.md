# Sarthak Creations — Order Management System

Welcome to the Sarthak Creations Order Management System (OMS) repository. This application is a custom-built, modern web-based platform designed specifically for the printing and packaging industry, effectively replacing the business's previous Excel-based workflows with a secure, highly-performant, and specialized software solution.

## Project Overview

The primary objective of this application is to simplify and modernize day-to-day operational tracking, including order entry, production stage monitoring, printing, filtering, and data exporting.

**Core Philosophy:**
- **Simplicity First**: Built for users who may not be highly tech-literate. The UI is focused, devoid of unnecessary visual stimulation, and mimics the familiarity of spreadsheet tables.
- **Table-Centric**: Information is dense and easily scannable using data tables rather than complex dashboards.
- **Operational Speed**: Minimizes manual typing through integrated master data dropdowns and quick actions.

## Technology Stack

The application is built using modern, industry-standard web technologies to ensure longevity, speed, and ease of maintenance.

- **Frontend**: [Next.js 14](https://nextjs.org/) (App Router)
- **Backend & Database**: [Supabase](https://supabase.com/) (PostgreSQL) 
- **Hosting**: [Vercel](https://vercel.com/)
- **Styling**: Vanilla CSS (CSS Modules) to keep dependencies low and performance high.
- **Authentication**: Custom lightweight JWT session management (Single Shared Login).
- **Export Capabilities**:
  - `PapaParse` for CSV parsing and generation.
  - `jsPDF` & `jspdf-autotable` for client-side PDF rendering.

## Key Features

### 1. Order Management
- **Active Orders**: A fully editable data table displaying all active production orders. Supports inline editing, bulk status updates, complex column-wise filtering, and one-click PDF printing.
- **Completed Orders**: Dedicated archive for finished jobs to keep the active view uncluttered.
- **Quick Views**: Save and load filter configurations (e.g., "Show me all active Box Designs for Reliance").

### 2. Master Data Management
- **Centralized Settings**: Manage Clients, Product Names, Product Types, and custom dynamic Statuses from a single page.
- **Dynamic Status Colors**: Customize the exact background and text colors of every stage in the production workflow natively within the application.

### 3. Recycle Bin
- **Soft Deletion**: Deleted orders are moved to a Recycle Bin rather than being permanently destroyed immediately.
- **Auto-Purge System**: A scheduled chron job automatically clears out records older than 10 days to keep the database lightweight.

### 4. Dashboards & Analytics
- Provides instant, at-a-glance metrics on production workflows and master records, and seamlessly routes users into filtered views by clicking on status cards.

## Getting Started

### Prerequisites
- Node.js (v18+)
- npm or yarn
- A Supabase Project (with the corresponding `.env.local` variables)

### Installation & Local Development

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd "Sarthak Creations OMS/codefiles"
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up Environment Variables:**
   Create a `.env.local` file in the root directory and add your Supabase credentials and JWT secret:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   JWT_SECRET=your_secure_random_string
   ADMIN_PASSWORD=your_secure_login_password
   ```

4. **Run the development server:**
   ```bash
   npm run dev
   ```

5. **Open the App:**
   Navigate to [http://localhost:3000](http://localhost:3000) in your browser.

## Database Maintenance
The Vercel configuration includes a cron job that runs every 3 days (`/api/keepalive`) to prevent the Supabase instance from pausing due to inactivity on the free tier. No manual intervention is required.

---

*Designed and Developed for Sarthak Creations.*
