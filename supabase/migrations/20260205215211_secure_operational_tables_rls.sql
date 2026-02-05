/*
  # Secure All Operational Tables with Proper RLS Policies

  ## Problem
  11 tables currently have USING(true) policies open to the `public` role,
  allowing unauthenticated access to read, write, and delete all data.

  ## Changes
  Replace all open policies on operational tables with role-based policies:

  1. Tables affected:
     - `clients` - Client records
     - `therapists` - Staff/therapist records
     - `teams` - Team definitions
     - `callouts` - Unavailability records
     - `base_schedules` - Base schedule configurations
     - `daily_schedules` - Generated daily schedules
     - `settings` - Application settings
     - `system_config` - System configuration
     - `schedule_feedback` - Schedule rating feedback
     - `schedule_patterns` - Learned schedule patterns
     - `constraint_violations_log` - Constraint violation history

  2. New policy structure per table:
     - SELECT: All authenticated users can read
     - INSERT: Admin and staff can create
     - UPDATE: Admin and staff can update
     - DELETE: Admin and staff can delete

  3. Security improvements:
     - All policies restricted to `authenticated` role
     - Write operations restricted to admin and staff roles
     - No unauthenticated access possible

  ## Important Notes
  - Uses existing `get_user_role()` helper function for role checks
  - Viewers can only read data, not modify it
  - Admin and staff have full CRUD access to operational data
*/

-- Helper: Create a reusable function to check if user can edit (admin or staff)
CREATE OR REPLACE FUNCTION user_can_edit()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT get_user_role(auth.jwt() ->> 'email') IN ('admin', 'staff');
$$;

-- ============================
-- CLIENTS TABLE
-- ============================
DROP POLICY IF EXISTS "Clients are viewable by everyone" ON clients;
DROP POLICY IF EXISTS "Clients can be inserted by everyone" ON clients;
DROP POLICY IF EXISTS "Clients can be updated by everyone" ON clients;
DROP POLICY IF EXISTS "Clients can be deleted by everyone" ON clients;

CREATE POLICY "Authenticated users can view clients"
  ON clients FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff and admins can insert clients"
  ON clients FOR INSERT
  TO authenticated
  WITH CHECK (user_can_edit());

CREATE POLICY "Staff and admins can update clients"
  ON clients FOR UPDATE
  TO authenticated
  USING (user_can_edit())
  WITH CHECK (user_can_edit());

CREATE POLICY "Staff and admins can delete clients"
  ON clients FOR DELETE
  TO authenticated
  USING (user_can_edit());

-- ============================
-- THERAPISTS TABLE
-- ============================
DROP POLICY IF EXISTS "Therapists are viewable by everyone" ON therapists;
DROP POLICY IF EXISTS "Therapists can be inserted by everyone" ON therapists;
DROP POLICY IF EXISTS "Therapists can be updated by everyone" ON therapists;
DROP POLICY IF EXISTS "Therapists can be deleted by everyone" ON therapists;

CREATE POLICY "Authenticated users can view therapists"
  ON therapists FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff and admins can insert therapists"
  ON therapists FOR INSERT
  TO authenticated
  WITH CHECK (user_can_edit());

CREATE POLICY "Staff and admins can update therapists"
  ON therapists FOR UPDATE
  TO authenticated
  USING (user_can_edit())
  WITH CHECK (user_can_edit());

CREATE POLICY "Staff and admins can delete therapists"
  ON therapists FOR DELETE
  TO authenticated
  USING (user_can_edit());

-- ============================
-- TEAMS TABLE
-- ============================
DROP POLICY IF EXISTS "Teams are viewable by everyone" ON teams;
DROP POLICY IF EXISTS "Teams can be inserted by everyone" ON teams;
DROP POLICY IF EXISTS "Teams can be updated by everyone" ON teams;
DROP POLICY IF EXISTS "Teams can be deleted by everyone" ON teams;

CREATE POLICY "Authenticated users can view teams"
  ON teams FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff and admins can insert teams"
  ON teams FOR INSERT
  TO authenticated
  WITH CHECK (user_can_edit());

CREATE POLICY "Staff and admins can update teams"
  ON teams FOR UPDATE
  TO authenticated
  USING (user_can_edit())
  WITH CHECK (user_can_edit());

