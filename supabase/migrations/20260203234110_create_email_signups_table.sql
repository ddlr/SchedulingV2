/*
  # Create email signups table

  1. New Tables
    - `email_signups`
      - `id` (uuid, primary key) - Unique identifier for each signup
      - `email` (text, unique, not null) - Email address of the signup
      - `signup_source` (text) - Source of signup (e.g., 'landing_page', 'hero_section')
      - `subscribed` (boolean, default true) - Whether user is subscribed
      - `created_at` (timestamp) - When the signup was created
      - `updated_at` (timestamp) - When the record was last updated

  2. Security
    - Enable RLS on `email_signups` table
    - Add policy for anonymous users to insert their email
    - Add policy for authenticated admin users to read all signups
*/

CREATE TABLE IF NOT EXISTS email_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  signup_source text DEFAULT 'landing_page',
  subscribed boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE email_signups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can signup with email"
  ON email_signups
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Admins can view all signups"
  ON email_signups
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );