/*
  # Create Callouts and Base Schedules Tables

  1. New Tables
    - `callouts`
      - `id` (text, primary key)
      - `entity_type` (text - 'client' or 'therapist')
      - `entity_id` (text)
      - `entity_name` (text)
      - `start_date` (date)
      - `end_date` (date)
      - `start_time` (text)
      - `end_time` (text)
      - `reason` (text, nullable)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `base_schedules`
      - `id` (text, primary key)
      - `name` (text)
      - `applies_to_days` (text array)
      - `schedule` (jsonb, nullable - stores GeneratedSchedule)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Allow all authenticated users to manage callouts
    - Allow all authenticated users to manage base schedules

  3. Indexes
    - Composite index on callouts for date range queries
    - Index on entity_type and entity_id for efficient lookups
*/

-- Create callouts table
CREATE TABLE IF NOT EXISTS callouts (
  id text PRIMARY KEY,
  entity_type text NOT NULL CHECK (entity_type IN ('client', 'therapist')),
  entity_id text NOT NULL,
  entity_name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  start_time text NOT NULL,
  end_time text NOT NULL,
  reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for callouts
CREATE INDEX IF NOT EXISTS idx_callouts_entity ON callouts(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_callouts_dates ON callouts(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_callouts_entity_dates ON callouts(entity_type, entity_id, start_date, end_date);

-- Create trigger for callouts updated_at
DROP TRIGGER IF EXISTS update_callouts_updated_at ON callouts;
CREATE TRIGGER update_callouts_updated_at
  BEFORE UPDATE ON callouts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create base_schedules table
CREATE TABLE IF NOT EXISTS base_schedules (
  id text PRIMARY KEY,
  name text NOT NULL,
  applies_to_days text[] DEFAULT ARRAY[]::text[],
  schedule jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for base_schedules
CREATE INDEX IF NOT EXISTS idx_base_schedules_name ON base_schedules(name);

-- Create trigger for base_schedules updated_at
DROP TRIGGER IF EXISTS update_base_schedules_updated_at ON base_schedules;
CREATE TRIGGER update_base_schedules_updated_at
  BEFORE UPDATE ON base_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE callouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE base_schedules ENABLE ROW LEVEL SECURITY;

-- RLS Policies for callouts (allow all operations for authenticated users)
CREATE POLICY "Callouts can be viewed by all authenticated users"
  ON callouts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Callouts can be inserted by authenticated users"
  ON callouts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Callouts can be updated by authenticated users"
  ON callouts FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Callouts can be deleted by authenticated users"
  ON callouts FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for base_schedules (allow all operations for authenticated users)
CREATE POLICY "Base schedules can be viewed by all authenticated users"
  ON base_schedules FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Base schedules can be inserted by authenticated users"
  ON base_schedules FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Base schedules can be updated by authenticated users"
  ON base_schedules FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Base schedules can be deleted by authenticated users"
  ON base_schedules FOR DELETE
  TO authenticated
  USING (true);
