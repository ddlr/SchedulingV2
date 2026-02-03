/*
  # Create Initial Admin User

  ## Overview
  This migration creates an initial admin user account for accessing the Fiddler Scheduler system.
  This user will have full administrative privileges to manage the system, create other users,
  and handle demo requests.

  ## Important Notes
  1. This migration creates a user entry in the users table
  2. The corresponding Supabase Auth user must be created separately via Supabase Dashboard
     or through the user management interface after logging in with another admin account
  3. Default credentials:
     - Email: admin@fiddlerscheduler.com
     - Password: Must be set through Supabase Auth
  4. For security, change this email and create a proper auth user in production

  ## Steps to activate this user:
  1. Run this migration to create the user profile
  2. Go to Supabase Dashboard > Authentication > Users
  3. Click "Add user" and create a user with email: admin@fiddlerscheduler.com
  4. Set a secure password
  5. The user will now be able to log in to Fiddler Scheduler
*/

-- Insert initial admin user profile
-- Note: The corresponding auth.users entry must be created via Supabase Dashboard
INSERT INTO users (email, full_name, role, is_active)
VALUES ('admin@fiddlerscheduler.com', 'System Administrator', 'admin', true)
ON CONFLICT (email) DO NOTHING;
