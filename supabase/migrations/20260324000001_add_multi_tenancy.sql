/*
  # Add Multi-Tenancy Support (IDEMPOTENT - safe to run multiple times)

  ## Overview
  Converts the application from single-tenant to multi-tenant by adding:
  1. An `organizations` table for tenant isolation
  2. `organization_id` columns on all operational tables
  3. A `super_admin` role that manages organizations and admins
  4. Updated RLS policies scoping data by organization

  ## Role Hierarchy (updated)
  super_admin (4) > admin (3) > staff (2) > viewer (1)

  - super_admin: Manages organizations and their admins only. Cannot view scheduling data.
  - admin: Full access within their organization.
  - staff: Read/write operational data within their organization.
  - viewer: Read-only within their organization.
*/

-- ============================================================
-- 1. CREATE ORGANIZATIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. ADD organization_id TO users TABLE
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE users ADD COLUMN organization_id uuid REFERENCES organizations(id);
  END IF;
END $$;

-- ============================================================
-- 3. EXPAND ROLE CONSTRAINT TO INCLUDE super_admin
-- ============================================================
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('super_admin', 'admin', 'staff', 'viewer'));

-- ============================================================
-- 4. ADD organization_id TO ALL OPERATIONAL TABLES
-- ============================================================
DO $$ BEGIN
  -- clients
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'organization_id') THEN
    ALTER TABLE clients ADD COLUMN organization_id uuid REFERENCES organizations(id);
  END IF;
  -- therapists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'therapists' AND column_name = 'organization_id') THEN
    ALTER TABLE therapists ADD COLUMN organization_id uuid REFERENCES organizations(id);
  END IF;
  -- teams
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'teams' AND column_name = 'organization_id') THEN
    ALTER TABLE teams ADD COLUMN organization_id uuid REFERENCES organizations(id);
  END IF;
  -- callouts
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'callouts' AND column_name = 'organization_id') THEN
    ALTER TABLE callouts ADD COLUMN organization_id uuid REFERENCES organizations(id);
  END IF;
  -- base_schedules
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'base_schedules' AND column_name = 'organization_id') THEN
    ALTER TABLE base_schedules ADD COLUMN organization_id uuid REFERENCES organizations(id);
  END IF;
  -- daily_schedules
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'daily_schedules' AND column_name = 'organization_id') THEN
    ALTER TABLE daily_schedules ADD COLUMN organization_id uuid REFERENCES organizations(id);
  END IF;
  -- settings
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'organization_id') THEN
    ALTER TABLE settings ADD COLUMN organization_id uuid REFERENCES organizations(id);
  END IF;
  -- system_config
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'system_config' AND column_name = 'organization_id') THEN
    ALTER TABLE system_config ADD COLUMN organization_id uuid REFERENCES organizations(id);
  END IF;
  -- schedule_feedback
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schedule_feedback' AND column_name = 'organization_id') THEN
    ALTER TABLE schedule_feedback ADD COLUMN organization_id uuid REFERENCES organizations(id);
  END IF;
  -- schedule_patterns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schedule_patterns' AND column_name = 'organization_id') THEN
    ALTER TABLE schedule_patterns ADD COLUMN organization_id uuid REFERENCES organizations(id);
  END IF;
  -- constraint_violations_log
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'constraint_violations_log' AND column_name = 'organization_id') THEN
    ALTER TABLE constraint_violations_log ADD COLUMN organization_id uuid REFERENCES organizations(id);
  END IF;
END $$;

-- ============================================================
-- 5. CREATE DEFAULT ORGANIZATION & MIGRATE EXISTING DATA
-- ============================================================
INSERT INTO organizations (id, name, slug)
VALUES ('00000000-0000-0000-0000-000000000001', 'Default Organization', 'default')
ON CONFLICT (id) DO NOTHING;

-- Assign all existing data to the default organization
UPDATE users SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL AND role != 'super_admin';
UPDATE clients SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE therapists SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE teams SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE callouts SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE base_schedules SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE daily_schedules SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE settings SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE system_config SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE schedule_feedback SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE schedule_patterns SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE constraint_violations_log SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;

