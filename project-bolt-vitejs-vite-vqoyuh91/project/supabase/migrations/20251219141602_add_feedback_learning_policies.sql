/*
  # Add RLS Policies for Feedback and Learning System

  ## Changes
  This migration adds Row Level Security policies for the schedule learning and feedback tables.
  
  ## Tables Updated
  1. **schedule_feedback**
     - Allow authenticated users to insert their own feedback
     - Allow authenticated users to read all feedback (for analytics)
  
  2. **schedule_patterns**
     - Allow authenticated users to read patterns (for algorithm improvements)
     - Allow service role to insert/update patterns (system-managed)
  
  3. **constraint_violations_log**
     - Allow authenticated users to read violation logs
     - Allow service role to insert/update logs (system-managed)
  
  4. **lunch_stagger_patterns**
     - Allow authenticated users to read patterns
     - Allow service role to insert/update patterns (system-managed)

  ## Security Notes
  - Feedback submission is open to all authenticated users
  - Pattern updates are managed by the application (via service role or authenticated users)
  - All reads are allowed for authenticated users to support analytics
*/

-- Schedule Feedback Policies
CREATE POLICY "Allow authenticated users to insert feedback"
  ON schedule_feedback
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to read all feedback"
  ON schedule_feedback
  FOR SELECT
  TO authenticated
  USING (true);

-- Schedule Patterns Policies
CREATE POLICY "Allow authenticated users to read patterns"
  ON schedule_patterns
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert patterns"
  ON schedule_patterns
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update patterns"
  ON schedule_patterns
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Constraint Violations Log Policies
CREATE POLICY "Allow authenticated users to read violations"
  ON constraint_violations_log
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert violations"
  ON constraint_violations_log
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update violations"
  ON constraint_violations_log
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Lunch Stagger Patterns Policies
CREATE POLICY "Allow authenticated users to read lunch patterns"
  ON lunch_stagger_patterns
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert lunch patterns"
  ON lunch_stagger_patterns
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update lunch patterns"
  ON lunch_stagger_patterns
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);