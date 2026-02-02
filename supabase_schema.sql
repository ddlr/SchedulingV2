-- SQL Migration for ABA Scheduler
-- This script sets up the tables for clients, staff (formerly therapists), teams, insurance qualifications, callouts, and system configuration.

-- 1. Teams Table
CREATE TABLE IF NOT EXISTS teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Staff Table (formerly therapists)
CREATE TABLE IF NOT EXISTS staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role text NOT NULL,
  team_id uuid REFERENCES teams(id) ON DELETE SET NULL,
  qualifications text[] DEFAULT '{}',
  can_provide_allied_health text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. Clients Table
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  team_id uuid REFERENCES teams(id) ON DELETE SET NULL,
  color text,
  insurance_requirements text[] DEFAULT '{}',
  allied_health_needs jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 4. Insurance Qualifications Table
CREATE TABLE IF NOT EXISTS insurance_qualifications (
  id text PRIMARY KEY, -- Using the name/identifier as PK as per current logic
  max_staff_per_day integer,
  min_session_duration_minutes integer,
  max_session_duration_minutes integer,
  max_hours_per_week integer,
  role_hierarchy_order integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 5. Callouts Table
CREATE TABLE IF NOT EXISTS callouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('client', 'staff')),
  entity_id uuid NOT NULL,
  entity_name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 6. System Configuration Table
