-- Units of measurement per product (e.g. "Case" = 100 pcs, base unit stays products.unit)
create table public.product_units (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null,
  scale numeric not null default 1 check (scale > 0),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  constraint product_units_name_unique unique (product_id, name)
);

create index product_units_product_id_idx on public.product_units(product_id);

alter table public.product_units enable row level security;
create policy "product_units_select" on public.product_units for select to authenticated using (true);
create policy "product_units_write" on public.product_units for insert to authenticated with check (public.is_manager_or_admin());
create policy "product_units_update" on public.product_units for update to authenticated using (public.is_manager_or_admin());
create policy "product_units_delete" on public.product_units for delete to authenticated using (public.is_manager_or_admin());

-- Variant groups (e.g. "Jugo Juice" grouping "With Jelly" / "Without Jelly")
create table public.product_variant_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category_id uuid references public.categories(id) on delete set null,
  image_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.product_variant_groups enable row level security;
create policy "variant_groups_select" on public.product_variant_groups for select to authenticated using (true);
create policy "variant_groups_write" on public.product_variant_groups for insert to authenticated with check (public.is_manager_or_admin());
create policy "variant_groups_update" on public.product_variant_groups for update to authenticated using (public.is_manager_or_admin());
create policy "variant_groups_delete" on public.product_variant_groups for delete to authenticated using (public.is_admin());

alter table public.products
  add column variant_group_id uuid references public.product_variant_groups(id) on delete set null,
  add column variant_name text;

create index products_variant_group_id_idx on public.products(variant_group_id);

-- Purchase line unit-of-measure trail (purchase_items.quantity stays in the product's BASE unit
-- so the existing receive_purchase() function needs no changes; these columns just record what
-- was actually typed, e.g. "2 Case" -> quantity is auto-converted to 200 pcs before saving).
alter table public.purchase_items
  add column unit_name text,
  add column unit_scale numeric not null default 1 check (unit_scale > 0),
  add column entered_quantity numeric;
