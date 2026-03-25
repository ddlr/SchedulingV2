-- Update super admin email from team@ordusaba.com to superadmin@ordusaba.com
UPDATE users
SET email = 'superadmin@ordusaba.com'
WHERE email = 'team@ordusaba.com' AND role = 'super_admin';
