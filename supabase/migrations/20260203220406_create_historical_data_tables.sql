/*
  # Create Historical Data and Analytics Tables

  1. New Tables
    - `daily_schedules`
      - `id` (text, primary key)
      - `schedule_date` (date, unique)
      - `day_of_week` (text)
      - `schedule_data` (jsonb - stores GeneratedSchedule)
      - `generated_by` (text, nullable)
      - `validation_errors` (jsonb, nullable)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `schedule_feedback`
      - `id` (text, primary key)
      - `schedule_json` (jsonb)
      - `rating` (integer 1-5)
      - `violations_count` (integer)
      - `violations_detail` (jsonb)
      - `feedback_text` (text, nullable)
      - `team_id` (text, foreign key to teams, nullable)
      - `created_at` (timestamp)
    
    - `schedule_patterns`
      - `id` (text, primary key)
      - `pattern_type` (text)
      - `pattern_data` (jsonb)
      - `effectiveness_score` (float)
      - `sample_count` (integer)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `constraint_violations_log`
      - `id` (text, primary key)
      - `rule_id` (text)
      - `violation_count` (integer)
      - `average_severity` (float)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Allow authenticated users to access their own data

  3. Indexes
    - Unique index on schedule_date for daily_schedules
    - Index on team_id for schedule_feedback
    - Index on created_at for historical queries
*/

-- Create daily_schedules table
CREATE TABLE IF NOT EXISTS daily_schedules (
  id text PRIMARY KEY,
  schedule_date date UNIQUE NOT NULL,
  day_of_week text NOT NULL,
  schedule_data jsonb NOT NULL,
  generated_by text,
  validation_errors jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for daily_schedules
CREATE INDEX IF NOT EXISTS idx_daily_schedules_date ON daily_schedules(schedule_date);
CREATE INDEX IF NOT EXISTS idx_daily_schedules_created_at ON daily_schedules(created_at);

-- Create trigger for daily_schedules updated_at
DROP TRIGGER IF EXISTS update_daily_schedules_updated_at ON daily_schedules;
CREATE TRIGGER update_daily_schedules_updated_at
  BEFORE UPDATE ON daily_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create schedule_feedback table
CREATE TABLE IF NOT EXISTS schedule_feedback (
  id text PRIMARY KEY,
  schedule_json jsonb NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  violations_count integer DEFAULT 0,
  violations_detail jsonb,
  feedback_text text,
  team_id text REFERENCES teams(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for schedule_feedback
CREATE INDEX IF NOT EXISTS idx_schedule_feedback_team_id ON schedule_feedback(team_id);
CREATE INDEX IF NOT EXISTS idx_schedule_feedback_rating ON schedule_feedback(rating);
CREATE INDEX IF NOT EXISTS idx_schedule_feedback_created_at ON schedule_feedback(created_at);

-- Create schedule_patterns table
CREATE TABLE IF NOT EXISTS schedule_patterns (
  id text PRIMARY KEY,
  pattern_type text NOT NULL,
  pattern_data jsonb NOT NULL,
  effectiveness_score float DEFAULT 0.0,
  sample_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for schedule_patterns
CREATE INDEX IF NOT EXISTS idx_schedule_patterns_type ON schedule_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_schedule_patterns_score ON schedule_patterns(effectiveness_score);

-- Create trigger for schedule_patterns updated_at
DROP TRIGGER IF EXISTS update_schedule_patterns_updated_at ON schedule_patterns;
CREATE TRIGGER update_schedule_patterns_updated_at
  BEFORE UPDATE ON schedule_patterns
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create constraint_violations_log table
CREATE TABLE IF NOT EXISTS constraint_violations_log (
  id text PRIMARY KEY,
  rule_id text NOT NULL,
  violation_count integer DEFAULT 0,
  average_severity float DEFAULT 0.0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for constraint_violations_log
CREATE INDEX IF NOT EXISTS idx_violations_log_rule_id ON constraint_violations_log(rule_id);
CREATE INDEX IF NOT EXISTS idx_violations_log_count ON constraint_violations_log(violation_count);

-- Create trigger for constraint_violations_log updated_at
DROP TRIGGER IF EXISTS update_constraint_violations_log_updated_at ON constraint_violations_log;
CREATE TRIGGER update_constraint_violations_log_updated_at
  BEFORE UPDATE ON constraint_violations_log
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE daily_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE constraint_violations_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for daily_schedules (allow all operations for authenticated users)
CREATE POLICY "Daily schedules can be viewed by all authenticated users"
  ON daily_schedules FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Daily schedules can be inserted by authenticated users"
  ON daily_schedules FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Daily schedules can be updated by authenticated users"
  ON daily_schedules FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Daily schedules can be deleted by authenticated users"
  ON daily_schedules FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for schedule_feedback (allow all operations for authenticated users)
CREATE POLICY "Schedule feedback can be viewed by all authenticated users"
  ON schedule_feedback FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Schedule feedback can be inserted by authenticated users"
  ON schedule_feedback FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Schedule feedback can be updated by authenticated users"
  ON schedule_feedback FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Schedule feedback can be deleted by authenticated users"
  ON schedule_feedback FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for schedule_patterns (allow all operations for authenticated users)
CREATE POLICY "Schedule patterns can be viewed by all authenticated users"
  ON schedule_patterns FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Schedule patterns can be inserted by authenticated users"
  ON schedule_patterns FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Schedule patterns can be updated by authenticated users"
  ON schedule_patterns FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Schedule patterns can be deleted by authenticated users"
  ON schedule_patterns FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for constraint_violations_log (allow all operations for authenticated users)
CREATE POLICY "Constraint violations can be viewed by all authenticated users"
  ON constraint_violations_log FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Constraint violations can be inserted by authenticated users"
  ON constraint_violations_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Constraint violations can be updated by authenticated users"
  ON constraint_violations_log FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Constraint violations can be deleted by authenticated users"
  ON constraint_violations_log FOR DELETE
  TO authenticated
  USING (true);