-- Make organization_id NOT NULL on operational tables (users stays nullable for super_admin)
-- Using DO blocks so SET NOT NULL is safe to re-run
DO $$ BEGIN
  ALTER TABLE clients ALTER COLUMN organization_id SET NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE therapists ALTER COLUMN organization_id SET NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE teams ALTER COLUMN organization_id SET NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE callouts ALTER COLUMN organization_id SET NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE base_schedules ALTER COLUMN organization_id SET NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE daily_schedules ALTER COLUMN organization_id SET NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE settings ALTER COLUMN organization_id SET NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE system_config ALTER COLUMN organization_id SET NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE schedule_feedback ALTER COLUMN organization_id SET NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE schedule_patterns ALTER COLUMN organization_id SET NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE constraint_violations_log ALTER COLUMN organization_id SET NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ============================================================
-- 6. CREATE SUPER ADMIN USER
-- ============================================================
INSERT INTO users (email, full_name, role, is_active, organization_id)
VALUES ('superadmin@ordusaba.com', 'Super Administrator', 'super_admin', true, NULL)
ON CONFLICT (email) DO UPDATE SET role = 'super_admin', organization_id = NULL;

-- ============================================================
-- 7. FUNCTION: Copy default config to a new organization
-- ============================================================
CREATE OR REPLACE FUNCTION copy_default_config_to_org(new_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  default_org_id uuid := '00000000-0000-0000-0000-000000000001';
  setting_row RECORD;
  config_row RECORD;
BEGIN
  -- Copy settings rows
  FOR setting_row IN
    SELECT key, value FROM settings WHERE organization_id = default_org_id
  LOOP
    INSERT INTO settings (key, value, organization_id)
    VALUES (setting_row.key, setting_row.value, new_org_id)
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- Copy system_config
  SELECT config_data INTO config_row FROM system_config WHERE organization_id = default_org_id LIMIT 1;
  IF config_row IS NOT NULL THEN
    INSERT INTO system_config (id, config_data, organization_id)
    VALUES (gen_random_uuid()::text, config_row.config_data, new_org_id);
  END IF;
END;
$$;

-- ============================================================
-- 8. UPDATED HELPER FUNCTIONS
-- ============================================================

-- Get user's organization_id (bypasses RLS)
CREATE OR REPLACE FUNCTION get_user_org_id(user_email text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  org_id uuid;
BEGIN
  SELECT organization_id INTO org_id
  FROM users
  WHERE email = user_email
    AND is_active = true;
  RETURN org_id;
END;
$$;

-- Check if user is super_admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT get_user_role(auth.jwt() ->> 'email') = 'super_admin';
$$;

-- Update user_can_edit to include super_admin
CREATE OR REPLACE FUNCTION user_can_edit()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT get_user_role(auth.jwt() ->> 'email') IN ('super_admin', 'admin', 'staff');
$$;

-- ============================================================
-- 9. ORGANIZATIONS TABLE RLS POLICIES
-- ============================================================

-- Super admin: full CRUD on organizations
DROP POLICY IF EXISTS "Super admins can manage organizations" ON organizations;
CREATE POLICY "Super admins can manage organizations"
  ON organizations
  FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Admins can read their own organization
DROP POLICY IF EXISTS "Users can view own organization" ON organizations;
CREATE POLICY "Users can view own organization"
  ON organizations
  FOR SELECT
  TO authenticated
  USING (id = get_user_org_id(auth.jwt() ->> 'email'));

-- ============================================================
-- 10. UPDATE USERS TABLE RLS POLICIES
-- ============================================================
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Admins can read all users" ON users;
DROP POLICY IF EXISTS "Admins can insert users" ON users;
DROP POLICY IF EXISTS "Admins can update users" ON users;
DROP POLICY IF EXISTS "Users can insert own data" ON users;
DROP POLICY IF EXISTS "Super admins can read all users" ON users;
DROP POLICY IF EXISTS "Admins can read org users" ON users;
DROP POLICY IF EXISTS "Super admins can insert users" ON users;
DROP POLICY IF EXISTS "Admins can insert org users" ON users;
DROP POLICY IF EXISTS "Super admins can update users" ON users;
DROP POLICY IF EXISTS "Admins can update org users" ON users;

-- Users can read their own record
CREATE POLICY "Users can read own data"
  ON users FOR SELECT
  TO authenticated
  USING (auth.jwt() ->> 'email' = email);

-- Super admin can read all users
CREATE POLICY "Super admins can read all users"
  ON users FOR SELECT
  TO authenticated
  USING (is_super_admin());

-- Admins can read users within their organization
CREATE POLICY "Admins can read org users"
  ON users FOR SELECT
  TO authenticated
  USING (
    get_user_role(auth.jwt() ->> 'email') = 'admin'
    AND organization_id = get_user_org_id(auth.jwt() ->> 'email')
  );

-- Super admin can insert any user
CREATE POLICY "Super admins can insert users"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (is_super_admin());

-- Admins can insert users within their organization
CREATE POLICY "Admins can insert org users"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (
    get_user_role(auth.jwt() ->> 'email') = 'admin'
    AND organization_id = get_user_org_id(auth.jwt() ->> 'email')
  );

-- Super admin can update any user
CREATE POLICY "Super admins can update users"
  ON users FOR UPDATE
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Admins can update users within their organization
CREATE POLICY "Admins can update org users"
  ON users FOR UPDATE
  TO authenticated
  USING (
    get_user_role(auth.jwt() ->> 'email') = 'admin'
    AND organization_id = get_user_org_id(auth.jwt() ->> 'email')
  )
  WITH CHECK (
    get_user_role(auth.jwt() ->> 'email') = 'admin'
    AND organization_id = get_user_org_id(auth.jwt() ->> 'email')
  );

-- ============================================================
-- 11. UPDATE RLS POLICIES ON ALL 11 OPERATIONAL TABLES
-- ============================================================

-- Helper macro: For each table we drop old AND new policies, then create org-scoped ones.
-- Super admin has NO access to operational data.

-- --------------- CLIENTS ---------------
DROP POLICY IF EXISTS "Authenticated users can view clients" ON clients;
DROP POLICY IF EXISTS "Staff and admins can insert clients" ON clients;
DROP POLICY IF EXISTS "Staff and admins can update clients" ON clients;
DROP POLICY IF EXISTS "Staff and admins can delete clients" ON clients;
DROP POLICY IF EXISTS "Org users can view clients" ON clients;
DROP POLICY IF EXISTS "Org staff can insert clients" ON clients;
DROP POLICY IF EXISTS "Org staff can update clients" ON clients;
DROP POLICY IF EXISTS "Org staff can delete clients" ON clients;

CREATE POLICY "Org users can view clients"
  ON clients FOR SELECT TO authenticated
  USING (organization_id = get_user_org_id(auth.jwt() ->> 'email'));

CREATE POLICY "Org staff can insert clients"
  ON clients FOR INSERT TO authenticated
  WITH CHECK (user_can_edit() AND organization_id = get_user_org_id(auth.jwt() ->> 'email'));

CREATE POLICY "Org staff can update clients"
  ON clients FOR UPDATE TO authenticated
  USING (user_can_edit() AND organization_id = get_user_org_id(auth.jwt() ->> 'email'))
  WITH CHECK (user_can_edit() AND organization_id = get_user_org_id(auth.jwt() ->> 'email'));

CREATE POLICY "Org staff can delete clients"
  ON clients FOR DELETE TO authenticated
  USING (user_can_edit() AND organization_id = get_user_org_id(auth.jwt() ->> 'email'));

-- --------------- THERAPISTS ---------------
DROP POLICY IF EXISTS "Authenticated users can view therapists" ON therapists;
DROP POLICY IF EXISTS "Staff and admins can insert therapists" ON therapists;
DROP POLICY IF EXISTS "Staff and admins can update therapists" ON therapists;
DROP POLICY IF EXISTS "Staff and admins can delete therapists" ON therapists;
DROP POLICY IF EXISTS "Org users can view therapists" ON therapists;
DROP POLICY IF EXISTS "Org staff can insert therapists" ON therapists;
DROP POLICY IF EXISTS "Org staff can update therapists" ON therapists;
DROP POLICY IF EXISTS "Org staff can delete therapists" ON therapists;

CREATE POLICY "Org users can view therapists"
  ON therapists FOR SELECT TO authenticated
  USING (organization_id = get_user_org_id(auth.jwt() ->> 'email'));

CREATE POLICY "Org staff can insert therapists"
  ON therapists FOR INSERT TO authenticated
  WITH CHECK (user_can_edit() AND organization_id = get_user_org_id(auth.jwt() ->> 'email'));

CREATE POLICY "Org staff can update therapists"
  ON therapists FOR UPDATE TO authenticated
  USING (user_can_edit() AND organization_id = get_user_org_id(auth.jwt() ->> 'email'))
  WITH CHECK (user_can_edit() AND organization_id = get_user_org_id(auth.jwt() ->> 'email'));

CREATE POLICY "Org staff can delete therapists"
  ON therapists FOR DELETE TO authenticated
  USING (user_can_edit() AND organization_id = get_user_org_id(auth.jwt() ->> 'email'));

-- --------------- TEAMS ---------------
DROP POLICY IF EXISTS "Authenticated users can view teams" ON teams;
DROP POLICY IF EXISTS "Staff and admins can insert teams" ON teams;
DROP POLICY IF EXISTS "Staff and admins can update teams" ON teams;
DROP POLICY IF EXISTS "Staff and admins can delete teams" ON teams;
DROP POLICY IF EXISTS "Org users can view teams" ON teams;
DROP POLICY IF EXISTS "Org staff can insert teams" ON teams;
DROP POLICY IF EXISTS "Org staff can update teams" ON teams;
DROP POLICY IF EXISTS "Org staff can delete teams" ON teams;

CREATE POLICY "Org users can view teams"
  ON teams FOR SELECT TO authenticated
  USING (organization_id = get_user_org_id(auth.jwt() ->> 'email'));

CREATE POLICY "Org staff can insert teams"
  ON teams FOR INSERT TO authenticated
  WITH CHECK (user_can_edit() AND organization_id = get_user_org_id(auth.jwt() ->> 'email'));

CREATE POLICY "Org staff can update teams"
  ON teams FOR UPDATE TO authenticated
  USING (user_can_edit() AND organization_id = get_user_org_id(auth.jwt() ->> 'email'))
  WITH CHECK (user_can_edit() AND organization_id = get_user_org_id(auth.jwt() ->> 'email'));

CREATE POLICY "Org staff can delete teams"
  ON teams FOR DELETE TO authenticated
  USING (user_can_edit() AND organization_id = get_user_org_id(auth.jwt() ->> 'email'));

-- --------------- CALLOUTS ---------------
DROP POLICY IF EXISTS "Authenticated users can view callouts" ON callouts;
DROP POLICY IF EXISTS "Staff and admins can insert callouts" ON callouts;
DROP POLICY IF EXISTS "Staff and admins can update callouts" ON callouts;
DROP POLICY IF EXISTS "Staff and admins can delete callouts" ON callouts;
DROP POLICY IF EXISTS "Org users can view callouts" ON callouts;
DROP POLICY IF EXISTS "Org staff can insert callouts" ON callouts;
DROP POLICY IF EXISTS "Org staff can update callouts" ON callouts;
DROP POLICY IF EXISTS "Org staff can delete callouts" ON callouts;

CREATE POLICY "Org users can view callouts"
  ON callouts FOR SELECT TO authenticated
  USING (organization_id = get_user_org_id(auth.jwt() ->> 'email'));

CREATE POLICY "Org staff can insert callouts"
  ON callouts FOR INSERT TO authenticated
  WITH CHECK (user_can_edit() AND organization_id = get_user_org_id(auth.jwt() ->> 'email'));

CREATE POLICY "Org staff can update callouts"
  ON callouts FOR UPDATE TO authenticated
  USING (user_can_edit() AND organization_id = get_user_org_id(auth.jwt() ->> 'email'))
  WITH CHECK (user_can_edit() AND organization_id = get_user_org_id(auth.jwt() ->> 'email'));

CREATE POLICY "Org staff can delete callouts"
  ON callouts FOR DELETE TO authenticated
  USING (user_can_edit() AND organization_id = get_user_org_id(auth.jwt() ->> 'email'));

-- --------------- BASE SCHEDULES ---------------
DROP POLICY IF EXISTS "Authenticated users can view base schedules" ON base_schedules;
DROP POLICY IF EXISTS "Staff and admins can insert base schedules" ON base_schedules;
DROP POLICY IF EXISTS "Staff and admins can update base schedules" ON base_schedules;
DROP POLICY IF EXISTS "Staff and admins can delete base schedules" ON base_schedules;
DROP POLICY IF EXISTS "Org users can view base_schedules" ON base_schedules;
DROP POLICY IF EXISTS "Org staff can insert base_schedules" ON base_schedules;
DROP POLICY IF EXISTS "Org staff can update base_schedules" ON base_schedules;
DROP POLICY IF EXISTS "Org staff can delete base_schedules" ON base_schedules;

CREATE POLICY "Org users can view base_schedules"
  ON base_schedules FOR SELECT TO authenticated
  USING (organization_id = get_user_org_id(auth.jwt() ->> 'email'));

CREATE POLICY "Org staff can insert base_schedules"
  ON base_schedules FOR INSERT TO authenticated
  WITH CHECK (user_can_edit() AND organization_id = get_user_org_id(auth.jwt() ->> 'email'));

CREATE POLICY "Org staff can update base_schedules"
  ON base_schedules FOR UPDATE TO authenticated
  USING (user_can_edit() AND organization_id = get_user_org_id(auth.jwt() ->> 'email'))
  WITH CHECK (user_can_edit() AND organization_id = get_user_org_id(auth.jwt() ->> 'email'));

CREATE POLICY "Org staff can delete base_schedules"
  ON base_schedules FOR DELETE TO authenticated
  USING (user_can_edit() AND organization_id = get_user_org_id(auth.jwt() ->> 'email'));

-- --------------- DAILY SCHEDULES ---------------
DROP POLICY IF EXISTS "Authenticated users can view daily schedules" ON daily_schedules;
DROP POLICY IF EXISTS "Staff and admins can insert daily schedules" ON daily_schedules;
DROP POLICY IF EXISTS "Staff and admins can update daily schedules" ON daily_schedules;
DROP POLICY IF EXISTS "Staff and admins can delete daily schedules" ON daily_schedules;
DROP POLICY IF EXISTS "Org users can view daily_schedules" ON daily_schedules;
DROP POLICY IF EXISTS "Org staff can insert daily_schedules" ON daily_schedules;
DROP POLICY IF EXISTS "Org staff can update daily_schedules" ON daily_schedules;
DROP POLICY IF EXISTS "Org staff can delete daily_schedules" ON daily_schedules;

CREATE POLICY "Org users can view daily_schedules"
  ON daily_schedules FOR SELECT TO authenticated
  USING (organization_id = get_user_org_id(auth.jwt() ->> 'email'));

CREATE POLICY "Org staff can insert daily_schedules"
  ON daily_schedules FOR INSERT TO authenticated
  WITH CHECK (user_can_edit() AND organization_id = get_user_org_id(auth.jwt() ->> 'email'));

CREATE POLICY "Org staff can update daily_schedules"
  ON daily_schedules FOR UPDATE TO authenticated
  USING (user_can_edit() AND organization_id = get_user_org_id(auth.jwt() ->> 'email'))
  WITH CHECK (user_can_edit() AND organization_id = get_user_org_id(auth.jwt() ->> 'email'));

CREATE POLICY "Org staff can delete daily_schedules"
  ON daily_schedules FOR DELETE TO authenticated
  USING (user_can_edit() AND organization_id = get_user_org_id(auth.jwt() ->> 'email'));

-- --------------- SETTINGS ---------------
DROP POLICY IF EXISTS "Authenticated users can view settings" ON settings;
DROP POLICY IF EXISTS "Staff and admins can insert settings" ON settings;
DROP POLICY IF EXISTS "Staff and admins can update settings" ON settings;
DROP POLICY IF EXISTS "Staff and admins can delete settings" ON settings;
DROP POLICY IF EXISTS "Org users can view settings" ON settings;
DROP POLICY IF EXISTS "Org staff can insert settings" ON settings;
DROP POLICY IF EXISTS "Org staff can update settings" ON settings;
DROP POLICY IF EXISTS "Org staff can delete settings" ON settings;

CREATE POLICY "Org users can view settings"
  ON settings FOR SELECT TO authenticated
  USING (organization_id = get_user_org_id(auth.jwt() ->> 'email'));

CREATE POLICY "Org staff can insert settings"
  ON settings FOR INSERT TO authenticated
  WITH CHECK (user_can_edit() AND organization_id = get_user_org_id(auth.jwt() ->> 'email'));

CREATE POLICY "Org staff can update settings"
  ON settings FOR UPDATE TO authenticated
  USING (user_can_edit() AND organization_id = get_user_org_id(auth.jwt() ->> 'email'))
  WITH CHECK (user_can_edit() AND organization_id = get_user_org_id(auth.jwt() ->> 'email'));

CREATE POLICY "Org staff can delete settings"
  ON settings FOR DELETE TO authenticated
  USING (user_can_edit() AND organization_id = get_user_org_id(auth.jwt() ->> 'email'));

-- --------------- SYSTEM CONFIG ---------------
DROP POLICY IF EXISTS "Authenticated users can view system config" ON system_config;
DROP POLICY IF EXISTS "Staff and admins can insert system config" ON system_config;
DROP POLICY IF EXISTS "Staff and admins can update system config" ON system_config;
DROP POLICY IF EXISTS "Staff and admins can delete system config" ON system_config;
DROP POLICY IF EXISTS "Org users can view system_config" ON system_config;
DROP POLICY IF EXISTS "Org staff can insert system_config" ON system_config;
DROP POLICY IF EXISTS "Org staff can update system_config" ON system_config;
DROP POLICY IF EXISTS "Org staff can delete system_config" ON system_config;

CREATE POLICY "Org users can view system_config"
  ON system_config FOR SELECT TO authenticated
  USING (organization_id = get_user_org_id(auth.jwt() ->> 'email'));

CREATE POLICY "Org staff can insert system_config"
  ON system_config FOR INSERT TO authenticated
  WITH CHECK (user_can_edit() AND organization_id = get_user_org_id(auth.jwt() ->> 'email'));

CREATE POLICY "Org staff can update system_config"
  ON system_config FOR UPDATE TO authenticated
  USING (user_can_edit() AND organization_id = get_user_org_id(auth.jwt() ->> 'email'))
  WITH CHECK (user_can_edit() AND organization_id = get_user_org_id(auth.jwt() ->> 'email'));

CREATE POLICY "Org staff can delete system_config"
  ON system_config FOR DELETE TO authenticated
  USING (user_can_edit() AND organization_id = get_user_org_id(auth.jwt() ->> 'email'));

-- --------------- SCHEDULE FEEDBACK ---------------
DROP POLICY IF EXISTS "Authenticated users can view schedule feedback" ON schedule_feedback;
DROP POLICY IF EXISTS "Staff and admins can insert schedule feedback" ON schedule_feedback;
DROP POLICY IF EXISTS "Staff and admins can update schedule feedback" ON schedule_feedback;
DROP POLICY IF EXISTS "Staff and admins can delete schedule feedback" ON schedule_feedback;
DROP POLICY IF EXISTS "Org users can view schedule_feedback" ON schedule_feedback;
DROP POLICY IF EXISTS "Org staff can insert schedule_feedback" ON schedule_feedback;
DROP POLICY IF EXISTS "Org staff can update schedule_feedback" ON schedule_feedback;
DROP POLICY IF EXISTS "Org staff can delete schedule_feedback" ON schedule_feedback;

CREATE POLICY "Org users can view schedule_feedback"
  ON schedule_feedback FOR SELECT TO authenticated
  USING (organization_id = get_user_org_id(auth.jwt() ->> 'email'));

CREATE POLICY "Org staff can insert schedule_feedback"
  ON schedule_feedback FOR INSERT TO authenticated
  WITH CHECK (user_can_edit() AND organization_id = get_user_org_id(auth.jwt() ->> 'email'));

CREATE POLICY "Org staff can update schedule_feedback"
  ON schedule_feedback FOR UPDATE TO authenticated
  USING (user_can_edit() AND organization_id = get_user_org_id(auth.jwt() ->> 'email'))
  WITH CHECK (user_can_edit() AND organization_id = get_user_org_id(auth.jwt() ->> 'email'));

CREATE POLICY "Org staff can delete schedule_feedback"
  ON schedule_feedback FOR DELETE TO authenticated
  USING (user_can_edit() AND organization_id = get_user_org_id(auth.jwt() ->> 'email'));

-- --------------- SCHEDULE PATTERNS ---------------
DROP POLICY IF EXISTS "Authenticated users can view schedule patterns" ON schedule_patterns;
DROP POLICY IF EXISTS "Staff and admins can insert schedule patterns" ON schedule_patterns;
DROP POLICY IF EXISTS "Staff and admins can update schedule patterns" ON schedule_patterns;
DROP POLICY IF EXISTS "Staff and admins can delete schedule patterns" ON schedule_patterns;
DROP POLICY IF EXISTS "Org users can view schedule_patterns" ON schedule_patterns;
DROP POLICY IF EXISTS "Org staff can insert schedule_patterns" ON schedule_patterns;
DROP POLICY IF EXISTS "Org staff can update schedule_patterns" ON schedule_patterns;
DROP POLICY IF EXISTS "Org staff can delete schedule_patterns" ON schedule_patterns;

CREATE POLICY "Org users can view schedule_patterns"
  ON schedule_patterns FOR SELECT TO authenticated
  USING (organization_id = get_user_org_id(auth.jwt() ->> 'email'));

CREATE POLICY "Org staff can insert schedule_patterns"
  ON schedule_patterns FOR INSERT TO authenticated
  WITH CHECK (user_can_edit() AND organization_id = get_user_org_id(auth.jwt() ->> 'email'));

CREATE POLICY "Org staff can update schedule_patterns"
  ON schedule_patterns FOR UPDATE TO authenticated
  USING (user_can_edit() AND organization_id = get_user_org_id(auth.jwt() ->> 'email'))
  WITH CHECK (user_can_edit() AND organization_id = get_user_org_id(auth.jwt() ->> 'email'));

CREATE POLICY "Org staff can delete schedule_patterns"
  ON schedule_patterns FOR DELETE TO authenticated
  USING (user_can_edit() AND organization_id = get_user_org_id(auth.jwt() ->> 'email'));

-- --------------- CONSTRAINT VIOLATIONS LOG ---------------
DROP POLICY IF EXISTS "Authenticated users can view constraint violations" ON constraint_violations_log;
DROP POLICY IF EXISTS "Staff and admins can insert constraint violations" ON constraint_violations_log;
DROP POLICY IF EXISTS "Staff and admins can update constraint violations" ON constraint_violations_log;
DROP POLICY IF EXISTS "Staff and admins can delete constraint violations" ON constraint_violations_log;
DROP POLICY IF EXISTS "Org users can view constraint_violations_log" ON constraint_violations_log;
DROP POLICY IF EXISTS "Org staff can insert constraint_violations_log" ON constraint_violations_log;
DROP POLICY IF EXISTS "Org staff can update constraint_violations_log" ON constraint_violations_log;
DROP POLICY IF EXISTS "Org staff can delete constraint_violations_log" ON constraint_violations_log;

CREATE POLICY "Org users can view constraint_violations_log"
  ON constraint_violations_log FOR SELECT TO authenticated
  USING (organization_id = get_user_org_id(auth.jwt() ->> 'email'));

CREATE POLICY "Org staff can insert constraint_violations_log"
  ON constraint_violations_log FOR INSERT TO authenticated
  WITH CHECK (user_can_edit() AND organization_id = get_user_org_id(auth.jwt() ->> 'email'));

CREATE POLICY "Org staff can update constraint_violations_log"
  ON constraint_violations_log FOR UPDATE TO authenticated
  USING (user_can_edit() AND organization_id = get_user_org_id(auth.jwt() ->> 'email'))
  WITH CHECK (user_can_edit() AND organization_id = get_user_org_id(auth.jwt() ->> 'email'));

CREATE POLICY "Org staff can delete constraint_violations_log"
  ON constraint_violations_log FOR DELETE TO authenticated
  USING (user_can_edit() AND organization_id = get_user_org_id(auth.jwt() ->> 'email'));

-- ============================================================
-- 12. UPDATE daily_schedules UNIQUE CONSTRAINT
-- The schedule_date unique constraint needs to be scoped by org
-- ============================================================
-- Drop old unique constraint on schedule_date if it exists
DO $$
BEGIN
  -- Try to drop the unique index if it exists
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'daily_schedules_schedule_date_key') THEN
    ALTER TABLE daily_schedules DROP CONSTRAINT daily_schedules_schedule_date_key;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL; -- Ignore if it doesn't exist
END;
$$;

-- Create new unique constraint scoped by organization
CREATE UNIQUE INDEX IF NOT EXISTS daily_schedules_org_date_unique
  ON daily_schedules (organization_id, schedule_date);

-- ============================================================
-- 13. UPDATE settings UNIQUE CONSTRAINT
-- The key should be unique per organization, not globally
-- ============================================================
-- Settings key needs to be unique per org
CREATE UNIQUE INDEX IF NOT EXISTS settings_org_key_unique
  ON settings (organization_id, key);
