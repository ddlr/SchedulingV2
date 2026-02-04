/*
  # Allow Users to Insert Their Own Data

  ## Problem
  When an admin creates a new user via signUp(), Supabase automatically signs in
  as that new user temporarily. The new user then needs permission to insert their
  own record into the users table.

  ## Solution
  Add a policy that allows authenticated users to insert their own record if the
  email matches their JWT email. This works alongside the admin insert policy.

  ## Changes
  1. Add policy "Users can insert own data"
     - Allows authenticated users to insert a record with their own email
     - Uses WITH CHECK to verify email matches JWT
     - Works during the brief moment after signUp() when the new user is signed in

  ## Security Notes
  - Users can only insert records that match their own email
  - Cannot insert records for other users
  - Admin policy still allows admins to insert any user
  - Both policies work together (OR logic)
*/

-- Add policy allowing users to insert their own data
CREATE POLICY "Users can insert own data"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.jwt() ->> 'email' = email);
