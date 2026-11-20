-- =====================================================================
-- 03_make_super_admin.sql — run ONCE after you sign up in the app yourself.
-- Replace the email with yours. This is the only way to become super admin.
-- =====================================================================
select set_config('app.bypass', 'on', false);
update public.profiles set is_super_admin = true where email = lower('your-email@example.com');
select email, is_super_admin from public.profiles where is_super_admin;
