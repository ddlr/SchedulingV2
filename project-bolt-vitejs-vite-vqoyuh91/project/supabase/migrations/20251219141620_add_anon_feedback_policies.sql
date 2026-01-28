/*
  # Add Anonymous Access for Feedback System

  ## Changes
  Add policies to allow anonymous (unauthenticated) users to submit feedback and read patterns.
  This is necessary because the application uses the anon key for database access.

  ## Security Note
  - Anonymous feedback submission is intentionally allowed to support the learning system
  - Rate limiting should be implemented at the application level if needed
  - Pattern reads are allowed to support algorithm improvements
*/

-- Schedule Feedback - Allow anon users to submit feedback
CREATE POLICY "Allow anonymous users to insert feedback"
  ON schedule_feedback
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anonymous users to read feedback"
  ON schedule_feedback
  FOR SELECT
  TO anon
  USING (true);

-- Schedule Patterns - Allow anon users to read and update patterns
CREATE POLICY "Allow anonymous users to read patterns"
  ON schedule_patterns
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anonymous users to insert patterns"
  ON schedule_patterns
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anonymous users to update patterns"
  ON schedule_patterns
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Constraint Violations Log - Allow anon users to read and write
CREATE POLICY "Allow anonymous users to read violations"
  ON constraint_violations_log
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anonymous users to insert violations"
  ON constraint_violations_log
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anonymous users to update violations"
  ON constraint_violations_log
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Lunch Stagger Patterns - Allow anon users to read and write
CREATE POLICY "Allow anonymous users to read lunch patterns"
  ON lunch_stagger_patterns
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anonymous users to insert lunch patterns"
  ON lunch_stagger_patterns
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anonymous users to update lunch patterns"
  ON lunch_stagger_patterns
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);