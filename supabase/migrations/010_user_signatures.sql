-- Each user's e-signature (PNG data URL), visible only to that user. Used on exported report PDFs.
create table if not exists public.user_signatures (
  user_id uuid primary key references auth.users(id) on delete cascade,
  image_data text not null check (length(image_data) < 400000 and image_data like 'data:image/%'),
  updated_at timestamptz not null default now()
);
alter table public.user_signatures enable row level security;
create policy user_signatures_select_own on public.user_signatures for select to authenticated using (user_id = (select auth.uid()));
create policy user_signatures_insert_own on public.user_signatures for insert to authenticated with check (user_id = (select auth.uid()));
create policy user_signatures_update_own on public.user_signatures for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy user_signatures_delete_own on public.user_signatures for delete to authenticated using (user_id = (select auth.uid()));