CREATE TABLE IF NOT EXISTS system_config (
  id text PRIMARY KEY,
  config_data jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE insurance_qualifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE callouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

-- Create Policies (Allowing public access for now as per previous mock behavior, but can be restricted)
CREATE POLICY "Allow public read access to teams" ON teams FOR SELECT TO public USING (true);
CREATE POLICY "Allow public insert access to teams" ON teams FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow public update access to teams" ON teams FOR UPDATE TO public USING (true);
CREATE POLICY "Allow public delete access to teams" ON teams FOR DELETE TO public USING (true);

CREATE POLICY "Allow public read access to staff" ON staff FOR SELECT TO public USING (true);
CREATE POLICY "Allow public insert access to staff" ON staff FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow public update access to staff" ON staff FOR UPDATE TO public USING (true);
CREATE POLICY "Allow public delete access to staff" ON staff FOR DELETE TO public USING (true);

CREATE POLICY "Allow public read access to clients" ON clients FOR SELECT TO public USING (true);
CREATE POLICY "Allow public insert access to clients" ON clients FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow public update access to clients" ON clients FOR UPDATE TO public USING (true);
CREATE POLICY "Allow public delete access to clients" ON clients FOR DELETE TO public USING (true);

CREATE POLICY "Allow public read access to insurance_qualifications" ON insurance_qualifications FOR SELECT TO public USING (true);
CREATE POLICY "Allow public insert access to insurance_qualifications" ON insurance_qualifications FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow public update access to insurance_qualifications" ON insurance_qualifications FOR UPDATE TO public USING (true);
CREATE POLICY "Allow public delete access to insurance_qualifications" ON insurance_qualifications FOR DELETE TO public USING (true);

CREATE POLICY "Allow public read access to callouts" ON callouts FOR SELECT TO public USING (true);
CREATE POLICY "Allow public insert access to callouts" ON callouts FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow public update access to callouts" ON callouts FOR UPDATE TO public USING (true);
CREATE POLICY "Allow public delete access to callouts" ON callouts FOR DELETE TO public USING (true);

CREATE POLICY "Allow public read access to system_config" ON system_config FOR SELECT TO public USING (true);
CREATE POLICY "Allow public insert access to system_config" ON system_config FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow public update access to system_config" ON system_config FOR UPDATE TO public USING (true);
CREATE POLICY "Allow public delete access to system_config" ON system_config FOR DELETE TO public USING (true);

-- 7. Base Schedules Table
CREATE TABLE IF NOT EXISTS base_schedules (
  id text PRIMARY KEY,
  name text NOT NULL,
  applies_to_days text[] DEFAULT '{}',
  schedule jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE base_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access to base_schedules" ON base_schedules FOR SELECT TO public USING (true);
CREATE POLICY "Allow public insert access to base_schedules" ON base_schedules FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow public update access to base_schedules" ON base_schedules FOR UPDATE TO public USING (true);
CREATE POLICY "Allow public delete access to base_schedules" ON base_schedules FOR DELETE TO public USING (true);

-- 8. Schedule Feedback Table
CREATE TABLE IF NOT EXISTS schedule_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_json jsonb NOT NULL,
  rating integer NOT NULL,
  violations_count integer,
  violations_detail jsonb,
  feedback_text text,
  team_id uuid REFERENCES teams(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE schedule_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access to schedule_feedback" ON schedule_feedback FOR SELECT TO public USING (true);
CREATE POLICY "Allow public insert access to schedule_feedback" ON schedule_feedback FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow public update access to schedule_feedback" ON schedule_feedback FOR UPDATE TO public USING (true);
CREATE POLICY "Allow public delete access to schedule_feedback" ON schedule_feedback FOR DELETE TO public USING (true);

-- 9. Schedule Patterns Table
CREATE TABLE IF NOT EXISTS schedule_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_type text NOT NULL,
  pattern_data jsonb NOT NULL,
  effectiveness_score float DEFAULT 0,
  sample_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE schedule_patterns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access to schedule_patterns" ON schedule_patterns FOR SELECT TO public USING (true);
CREATE POLICY "Allow public insert access to schedule_patterns" ON schedule_patterns FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow public update access to schedule_patterns" ON schedule_patterns FOR UPDATE TO public USING (true);
CREATE POLICY "Allow public delete access to schedule_patterns" ON schedule_patterns FOR DELETE TO public USING (true);

-- 10. Constraint Violations Log Table
CREATE TABLE IF NOT EXISTS constraint_violations_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id text NOT NULL,
  violation_count integer DEFAULT 0,
  average_severity float DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE constraint_violations_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access to constraint_violations_log" ON constraint_violations_log FOR SELECT TO public USING (true);
CREATE POLICY "Allow public insert access to constraint_violations_log" ON constraint_violations_log FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow public update access to constraint_violations_log" ON constraint_violations_log FOR UPDATE TO public USING (true);
CREATE POLICY "Allow public delete access to constraint_violations_log" ON constraint_violations_log FOR DELETE TO public USING (true);

-- Insert Default System Config
INSERT INTO system_config (id, config_data)
VALUES (
  'default',
  '{
    "companyOperatingHoursStart": "09:00",
    "companyOperatingHoursEnd": "17:00",
    "staffAssumedAvailabilityStart": "08:45",
    "staffAssumedAvailabilityEnd": "17:15",
    "lunchCoverageStartTime": "11:00",
    "lunchCoverageEndTime": "14:00",
    "idealLunchWindowStart": "11:00",
    "idealLunchWindowEndForStart": "13:30",
    "teamColors": ["#FBBF24", "#34D399", "#60A5FA", "#F472B6", "#A78BFA", "#2DD4BF", "#F0ABFC", "#FCA5A5"],
    "allTherapistRoles": ["BCBA", "CF", "STAR 3", "STAR 2", "STAR 1", "RBT", "BT", "Other"],
    "defaultRoleRank": {
      "BCBA": 6,
      "CF": 5,
      "STAR 3": 4,
      "STAR 2": 3,
      "STAR 1": 2,
      "RBT": 1,
      "BT": 0,
      "Other": -1
    },
    "allAlliedHealthServices": ["OT", "SLP"],
    "allSessionTypes": ["ABA", "AlliedHealth_OT", "AlliedHealth_SLP", "IndirectTime"],
    "clientColorPalette": [
      "#E6194B", "#3CB44B", "#FFE119", "#4363D8", "#F58231", "#911EB4", "#46F0F0", "#F032E6",
      "#BCF60C", "#FABEBE", "#008080", "#E6BEFF", "#9A6324", "#FFFAC8", "#800000", "#AAFFC3",
      "#808000", "#FFD8B1", "#000075", "#FFB3BA", "#FFDFBA", "#FFFFBA", "#BAFFC9", "#BAE1FF"
    ],
    "workingDays": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
  }'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- Insert Initial Insurance Qualifications
INSERT INTO insurance_qualifications (id, max_staff_per_day)
VALUES
  ('RBT', NULL),
  ('BCBA', NULL),
  ('Clinical Fellow', NULL),
  ('MD_MEDICAID', 3),
  ('OT Certified', NULL),
  ('SLP Certified', NULL)
ON CONFLICT (id) DO NOTHING;
