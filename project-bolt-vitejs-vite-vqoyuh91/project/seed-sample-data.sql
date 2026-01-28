-- Sample data for ABA Harmony Scheduler
-- This script adds sample teams, therapists, and clients for demonstration

-- Insert sample teams
INSERT INTO teams (id, name, color) VALUES
  ('team-001', 'Red Team', '#EF4444'),
  ('team-002', 'Blue Team', '#3B82F6'),
  ('team-003', 'Green Team', '#10B981')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  color = EXCLUDED.color;

-- Insert sample therapists
INSERT INTO therapists (id, name, team_id, qualifications, can_provide_allied_health) VALUES
  ('therapist-001', 'Sarah Johnson', 'team-001', '["BCBA", "RBT"]', '["OT"]'),
  ('therapist-002', 'Mike Chen', 'team-001', '["RBT"]', '[]'),
  ('therapist-003', 'Emily Davis', 'team-002', '["BCBA", "Clinical Fellow"]', '["SLP"]'),
  ('therapist-004', 'James Wilson', 'team-002', '["RBT", "MD_MEDICAID"]', '[]'),
  ('therapist-005', 'Lisa Martinez', 'team-003', '["BCBA"]', '["OT", "SLP"]'),
  ('therapist-006', 'Robert Taylor', 'team-003', '["RBT"]', '[]')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  team_id = EXCLUDED.team_id,
  qualifications = EXCLUDED.qualifications,
  can_provide_allied_health = EXCLUDED.can_provide_allied_health;

-- Insert sample clients
INSERT INTO clients (id, name, team_id, insurance_requirements, allied_health_needs) VALUES
  ('client-001', 'Alex Thompson', 'team-001', '["RBT"]', '[{"type": "OT", "frequencyPerWeek": 2, "durationMinutes": 30}]'),
  ('client-002', 'Emma Rodriguez', 'team-001', '["BCBA"]', '[]'),
  ('client-003', 'Noah Williams', 'team-002', '["RBT", "MD_MEDICAID"]', '[{"type": "SLP", "frequencyPerWeek": 1, "durationMinutes": 45}]'),
  ('client-004', 'Olivia Brown', 'team-002', '["RBT"]', '[]'),
  ('client-005', 'Sophia Garcia', 'team-003', '["BCBA"]', '[{"type": "OT", "frequencyPerWeek": 1, "durationMinutes": 30}]'),
  ('client-006', 'Liam Anderson', 'team-003', '["RBT"]', '[]')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  team_id = EXCLUDED.team_id,
  insurance_requirements = EXCLUDED.insurance_requirements,
  allied_health_needs = EXCLUDED.allied_health_needs;
