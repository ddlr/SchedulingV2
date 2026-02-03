# Fiddler Scheduler Authentication Setup Guide

## Overview

Fiddler Scheduler now includes a complete authentication and authorization system with:
- Landing page with demo request functionality
- Secure login system
- Role-based access control (Admin, Staff, Viewer)
- User management for administrators

## Getting Started

### 1. Database Setup

All necessary database tables have been created through migrations:
- `users` - User accounts with roles
- `demo_requests` - Demo request submissions

### 2. Create Your First Admin User

To access the system, you need to create an initial admin user:

#### Step 1: Create Auth User in Supabase

1. Go to your Supabase Dashboard
2. Navigate to **Authentication > Users**
3. Click **Add user**
4. Enter:
   - Email: `admin@fiddlerscheduler.com` (or your preferred email)
   - Password: Choose a secure password
   - Auto-confirm user: Yes

#### Step 2: Verify User Profile

The migration has already created a user profile for `admin@fiddlerscheduler.com`. If you used a different email, you can either:

**Option A: Update the existing profile**
```sql
UPDATE users
SET email = 'your-email@example.com'
WHERE email = 'admin@fiddlerscheduler.com';
```

**Option B: Create a new profile**
```sql
INSERT INTO users (email, full_name, role, is_active)
VALUES ('your-email@example.com', 'Your Name', 'admin', true);
```

### 3. Access the System

1. Open your application in the browser
2. You'll see the landing page
3. Click **Login** in the top right
4. Enter your admin credentials
5. You'll be redirected to the scheduler application

## User Roles

### Admin
- Full system access
- Can create, edit, and deactivate users
- Can view and manage demo requests
- Can access all admin tools and bulk operations
- Can modify system settings

### Staff
- Can manage clients and therapists
- Can generate and optimize schedules
- Can manage callouts and base schedules
- Cannot access admin settings or user management
- Cannot perform bulk operations

### Viewer
- Read-only access to all data
- Can view schedules, clients, and therapists
- Cannot add, edit, or delete any data
- Cannot generate new schedules
- Useful for supervisors or observers

## Creating Additional Users

Once logged in as an admin:

1. Navigate to the **Admin** tab
2. Find the **User Management** section
3. Click **Create User**
4. Fill in:
   - Email address
   - Password (min 6 characters)
   - Full name
   - Role (Admin, Staff, or Viewer)
5. Click **Create**

The system will:
- Create the Supabase Auth user
- Create the user profile with the selected role
- Send a confirmation email (if configured)

## Managing Demo Requests

Admins can view and manage demo requests:

1. Go to the **Admin** tab
2. Scroll to **Demo Requests** section
3. You can:
   - View all submitted requests
   - Mark as "Contacted", "Approved", or "Rejected"
   - See submission timestamps
   - View contact information and messages

## Landing Page Features

The public landing page includes:
- Hero section with product overview
- Feature highlights
- Request Demo modal (accessible to unauthenticated visitors)
- Login link for existing users

Visitors can submit demo requests without logging in. These requests are stored in the database and visible to admins.

## Security Features

- Passwords are securely hashed and never stored in plain text
- Row Level Security (RLS) enforces access control at the database level
- Session management with automatic expiration
- Role-based UI hiding (viewers can't see edit buttons, staff can't access admin panel)
- Protected API routes that validate user permissions

## Troubleshooting

### "User profile not found" error
- Ensure the email in the `users` table matches the Supabase Auth email exactly
- Check that the user is marked as `is_active = true`

### "Account is inactive" error
- The user account has been deactivated by an admin
- Contact your system administrator to reactivate

### Can't access Admin tab
- Only users with role = 'admin' can access this tab
- Verify your role in the database or contact an admin

### Login page shows after logout
- This is normal behavior - clicking logout returns you to the landing page
- You can log back in anytime using the Login button

## Email Addresses

For development and testing, you can use these example emails:
- Admin: admin@fiddlerscheduler.com
- Staff: staff@fiddlerscheduler.com
- Viewer: viewer@fiddlerscheduler.com

Remember to create corresponding Supabase Auth users for each email you want to use.