CREATE POLICY "Staff and admins can delete teams"
  ON teams FOR DELETE
  TO authenticated
  USING (user_can_edit());

-- ============================
-- CALLOUTS TABLE
-- ============================
DROP POLICY IF EXISTS "Callouts are viewable by everyone" ON callouts;
DROP POLICY IF EXISTS "Callouts can be inserted by everyone" ON callouts;
DROP POLICY IF EXISTS "Callouts can be updated by everyone" ON callouts;
DROP POLICY IF EXISTS "Callouts can be deleted by everyone" ON callouts;

CREATE POLICY "Authenticated users can view callouts"
  ON callouts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff and admins can insert callouts"
  ON callouts FOR INSERT
  TO authenticated
  WITH CHECK (user_can_edit());

CREATE POLICY "Staff and admins can update callouts"
  ON callouts FOR UPDATE
  TO authenticated
  USING (user_can_edit())
  WITH CHECK (user_can_edit());

CREATE POLICY "Staff and admins can delete callouts"
  ON callouts FOR DELETE
  TO authenticated
  USING (user_can_edit());

-- ============================
-- BASE SCHEDULES TABLE
-- ============================
DROP POLICY IF EXISTS "Base schedules are viewable by everyone" ON base_schedules;
DROP POLICY IF EXISTS "Base schedules can be inserted by everyone" ON base_schedules;
DROP POLICY IF EXISTS "Base schedules can be updated by everyone" ON base_schedules;
DROP POLICY IF EXISTS "Base schedules can be deleted by everyone" ON base_schedules;

CREATE POLICY "Authenticated users can view base schedules"
  ON base_schedules FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff and admins can insert base schedules"
  ON base_schedules FOR INSERT
  TO authenticated
  WITH CHECK (user_can_edit());

CREATE POLICY "Staff and admins can update base schedules"
  ON base_schedules FOR UPDATE
  TO authenticated
  USING (user_can_edit())
  WITH CHECK (user_can_edit());

CREATE POLICY "Staff and admins can delete base schedules"
  ON base_schedules FOR DELETE
  TO authenticated
  USING (user_can_edit());

-- ============================
-- DAILY SCHEDULES TABLE
-- ============================
DROP POLICY IF EXISTS "Daily schedules are viewable by everyone" ON daily_schedules;
DROP POLICY IF EXISTS "Daily schedules can be inserted by everyone" ON daily_schedules;
DROP POLICY IF EXISTS "Daily schedules can be updated by everyone" ON daily_schedules;
DROP POLICY IF EXISTS "Daily schedules can be deleted by everyone" ON daily_schedules;

CREATE POLICY "Authenticated users can view daily schedules"
  ON daily_schedules FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff and admins can insert daily schedules"
  ON daily_schedules FOR INSERT
  TO authenticated
  WITH CHECK (user_can_edit());

CREATE POLICY "Staff and admins can update daily schedules"
  ON daily_schedules FOR UPDATE
  TO authenticated
  USING (user_can_edit())
  WITH CHECK (user_can_edit());

CREATE POLICY "Staff and admins can delete daily schedules"
  ON daily_schedules FOR DELETE
  TO authenticated
  USING (user_can_edit());

-- ============================
-- SETTINGS TABLE
-- ============================
DROP POLICY IF EXISTS "Settings are viewable by everyone" ON settings;
DROP POLICY IF EXISTS "Settings can be inserted by everyone" ON settings;
DROP POLICY IF EXISTS "Settings can be updated by everyone" ON settings;
DROP POLICY IF EXISTS "Settings can be deleted by everyone" ON settings;

CREATE POLICY "Authenticated users can view settings"
  ON settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff and admins can insert settings"
  ON settings FOR INSERT
  TO authenticated
  WITH CHECK (user_can_edit());

CREATE POLICY "Staff and admins can update settings"
  ON settings FOR UPDATE
  TO authenticated
  USING (user_can_edit())
  WITH CHECK (user_can_edit());

CREATE POLICY "Staff and admins can delete settings"
  ON settings FOR DELETE
  TO authenticated
  USING (user_can_edit());

