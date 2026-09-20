-- =====================================================================
-- Create a new staff login (administrator / manager / cashier).
--
-- Run this in the Supabase Dashboard → SQL Editor for your project.
-- It creates the auth account directly (with a securely hashed password)
-- and sets the role via app_metadata — the ONLY place `handle_new_user()`
-- trusts a role from, because app_metadata can never be set by the person
-- signing up themselves (unlike user_metadata, which the public signUp()
-- API can set). This is why the plain Dashboard "Add user" form isn't used
-- for this: its "User Metadata" field writes user_metadata, not
-- app_metadata, so it can't set a trusted role.
--
-- Edit the three values below, then run the whole script.
-- =====================================================================
do $$
declare
  v_email text := 'newstaff@arh.mv';       -- change me
  v_password text := 'Change-Me-1234';      -- change me (min 8 chars)
  v_full_name text := 'New Staff Name';     -- change me
  v_role text := 'cashier';                 -- 'administrator' | 'manager' | 'cashier'
  new_user_id uuid := gen_random_uuid();
  existing_id uuid;
begin
  select id into existing_id from auth.users where email = v_email;
  if existing_id is not null then
    raise exception 'A user with email % already exists (id %)', v_email, existing_id;
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, recovery_token,
    email_change_token_new, email_change, is_super_admin, is_sso_user, is_anonymous
  ) values (
    '00000000-0000-0000-0000-000000000000',
    new_user_id,
    'authenticated',
    'authenticated',
    v_email,
    crypt(v_password, gen_salt('bf')),
    now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'role', v_role),
    jsonb_build_object('full_name', v_full_name),
    now(), now(), '', '', '', '', false, false, false
  );

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), new_user_id, new_user_id::text,
    jsonb_build_object('sub', new_user_id::text, 'email', v_email, 'email_verified', true),
    'email', now(), now(), now()
  );

  raise notice 'Created % (%) with role %', v_email, new_user_id, v_role;
end $$;

-- Verify:
-- select p.full_name, p.email, p.role, p.active from public.profiles p where p.email = 'newstaff@arh.mv';
