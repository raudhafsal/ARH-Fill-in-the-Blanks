-- =====================================================================
-- SECURITY FIX: handle_new_user() originally read the new profile's role
-- from raw_user_meta_data. That field can be set by an UNAUTHENTICATED
-- caller through the public, anon-key signUp() API (via options.data), so
-- anyone could have self-registered with role: "administrator".
--
-- raw_app_meta_data can only be set by an admin — via the Supabase Admin
-- API (auth.admin.createUser / updateUserById, which require the
-- service-role key) or directly in SQL — never by the person signing up.
-- Read role from there instead. See supabase/create_staff_user.sql for the
-- SQL snippet used to create staff accounts under this corrected model.
-- =====================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    coalesce((new.raw_app_meta_data->>'role')::user_role, 'cashier')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
