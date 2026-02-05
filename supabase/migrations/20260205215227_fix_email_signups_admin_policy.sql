/*
  # Fix email_signups Admin Policy

  ## Problem
  The existing "Admins can view all signups" policy on email_signups uses
  `users.id = auth.uid()` to check if the user is an admin. However, the
  users table's `id` column is an auto-generated UUID (gen_random_uuid()),
  NOT the auth user's UUID. This means the policy condition never matches
  and admins cannot view signups.

  ## Fix
  Replace the broken policy with one that uses the `get_user_role()` function
  which checks by email (the correct approach used by all other tables).

  ## Changes
  1. Drop broken "Admins can view all signups" policy
  2. Create new policy using `get_user_role(auth.jwt() ->> 'email')` check
*/

DROP POLICY IF EXISTS "Admins can view all signups" ON email_signups;

CREATE POLICY "Admins can view all signups"
  ON email_signups
  FOR SELECT
  TO authenticated
  USING (get_user_role(auth.jwt() ->> 'email') = 'admin');