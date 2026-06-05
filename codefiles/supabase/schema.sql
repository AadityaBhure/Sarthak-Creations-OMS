-- =============================================================================
-- SARTHAK CREATIONS OMS — SUPABASE SCHEMA
-- Paste this entire file into Supabase SQL Editor and run it.
-- =============================================================================

-- Enable pg_cron extension (available on Supabase free tier)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- =============================================================================
-- 1. APP CONFIG TABLE (stores app credentials — change via Supabase Table Editor)
-- =============================================================================
CREATE TABLE IF NOT EXISTS app_config (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Seed: username = admin, password = bcrypt hash of "creations"
-- If you want to change credentials, update these rows in the Table Editor.
INSERT INTO app_config (key, value) VALUES
  ('username', 'admin'),
  ('password_hash', '$2b$10$GzzyWvDHzYfYn7GAf60fj.7U0rZlq4Wrj3BBgTd.Nfv4BztIrZIgO')
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- 2. PRIMARY TABLES
-- =============================================================================

-- CLIENTS
CREATE TABLE IF NOT EXISTS clients (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL UNIQUE,
  address    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PRODUCT NAMES
CREATE TABLE IF NOT EXISTS product_names (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PRODUCT TYPES
CREATE TABLE IF NOT EXISTS product_types (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ORDERS
CREATE TABLE IF NOT EXISTS orders (
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

-- QUICK VIEWS (saved filter configurations)
CREATE TABLE IF NOT EXISTS quick_views (
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

-- =============================================================================
-- 3. TRASH TABLES (Recycle Bin — mirrors source tables + deleted_at)
-- =============================================================================

CREATE TABLE IF NOT EXISTS deleted_clients (
  id         UUID        NOT NULL,
  name       TEXT        NOT NULL,
  address    TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS deleted_product_names (
  id         UUID        NOT NULL,
  name       TEXT        NOT NULL,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS deleted_product_types (
  id         UUID        NOT NULL,
  name       TEXT        NOT NULL,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS deleted_orders (
  id               UUID        NOT NULL,
  date_of_entry    DATE,
  po_number        TEXT,
  client_id        UUID,
  product_name_id  UUID,
  product_type_id  UUID,
  quantity         INTEGER,
  status           TEXT,
  remark           TEXT,
  created_at       TIMESTAMPTZ,
  updated_at       TIMESTAMPTZ,
  deleted_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- 4. UPDATED_AT TRIGGER
-- =============================================================================

-- Trigger function
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all primary tables
CREATE TRIGGER trg_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_product_names_updated_at
  BEFORE UPDATE ON product_names
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_product_types_updated_at
  BEFORE UPDATE ON product_types
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_quick_views_updated_at
  BEFORE UPDATE ON quick_views
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- 5. PG_CRON AUTO-PURGE JOB
-- Runs every day at midnight. Permanently deletes trash records older than 10 days.
-- =============================================================================

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

-- =============================================================================
-- 6. ROW LEVEL SECURITY
-- Since we use the service role key server-side, RLS is not blocking.
-- We disable RLS on all tables for simplicity (single-tenant app, server-side only).
-- =============================================================================

ALTER TABLE app_config          DISABLE ROW LEVEL SECURITY;
ALTER TABLE clients             DISABLE ROW LEVEL SECURITY;
ALTER TABLE product_names       DISABLE ROW LEVEL SECURITY;
ALTER TABLE product_types       DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders              DISABLE ROW LEVEL SECURITY;
ALTER TABLE quick_views         DISABLE ROW LEVEL SECURITY;
ALTER TABLE deleted_clients     DISABLE ROW LEVEL SECURITY;
ALTER TABLE deleted_product_names DISABLE ROW LEVEL SECURITY;
ALTER TABLE deleted_product_types DISABLE ROW LEVEL SECURITY;
ALTER TABLE deleted_orders      DISABLE ROW LEVEL SECURITY;
