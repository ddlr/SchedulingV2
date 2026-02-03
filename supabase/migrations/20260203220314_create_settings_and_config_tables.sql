/*
  # Create Settings and System Config Tables

  1. New Tables
    - `settings`
      - `key` (text, primary key, unique)
      - `value` (jsonb)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `system_config`
      - `id` (text, primary key, default 'default')
      - `config_data` (jsonb)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Allow all authenticated users to read
    - Allow all authenticated users to update

  3. Data
    - Seed settings with insurance_qualifications
    - Seed system_config with operating hours, colors, roles, and session types
*/

-- Create settings table
CREATE TABLE IF NOT EXISTS settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create trigger for settings updated_at
DROP TRIGGER IF EXISTS update_settings_updated_at ON settings;
CREATE TRIGGER update_settings_updated_at
  BEFORE UPDATE ON settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create system_config table
CREATE TABLE IF NOT EXISTS system_config (
  id text PRIMARY KEY DEFAULT 'default',
  config_data jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create trigger for system_config updated_at
DROP TRIGGER IF EXISTS update_system_config_updated_at ON system_config;
CREATE TRIGGER update_system_config_updated_at
  BEFORE UPDATE ON system_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies for settings (read/write for all authenticated users)
CREATE POLICY "Settings can be viewed by all authenticated users"
  ON settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Settings can be inserted by authenticated users"
  ON settings FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Settings can be updated by authenticated users"
  ON settings FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Settings can be deleted by authenticated users"
  ON settings FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for system_config (read/write for all authenticated users)
CREATE POLICY "System config can be viewed by all authenticated users"
  ON system_config FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System config can be inserted by authenticated users"
  ON system_config FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "System config can be updated by authenticated users"
  ON system_config FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "System config can be deleted by authenticated users"
  ON system_config FOR DELETE
  TO authenticated
  USING (true);

-- Insert seed data for settings (insurance qualifications)
INSERT INTO settings (key, value) VALUES
  ('insurance_qualifications', '["RBT", "BCBA", "Clinical Fellow", "MD_MEDICAID", "OT Certified", "SLP Certified", "BLS", "TRICARE"]'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Insert seed data for system_config
INSERT INTO system_config (id, config_data) VALUES
  ('default', '{
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
    "clientColorPalette": ["#E6194B", "#3CB44B", "#FFE119", "#4363D8", "#F58231", "#911EB4", "#46F0F0", "#F032E6", "#BCF60C", "#FABEBE", "#008080", "#E6BEFF", "#9A6324", "#FFFAC8", "#800000", "#AAFFC3", "#808000", "#FFD8B1", "#000075", "#FFB3BA", "#FFDFBA", "#FFFFBA", "#BAFFC9", "#BAE1FF"],
    "workingDays": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
  }'::jsonb)
ON CONFLICT (id) DO NOTHING;
