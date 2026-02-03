/*
  # Create Core Tables with Initial Data

  1. New Tables
    - `teams`
      - `id` (text, primary key)
      - `name` (text, unique)
      - `color` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `clients`
      - `id` (text, primary key)
      - `name` (text)
      - `team_id` (text, foreign key to teams)
      - `color` (text, nullable)
      - `insurance_requirements` (jsonb array)
      - `allied_health_needs` (jsonb array)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `therapists`
      - `id` (text, primary key)
      - `name` (text)
      - `role` (text)
      - `team_id` (text, foreign key to teams)
      - `qualifications` (jsonb array)
      - `can_provide_allied_health` (jsonb array)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage data

  3. Data
    - Seed with 3 teams (Red Team, Blue Team, Green Team)
    - Seed with 13 clients from existing mock data
    - Seed with 17 therapists from existing mock data
*/

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create teams table
CREATE TABLE IF NOT EXISTS teams (
  id text PRIMARY KEY,
  name text UNIQUE NOT NULL,
  color text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create trigger for teams updated_at
DROP TRIGGER IF EXISTS update_teams_updated_at ON teams;
CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON teams
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create clients table
CREATE TABLE IF NOT EXISTS clients (
  id text PRIMARY KEY,
  name text NOT NULL,
  team_id text REFERENCES teams(id) ON DELETE CASCADE,
  color text,
  insurance_requirements jsonb DEFAULT '[]'::jsonb,
  allied_health_needs jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index on team_id for efficient queries
CREATE INDEX IF NOT EXISTS idx_clients_team_id ON clients(team_id);

-- Create trigger for clients updated_at
DROP TRIGGER IF EXISTS update_clients_updated_at ON clients;
CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create therapists table
CREATE TABLE IF NOT EXISTS therapists (
  id text PRIMARY KEY,
  name text NOT NULL,
  role text NOT NULL DEFAULT 'BT',
  team_id text REFERENCES teams(id) ON DELETE CASCADE,
  qualifications jsonb DEFAULT '[]'::jsonb,
  can_provide_allied_health jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_therapists_team_id ON therapists(team_id);
CREATE INDEX IF NOT EXISTS idx_therapists_name ON therapists(name);

-- Create trigger for therapists updated_at
DROP TRIGGER IF EXISTS update_therapists_updated_at ON therapists;
CREATE TRIGGER update_therapists_updated_at
  BEFORE UPDATE ON therapists
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE therapists ENABLE ROW LEVEL SECURITY;

-- RLS Policies for teams (allow all operations for authenticated users)
CREATE POLICY "Teams can be viewed by all authenticated users"
  ON teams FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Teams can be inserted by authenticated users"
  ON teams FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Teams can be updated by authenticated users"
  ON teams FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Teams can be deleted by authenticated users"
  ON teams FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for clients (allow all operations for authenticated users)
CREATE POLICY "Clients can be viewed by all authenticated users"
  ON clients FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Clients can be inserted by authenticated users"
  ON clients FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Clients can be updated by authenticated users"
  ON clients FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Clients can be deleted by authenticated users"
  ON clients FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for therapists (allow all operations for authenticated users)
CREATE POLICY "Therapists can be viewed by all authenticated users"
  ON therapists FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Therapists can be inserted by authenticated users"
  ON therapists FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Therapists can be updated by authenticated users"
  ON therapists FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Therapists can be deleted by authenticated users"
  ON therapists FOR DELETE
  TO authenticated
  USING (true);

-- Insert seed data for teams
INSERT INTO teams (id, name, color) VALUES
  ('team-1', 'Red Team', '#EF4444'),
  ('team-2', 'Blue Team', '#3B82F6'),
  ('team-3', 'Green Team', '#10B981')
ON CONFLICT (id) DO NOTHING;

-- Insert seed data for therapists
INSERT INTO therapists (id, name, team_id, qualifications, can_provide_allied_health, role) VALUES
  ('t1', 'Breanne Hawkins', 'team-2', '["RBT","BLS","TRICARE","MD_MEDICAID"]'::jsonb, '[]'::jsonb, 'RBT'),
  ('t2', 'Ramsey Mahaffey', 'team-3', '["RBT","BLS","TRICARE","MD_MEDICAID"]'::jsonb, '[]'::jsonb, 'RBT'),
  ('t3', 'Britney Little', 'team-2', '["BCBA","BLS","TRICARE","MD_MEDICAID"]'::jsonb, '[]'::jsonb, 'BCBA'),
  ('t4', 'Amanda Lewis', 'team-1', '["BCBA","BLS","TRICARE","MD_MEDICAID"]'::jsonb, '[]'::jsonb, 'BCBA'),
  ('t5', 'Katie Marsico', 'team-2', '["RBT","BLS","TRICARE","MD_MEDICAID"]'::jsonb, '[]'::jsonb, 'RBT'),
  ('t6', 'Skyelar Mcleod', 'team-2', '["RBT","BLS","TRICARE","MD_MEDICAID"]'::jsonb, '[]'::jsonb, 'RBT'),
  ('t7', 'Renee Gilbert', 'team-2', '["RBT","BLS","TRICARE","MD_MEDICAID"]'::jsonb, '[]'::jsonb, 'RBT'),
  ('t8', 'Samantha Wheatley', 'team-3', '["RBT","BLS","TRICARE","MD_MEDICAID"]'::jsonb, '[]'::jsonb, 'RBT'),
  ('t9', 'Skylar Morley', 'team-2', '["RBT","BLS","TRICARE","MD_MEDICAID"]'::jsonb, '[]'::jsonb, 'RBT'),
  ('t10', 'Alexis Price', 'team-3', '["RBT","BLS","TRICARE","MD_MEDICAID"]'::jsonb, '[]'::jsonb, 'RBT'),
  ('t11', 'Courtney Edge', 'team-2', '["RBT","BLS","TRICARE","MD_MEDICAID"]'::jsonb, '[]'::jsonb, 'RBT'),
  ('t12', 'Adriana Lutzio', 'team-3', '["RBT","BLS","TRICARE","MD_MEDICAID"]'::jsonb, '[]'::jsonb, 'RBT'),
  ('t13', 'Sierra Hughes', 'team-3', '["RBT","BLS","TRICARE","MD_MEDICAID"]'::jsonb, '[]'::jsonb, 'RBT'),
  ('t14', 'Hannah Holloway', 'team-3', '["BLS","MD_MEDICAID"]'::jsonb, '[]'::jsonb, 'BT'),
  ('t15', 'Alyssa Lidard', 'team-3', '["BCBA","BLS","TRICARE","MD_MEDICAID"]'::jsonb, '[]'::jsonb, 'BCBA'),
  ('t16', 'Brittany Pender', 'team-3', '["BLS","MD_MEDICAID"]'::jsonb, '[]'::jsonb, 'BT'),
  ('t17', 'Izaiah Plaza', 'team-3', '["MD_MEDICAID"]'::jsonb, '[]'::jsonb, 'BT')
ON CONFLICT (id) DO NOTHING;

-- Insert seed data for clients
INSERT INTO clients (id, name, team_id, insurance_requirements, allied_health_needs) VALUES
  ('c1', 'JaxBri', 'team-2', '["MD_MEDICAID"]'::jsonb, '[]'::jsonb),
  ('c2', 'MarSul', 'team-2', '[]'::jsonb, '[]'::jsonb),
  ('c3', 'AbeAbe', 'team-3', '[]'::jsonb, '[]'::jsonb),
  ('c4', 'IsrOse', 'team-2', '[]'::jsonb, '[]'::jsonb),
  ('c5', 'MadHna', 'team-2', '[]'::jsonb, '[]'::jsonb),
  ('c6', 'FeyFag', 'team-2', '[]'::jsonb, '[]'::jsonb),
  ('c7', 'NolGun', 'team-2', '["RBT","BLS"]'::jsonb, '[]'::jsonb),
  ('c8', 'EsaOsb', 'team-1', '[]'::jsonb, '[]'::jsonb),
  ('c9', 'AndMic', 'team-3', '[]'::jsonb, '[]'::jsonb),
  ('c10', 'KilLuc', 'team-3', '["TRICARE","RBT","BLS"]'::jsonb, '[]'::jsonb),
  ('c11', 'AttFin', 'team-3', '[]'::jsonb, '[]'::jsonb),
  ('c12', 'MatFis', 'team-3', '["RBT","BLS"]'::jsonb, '[]'::jsonb),
  ('c13', 'WilPet', 'team-1', '[]'::jsonb, '[]'::jsonb)
ON CONFLICT (id) DO NOTHING;
