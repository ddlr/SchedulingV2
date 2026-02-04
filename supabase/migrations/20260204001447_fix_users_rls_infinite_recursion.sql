/*
  # Fix Infinite Recursion in Users Table RLS Policies

  ## Problem
  The RLS policies on the users table were causing infinite recursion because they query 
  the users table to check if a user is an admin, which triggers the same policy check again.

  ## Solution
  Create a security definer function that bypasses RLS to safely check user roles.
  This breaks the circular dependency by allowing the function to access the table 
  without triggering RLS policies.

  ## Changes
  1. Create `get_user_role()` function with SECURITY DEFINER
     - Takes user email from JWT
     - Returns the user's role without triggering RLS
     - Returns NULL if user not found or inactive
  
  2. Drop and recreate users table policies
     - Replace recursive EXISTS subqueries with calls to helper function
     - Maintain same security model (users see own data, admins see all)
  
  3. Update demo_requests table policies
     - Use helper function instead of recursive subqueries
     - Maintain admin-only access for viewing/updating

  ## Security Notes
  - SECURITY DEFINER functions execute with the privileges of the owner
  - Function is marked STABLE to allow query optimization
  - Function only returns role info, not sensitive data
  - All policies still enforce proper access control
*/

-- Create security definer function to get user role without triggering RLS
CREATE OR REPLACE FUNCTION get_user_role(user_email text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role
  FROM users
  WHERE email = user_email
    AND is_active = true;
  
  RETURN user_role;
END;
$$;

-- Drop existing problematic policies on users table
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Admins can read all users" ON users;
DROP POLICY IF EXISTS "Admins can insert users" ON users;
DROP POLICY IF EXISTS "Admins can update users" ON users;

-- Recreate users table policies using the helper function

-- Policy: Users can read their own data
CREATE POLICY "Users can read own data"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.jwt() ->> 'email' = email);

-- Policy: Admins can read all users
CREATE POLICY "Admins can read all users"
  ON users
  FOR SELECT
  TO authenticated
  USING (get_user_role(auth.jwt() ->> 'email') = 'admin');

-- Policy: Admins can insert new users
CREATE POLICY "Admins can insert users"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (get_user_role(auth.jwt() ->> 'email') = 'admin');

-- Policy: Admins can update users
CREATE POLICY "Admins can update users"
  ON users
  FOR UPDATE
  TO authenticated
  USING (get_user_role(auth.jwt() ->> 'email') = 'admin')
  WITH CHECK (get_user_role(auth.jwt() ->> 'email') = 'admin');

-- Drop and recreate demo_requests policies to use helper function
DROP POLICY IF EXISTS "Admins can read all demo requests" ON demo_requests;
DROP POLICY IF EXISTS "Admins can update demo requests" ON demo_requests;

-- Policy: Admins can read all demo requests
CREATE POLICY "Admins can read all demo requests"
  ON demo_requests
  FOR SELECT
  TO authenticated
  USING (get_user_role(auth.jwt() ->> 'email') = 'admin');

-- Policy: Admins can update demo requests
CREATE POLICY "Admins can update demo requests"
  ON demo_requests
  FOR UPDATE
  TO authenticated
  USING (get_user_role(auth.jwt() ->> 'email') = 'admin')
  WITH CHECK (get_user_role(auth.jwt() ->> 'email') = 'admin');