-- ============================
-- SYSTEM CONFIG TABLE
-- ============================
DROP POLICY IF EXISTS "System config is viewable by everyone" ON system_config;
DROP POLICY IF EXISTS "System config can be inserted by everyone" ON system_config;
DROP POLICY IF EXISTS "System config can be updated by everyone" ON system_config;
DROP POLICY IF EXISTS "System config can be deleted by everyone" ON system_config;

CREATE POLICY "Authenticated users can view system config"
  ON system_config FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff and admins can insert system config"
  ON system_config FOR INSERT
  TO authenticated
  WITH CHECK (user_can_edit());

CREATE POLICY "Staff and admins can update system config"
  ON system_config FOR UPDATE
  TO authenticated
  USING (user_can_edit())
  WITH CHECK (user_can_edit());

CREATE POLICY "Staff and admins can delete system config"
  ON system_config FOR DELETE
  TO authenticated
  USING (user_can_edit());

-- ============================
-- SCHEDULE FEEDBACK TABLE
-- ============================
DROP POLICY IF EXISTS "Schedule feedback is viewable by everyone" ON schedule_feedback;
DROP POLICY IF EXISTS "Schedule feedback can be inserted by everyone" ON schedule_feedback;
DROP POLICY IF EXISTS "Schedule feedback can be updated by everyone" ON schedule_feedback;
DROP POLICY IF EXISTS "Schedule feedback can be deleted by everyone" ON schedule_feedback;

CREATE POLICY "Authenticated users can view schedule feedback"
  ON schedule_feedback FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff and admins can insert schedule feedback"
  ON schedule_feedback FOR INSERT
  TO authenticated
  WITH CHECK (user_can_edit());

CREATE POLICY "Staff and admins can update schedule feedback"
  ON schedule_feedback FOR UPDATE
  TO authenticated
  USING (user_can_edit())
  WITH CHECK (user_can_edit());

CREATE POLICY "Staff and admins can delete schedule feedback"
  ON schedule_feedback FOR DELETE
  TO authenticated
  USING (user_can_edit());

-- ============================
-- SCHEDULE PATTERNS TABLE
-- ============================
DROP POLICY IF EXISTS "Schedule patterns are viewable by everyone" ON schedule_patterns;
DROP POLICY IF EXISTS "Schedule patterns can be inserted by everyone" ON schedule_patterns;
DROP POLICY IF EXISTS "Schedule patterns can be updated by everyone" ON schedule_patterns;
DROP POLICY IF EXISTS "Schedule patterns can be deleted by everyone" ON schedule_patterns;

CREATE POLICY "Authenticated users can view schedule patterns"
  ON schedule_patterns FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff and admins can insert schedule patterns"
  ON schedule_patterns FOR INSERT
  TO authenticated
  WITH CHECK (user_can_edit());

CREATE POLICY "Staff and admins can update schedule patterns"
  ON schedule_patterns FOR UPDATE
  TO authenticated
  USING (user_can_edit())
  WITH CHECK (user_can_edit());

CREATE POLICY "Staff and admins can delete schedule patterns"
  ON schedule_patterns FOR DELETE
  TO authenticated
  USING (user_can_edit());

-- ============================
-- CONSTRAINT VIOLATIONS LOG TABLE
-- ============================
DROP POLICY IF EXISTS "Constraint violations are viewable by everyone" ON constraint_violations_log;
DROP POLICY IF EXISTS "Constraint violations can be inserted by everyone" ON constraint_violations_log;
DROP POLICY IF EXISTS "Constraint violations can be updated by everyone" ON constraint_violations_log;
DROP POLICY IF EXISTS "Constraint violations can be deleted by everyone" ON constraint_violations_log;

CREATE POLICY "Authenticated users can view constraint violations"
  ON constraint_violations_log FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff and admins can insert constraint violations"
  ON constraint_violations_log FOR INSERT
  TO authenticated
  WITH CHECK (user_can_edit());

CREATE POLICY "Staff and admins can update constraint violations"
  ON constraint_violations_log FOR UPDATE
  TO authenticated
  USING (user_can_edit())
  WITH CHECK (user_can_edit());

CREATE POLICY "Staff and admins can delete constraint violations"
  ON constraint_violations_log FOR DELETE
  TO authenticated
  USING (user_can_edit());