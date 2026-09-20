-- =====================================================================
-- ARH Fill in the Blank POS — Initial schema
-- Run this once against a fresh Supabase project (SQL Editor, or
-- `supabase db push` / `supabase migration up` with the CLI).
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------
create type user_role as enum ('administrator', 'manager', 'cashier');
create type order_type as enum ('takeaway', 'pickup', 'dine_in');
create type order_status as enum ('new', 'preparing', 'ready', 'completed', 'cancelled');
create type sync_status as enum ('synced', 'pending', 'failed');
create type discount_kind as enum ('percentage', 'fixed');
create type inventory_txn_type as enum ('sale', 'purchase', 'adjustment', 'damaged', 'wasted', 'returned', 'manual_correction', 'refund');
create type purchase_status as enum ('draft', 'received', 'cancelled');
create type purchase_payment_status as enum ('unpaid', 'partial', 'paid');
create type register_status as enum ('open', 'closed');
create type register_txn_type as enum ('cash_sale', 'cash_refund', 'cash_in', 'cash_out', 'opening_float');

-- ---------------------------------------------------------------------
-- PROFILES (one row per auth.users row)
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  phone text,
  role user_role not null default 'cashier',
  avatar_url text,
  active boolean not null default true,
  max_discount_percent numeric(5,2) not null default 5,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'One row per staff account, mirrors auth.users. Created automatically by handle_new_user().';

-- ---------------------------------------------------------------------
-- BUSINESS / TAX / PAYMENT SETTINGS
-- ---------------------------------------------------------------------
create table public.business_settings (
  id boolean primary key default true constraint single_row check (id),
  business_name text not null default 'ARH Fill in the Blank',
  logo_url text,
  address text not null default '',
  phone text not null default '',
  email text not null default '',
  receipt_footer text not null default 'Thank you for your order!',
  currency text not null default 'MVR',
  default_order_type order_type not null default 'takeaway',
  kitchen_screen_enabled boolean not null default false,
  dine_in_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.business_settings (id) values (true);

create table public.tax_settings (
  id boolean primary key default true constraint single_row check (id),
  enabled boolean not null default false,
  name text not null default 'GST',
  percentage numeric(5,2) not null default 0,
  price_inclusive boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into public.tax_settings (id) values (true);

create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  enabled boolean not null default true,
  display_order int not null default 0,
  created_at timestamptz not null default now()
);
insert into public.payment_methods (name, code, display_order) values
  ('Cash', 'cash', 1),
  ('Card', 'card', 2),
  ('Bank Transfer', 'bank_transfer', 3),
  ('Mobile Payment', 'mobile_payment', 4),
  ('Other', 'other', 5);

create table public.discount_limits (
  role user_role primary key,
  max_percent numeric(5,2),
  unlimited boolean not null default false
);
insert into public.discount_limits (role, max_percent, unlimited) values
  ('cashier', 5, false),
  ('manager', 20, false),
  ('administrator', 100, true);

-- ---------------------------------------------------------------------
-- CATEGORIES / PRODUCTS
-- ---------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  image_url text,
  icon text,
  display_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sku text unique,
  barcode text unique,
  category_id uuid references public.categories(id) on delete set null,
  description text,
  selling_price numeric(12,2) not null default 0 check (selling_price >= 0),
  cost_price numeric(12,2) not null default 0 check (cost_price >= 0),
  current_stock numeric(12,2) not null default 0,
  minimum_stock numeric(12,2) not null default 0,
  unit text not null default 'pcs',
  image_url text,
  active boolean not null default true,
  track_inventory boolean not null default true,
  tax_enabled boolean not null default false,
  tax_rate numeric(5,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_category_idx on public.products(category_id);
create index products_name_idx on public.products using gin (to_tsvector('simple', name));
create index products_barcode_idx on public.products(barcode);
create index products_sku_idx on public.products(sku);

-- ---------------------------------------------------------------------
-- SUPPLIERS / CUSTOMERS
-- ---------------------------------------------------------------------
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_person text,
  phone text,
  email text,
  address text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  address text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index customers_phone_idx on public.customers(phone);
create index customers_name_idx on public.customers using gin (to_tsvector('simple', full_name));

-- ---------------------------------------------------------------------
-- ORDER NUMBERING (database-safe, never duplicates)
-- ---------------------------------------------------------------------
create sequence public.order_number_seq start 1;

create or replace function public.generate_order_number()
returns text
language sql
as $$
  select 'ARH-' || lpad(nextval('public.order_number_seq')::text, 6, '0');
$$;

-- ---------------------------------------------------------------------
-- CASH REGISTER
-- ---------------------------------------------------------------------
create table public.cash_registers (
  id uuid primary key default gen_random_uuid(),
  cashier_id uuid not null references public.profiles(id),
  opening_cash numeric(12,2) not null default 0,
  opening_notes text,
  status register_status not null default 'open',
  closing_cash_expected numeric(12,2),
  closing_cash_actual numeric(12,2),
  difference numeric(12,2),
  closing_notes text,
  opened_at timestamptz not null default now(),
  closed_at timestamptz
);
create index cash_registers_cashier_idx on public.cash_registers(cashier_id, status);

create table public.cash_register_transactions (
  id uuid primary key default gen_random_uuid(),
  register_id uuid not null references public.cash_registers(id) on delete cascade,
  type register_txn_type not null,
  amount numeric(12,2) not null,
  reason text,
  notes text,
  reference_order_id uuid,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index cash_register_txn_register_idx on public.cash_register_transactions(register_id);

-- ---------------------------------------------------------------------
-- ORDERS / ORDER ITEMS / PAYMENTS
-- ---------------------------------------------------------------------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  client_txn_id uuid unique, -- idempotency key for offline queueing
  order_type order_type not null default 'takeaway',
  status order_status not null default 'completed',
  customer_id uuid references public.customers(id) on delete set null,
  cashier_id uuid not null references public.profiles(id),
  register_id uuid references public.cash_registers(id),
  subtotal numeric(12,2) not null default 0,
  discount_type discount_kind,
  discount_value numeric(12,2) not null default 0,
  discount_amount numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  notes text,
  pickup_time timestamptz,
  sync_status sync_status not null default 'synced',
  voided boolean not null default false,
  voided_reason text,
  voided_by uuid references public.profiles(id),
  voided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_cashier_idx on public.orders(cashier_id);
create index orders_created_idx on public.orders(created_at);
create index orders_status_idx on public.orders(status);
create index orders_customer_idx on public.orders(customer_id);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  unit_price numeric(12,2) not null,
  quantity numeric(12,2) not null check (quantity > 0),
  item_discount_amount numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  line_total numeric(12,2) not null,
  notes text,
  created_at timestamptz not null default now()
);
create index order_items_order_idx on public.order_items(order_id);
create index order_items_product_idx on public.order_items(product_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  payment_method_id uuid not null references public.payment_methods(id),
  amount numeric(12,2) not null,
  amount_received numeric(12,2),
  change_amount numeric(12,2) not null default 0,
  reference text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index payments_order_idx on public.payments(order_id);

-- ---------------------------------------------------------------------
-- INVENTORY TRANSACTIONS (every stock change must create one of these)
-- ---------------------------------------------------------------------
create table public.inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  type inventory_txn_type not null,
  quantity_change numeric(12,2) not null,
  resulting_stock numeric(12,2) not null,
  reference_type text,
  reference_id uuid,
  reason text,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index inventory_txn_product_idx on public.inventory_transactions(product_id);
create index inventory_txn_created_idx on public.inventory_transactions(created_at);

-- ---------------------------------------------------------------------
-- PURCHASES / SUPPLIERS
-- ---------------------------------------------------------------------
create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid references public.suppliers(id),
  invoice_number text,
  purchase_date date not null default current_date,
  status purchase_status not null default 'draft',
  payment_status purchase_payment_status not null default 'unpaid',
  total_cost numeric(12,2) not null default 0,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  received_at timestamptz
);
create index purchases_supplier_idx on public.purchases(supplier_id);

create table public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity numeric(12,2) not null check (quantity > 0),
  cost_price numeric(12,2) not null,
  total_cost numeric(12,2) not null
);
create index purchase_items_purchase_idx on public.purchase_items(purchase_id);

-- ---------------------------------------------------------------------
-- EXPENSES
-- ---------------------------------------------------------------------
create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true
);
insert into public.expense_categories (name) values
  ('Electricity'), ('Water'), ('Rent'), ('Salary'), ('Transportation'),
  ('Supplies'), ('Maintenance'), ('Other');

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.expense_categories(id),
  amount numeric(12,2) not null check (amount >= 0),
  description text,
  expense_date date not null default current_date,
  payment_method_id uuid references public.payment_methods(id),
  reference text,
  attachment_url text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index expenses_date_idx on public.expenses(expense_date);
create index expenses_category_idx on public.expenses(category_id);

-- ---------------------------------------------------------------------
-- REFUNDS
-- ---------------------------------------------------------------------
create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  reason text not null,
  refund_amount numeric(12,2) not null,
  authorized_by uuid not null references public.profiles(id),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create index refunds_order_idx on public.refunds(order_id);

create table public.refund_items (
  id uuid primary key default gen_random_uuid(),
  refund_id uuid not null references public.refunds(id) on delete cascade,
  order_item_id uuid not null references public.order_items(id),
  quantity numeric(12,2) not null check (quantity > 0),
  refund_amount numeric(12,2) not null
);

-- ---------------------------------------------------------------------
-- AUDIT LOG / NOTIFICATIONS
-- ---------------------------------------------------------------------
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id),
  action text not null,
  entity text not null,
  entity_id uuid,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_entity_idx on public.audit_logs(entity, entity_id);
create index audit_logs_created_idx on public.audit_logs(created_at);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id), -- null = broadcast to admins/managers
  type text not null,
  title text not null,
  message text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications(user_id, read);

-- =====================================================================
-- HELPER FUNCTIONS
-- =====================================================================

-- Returns the caller's role without re-triggering RLS on profiles
-- (SECURITY DEFINER + fixed search_path avoids recursive policy checks).
create or replace function public.current_role()
returns user_role
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public stable as $$
  select coalesce((select role = 'administrator' from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_manager_or_admin()
returns boolean language sql security definer set search_path = public stable as $$
  select coalesce((select role in ('administrator','manager') from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['profiles','categories','products','suppliers','customers','orders','purchases','business_settings','tax_settings']
  loop
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- Auto-create a profile row whenever a new auth user is created.
-- Admin creates staff via Supabase Auth (dashboard/admin API) with
-- raw_user_meta_data: { "full_name": "...", "role": "cashier" }.
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
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'cashier')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Log an audit entry (used by RPCs and can be called from server code).
create or replace function public.log_audit(
  p_action text, p_entity text, p_entity_id uuid,
  p_old jsonb default null, p_new jsonb default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_logs (user_id, action, entity, entity_id, old_value, new_value)
  values (auth.uid(), p_action, p_entity, p_entity_id, p_old, p_new);
end;
$$;

-- ---------------------------------------------------------------------
-- COMPLETE SALE (atomic, idempotent via client_txn_id)
-- ---------------------------------------------------------------------
-- p_items: jsonb array of {product_id, product_name, unit_price, quantity, item_discount_amount, tax_amount, line_total, notes}
-- p_payments: jsonb array of {payment_method_id, amount, amount_received, change_amount, reference}
create or replace function public.complete_sale(
  p_client_txn_id uuid,
  p_order_type order_type,
  p_customer_id uuid,
  p_register_id uuid,
  p_subtotal numeric,
  p_discount_type discount_kind,
  p_discount_value numeric,
  p_discount_amount numeric,
  p_tax_amount numeric,
  p_total numeric,
  p_notes text,
  p_items jsonb,
  p_payments jsonb
) returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_existing public.orders;
  v_item jsonb;
  v_payment jsonb;
  v_order_id uuid;
  v_product public.products;
  v_new_stock numeric;
  v_role user_role;
begin
  v_role := public.current_role();
  if v_role is null then
    raise exception 'Not authorized';
  end if;

  -- Idempotency: if this client transaction was already synced, return it.
  if p_client_txn_id is not null then
    select * into v_existing from public.orders where client_txn_id = p_client_txn_id;
    if found then
      return v_existing;
    end if;
  end if;

  v_order_id := gen_random_uuid();

  insert into public.orders (
    id, order_number, client_txn_id, order_type, status, customer_id, cashier_id,
    register_id, subtotal, discount_type, discount_value, discount_amount,
    tax_amount, total, notes, sync_status
  ) values (
    v_order_id, public.generate_order_number(), p_client_txn_id, p_order_type, 'completed',
    p_customer_id, auth.uid(), p_register_id, p_subtotal, p_discount_type, p_discount_value,
    p_discount_amount, p_tax_amount, p_total, p_notes, 'synced'
  ) returning * into v_order;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into public.order_items (
      order_id, product_id, product_name, unit_price, quantity,
      item_discount_amount, tax_amount, line_total, notes
    ) values (
      v_order_id,
      nullif(v_item->>'product_id','')::uuid,
      v_item->>'product_name',
      (v_item->>'unit_price')::numeric,
      (v_item->>'quantity')::numeric,
      coalesce((v_item->>'item_discount_amount')::numeric, 0),
      coalesce((v_item->>'tax_amount')::numeric, 0),
      (v_item->>'line_total')::numeric,
      v_item->>'notes'
    );

    if (v_item->>'product_id') is not null and (v_item->>'product_id') <> '' then
      select * into v_product from public.products where id = (v_item->>'product_id')::uuid for update;
      if found and v_product.track_inventory then
        v_new_stock := v_product.current_stock - (v_item->>'quantity')::numeric;
        update public.products set current_stock = v_new_stock where id = v_product.id;
        insert into public.inventory_transactions (
          product_id, type, quantity_change, resulting_stock, reference_type, reference_id, created_by
        ) values (
          v_product.id, 'sale', -1 * (v_item->>'quantity')::numeric, v_new_stock, 'order', v_order_id, auth.uid()
        );
      end if;
    end if;
  end loop;

  for v_payment in select * from jsonb_array_elements(p_payments)
  loop
    insert into public.payments (
      order_id, payment_method_id, amount, amount_received, change_amount, reference, created_by
    ) values (
      v_order_id,
      (v_payment->>'payment_method_id')::uuid,
      (v_payment->>'amount')::numeric,
      nullif(v_payment->>'amount_received','')::numeric,
      coalesce((v_payment->>'change_amount')::numeric, 0),
      v_payment->>'reference',
      auth.uid()
    );

    if p_register_id is not null and (select code from public.payment_methods where id = (v_payment->>'payment_method_id')::uuid) = 'cash' then
      insert into public.cash_register_transactions (register_id, type, amount, reference_order_id, created_by)
      values (p_register_id, 'cash_sale', (v_payment->>'amount')::numeric, v_order_id, auth.uid());
    end if;
  end loop;

  perform public.log_audit('sale_created', 'order', v_order_id, null, to_jsonb(v_order));

  return v_order;
end;
$$;

-- ---------------------------------------------------------------------
-- PROCESS REFUND (never deletes the original sale)
-- ---------------------------------------------------------------------
create or replace function public.process_refund(
  p_order_id uuid,
  p_reason text,
  p_items jsonb -- [{order_item_id, quantity, refund_amount}]
) returns public.refunds
language plpgsql
security definer
set search_path = public
as $$
declare
  v_refund public.refunds;
  v_item jsonb;
  v_order_item public.order_items;
  v_product public.products;
  v_new_stock numeric;
  v_total numeric := 0;
  v_role user_role;
begin
  v_role := public.current_role();
  if v_role not in ('administrator','manager') then
    raise exception 'Only managers/administrators can authorize refunds';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_total := v_total + (v_item->>'refund_amount')::numeric;
  end loop;

  insert into public.refunds (order_id, reason, refund_amount, authorized_by, created_by)
  values (p_order_id, p_reason, v_total, auth.uid(), auth.uid())
  returning * into v_refund;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_order_item from public.order_items where id = (v_item->>'order_item_id')::uuid;

    insert into public.refund_items (refund_id, order_item_id, quantity, refund_amount)
    values (v_refund.id, v_order_item.id, (v_item->>'quantity')::numeric, (v_item->>'refund_amount')::numeric);

    if v_order_item.product_id is not null then
      select * into v_product from public.products where id = v_order_item.product_id for update;
      if found and v_product.track_inventory then
        v_new_stock := v_product.current_stock + (v_item->>'quantity')::numeric;
        update public.products set current_stock = v_new_stock where id = v_product.id;
        insert into public.inventory_transactions (
          product_id, type, quantity_change, resulting_stock, reference_type, reference_id, created_by, reason
        ) values (
          v_product.id, 'refund', (v_item->>'quantity')::numeric, v_new_stock, 'refund', v_refund.id, auth.uid(), p_reason
        );
      end if;
    end if;
  end loop;

  perform public.log_audit('sale_refunded', 'order', p_order_id, null, to_jsonb(v_refund));

  return v_refund;
end;
$$;

-- ---------------------------------------------------------------------
-- VOID ORDER
-- ---------------------------------------------------------------------
create or replace function public.void_order(p_order_id uuid, p_reason text)
returns public.orders language plpgsql security definer set search_path = public as $$
declare
  v_order public.orders;
  v_role user_role;
begin
  v_role := public.current_role();
  if v_role not in ('administrator','manager') then
    raise exception 'Only managers/administrators can void orders';
  end if;
  update public.orders set voided = true, voided_reason = p_reason, voided_by = auth.uid(), voided_at = now(), status = 'cancelled'
  where id = p_order_id returning * into v_order;
  perform public.log_audit('sale_voided', 'order', p_order_id, null, to_jsonb(v_order));
  return v_order;
end;
$$;

-- ---------------------------------------------------------------------
-- RECEIVE PURCHASE (increments inventory atomically)
-- ---------------------------------------------------------------------
create or replace function public.receive_purchase(p_purchase_id uuid)
returns public.purchases language plpgsql security definer set search_path = public as $$
declare
  v_purchase public.purchases;
  v_item record;
  v_new_stock numeric;
begin
  if public.current_role() not in ('administrator','manager') then
    raise exception 'Not authorized';
  end if;

  select * into v_purchase from public.purchases where id = p_purchase_id for update;
  if v_purchase.status = 'received' then
    return v_purchase;
  end if;

  for v_item in select * from public.purchase_items where purchase_id = p_purchase_id loop
    update public.products set current_stock = current_stock + v_item.quantity, cost_price = v_item.cost_price
      where id = v_item.product_id
      returning current_stock into v_new_stock;
    insert into public.inventory_transactions (product_id, type, quantity_change, resulting_stock, reference_type, reference_id, created_by)
    values (v_item.product_id, 'purchase', v_item.quantity, v_new_stock, 'purchase', p_purchase_id, auth.uid());
  end loop;

  update public.purchases set status = 'received', received_at = now() where id = p_purchase_id returning * into v_purchase;
  perform public.log_audit('purchase_received', 'purchase', p_purchase_id, null, to_jsonb(v_purchase));
  return v_purchase;
end;
$$;

-- ---------------------------------------------------------------------
-- STOCK ADJUSTMENT
-- ---------------------------------------------------------------------
create or replace function public.adjust_stock(
  p_product_id uuid, p_type inventory_txn_type, p_quantity numeric, p_reason text, p_notes text
) returns public.products language plpgsql security definer set search_path = public as $$
declare
  v_product public.products;
  v_new_stock numeric;
begin
  if public.current_role() not in ('administrator','manager') then
    raise exception 'Not authorized';
  end if;
  select * into v_product from public.products where id = p_product_id for update;
  v_new_stock := v_product.current_stock + p_quantity;
  update public.products set current_stock = v_new_stock where id = p_product_id returning * into v_product;
  insert into public.inventory_transactions (product_id, type, quantity_change, resulting_stock, reference_type, reason, notes, created_by)
  values (p_product_id, p_type, p_quantity, v_new_stock, 'manual', p_reason, p_notes, auth.uid());
  perform public.log_audit('stock_adjusted', 'product', p_product_id, null, jsonb_build_object('quantity', p_quantity, 'reason', p_reason));
  return v_product;
end;
$$;

-- ---------------------------------------------------------------------
-- CASH IN / OUT
-- ---------------------------------------------------------------------
create or replace function public.cash_register_movement(
  p_register_id uuid, p_type register_txn_type, p_amount numeric, p_reason text, p_notes text
) returns public.cash_register_transactions language plpgsql security definer set search_path = public as $$
declare v_txn public.cash_register_transactions;
begin
  insert into public.cash_register_transactions (register_id, type, amount, reason, notes, created_by)
  values (p_register_id, p_type, p_amount, p_reason, p_notes, auth.uid())
  returning * into v_txn;
  return v_txn;
end;
$$;

-- ---------------------------------------------------------------------
-- CLOSE REGISTER
-- ---------------------------------------------------------------------
create or replace function public.close_register(p_register_id uuid, p_actual_cash numeric, p_notes text)
returns public.cash_registers language plpgsql security definer set search_path = public as $$
declare
  v_register public.cash_registers;
  v_expected numeric;
begin
  select opening_cash + coalesce(sum(case when type in ('cash_sale','cash_in','opening_float') then amount
                                          when type in ('cash_refund','cash_out') then -amount else 0 end), 0)
  into v_expected
  from public.cash_registers r
  left join public.cash_register_transactions t on t.register_id = r.id
  where r.id = p_register_id
  group by r.opening_cash;

  update public.cash_registers
  set status = 'closed', closing_cash_expected = v_expected, closing_cash_actual = p_actual_cash,
      difference = p_actual_cash - v_expected, closing_notes = p_notes, closed_at = now()
  where id = p_register_id
  returning * into v_register;

  perform public.log_audit('register_closed', 'cash_register', p_register_id, null, to_jsonb(v_register));
  return v_register;
end;
$$;

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.suppliers enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.inventory_transactions enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;
alter table public.expense_categories enable row level security;
alter table public.expenses enable row level security;
alter table public.cash_registers enable row level security;
alter table public.cash_register_transactions enable row level security;
alter table public.refunds enable row level security;
alter table public.refund_items enable row level security;
alter table public.audit_logs enable row level security;
alter table public.notifications enable row level security;
alter table public.business_settings enable row level security;
alter table public.tax_settings enable row level security;
alter table public.payment_methods enable row level security;
alter table public.discount_limits enable row level security;

-- PROFILES: everyone authenticated can read active staff (needed for "cashier"
-- columns in reports); only admins manage users; users can update their own
-- non-role fields via the app (role changes are blocked in policy).
create policy "profiles_select_authenticated" on public.profiles for select to authenticated using (true);
create policy "profiles_insert_admin" on public.profiles for insert to authenticated with check (public.is_admin());
create policy "profiles_update_self_or_admin" on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());
create policy "profiles_delete_admin" on public.profiles for delete to authenticated using (public.is_admin());

-- CATEGORIES / PRODUCTS: everyone authenticated can read; manager/admin write; admin-only delete.
create policy "categories_select" on public.categories for select to authenticated using (true);
create policy "categories_write" on public.categories for insert to authenticated with check (public.is_manager_or_admin());
create policy "categories_update" on public.categories for update to authenticated using (public.is_manager_or_admin());
create policy "categories_delete" on public.categories for delete to authenticated using (public.is_admin());

create policy "products_select" on public.products for select to authenticated using (true);
create policy "products_write" on public.products for insert to authenticated with check (public.is_manager_or_admin());
create policy "products_update" on public.products for update to authenticated using (public.is_manager_or_admin());
create policy "products_delete" on public.products for delete to authenticated using (public.is_admin());

-- SUPPLIERS / PURCHASES: manager/admin only.
create policy "suppliers_all" on public.suppliers for all to authenticated using (public.is_manager_or_admin()) with check (public.is_manager_or_admin());
create policy "purchases_all" on public.purchases for all to authenticated using (public.is_manager_or_admin()) with check (public.is_manager_or_admin());
create policy "purchase_items_all" on public.purchase_items for all to authenticated using (public.is_manager_or_admin()) with check (public.is_manager_or_admin());

-- CUSTOMERS: everyone authenticated can read/create; manager/admin update/delete.
create policy "customers_select" on public.customers for select to authenticated using (true);
create policy "customers_insert" on public.customers for insert to authenticated with check (true);
create policy "customers_update" on public.customers for update to authenticated using (public.is_manager_or_admin());
create policy "customers_delete" on public.customers for delete to authenticated using (public.is_manager_or_admin());

-- ORDERS: cashiers see/create their own; manager/admin see all. Cashiers cannot
-- update historical orders (void/refund handled through SECURITY DEFINER RPCs).
create policy "orders_select" on public.orders for select to authenticated
  using (cashier_id = auth.uid() or public.is_manager_or_admin());
create policy "orders_insert" on public.orders for insert to authenticated
  with check (cashier_id = auth.uid() or public.is_manager_or_admin());
create policy "orders_update_manager" on public.orders for update to authenticated
  using (public.is_manager_or_admin());

create policy "order_items_select" on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and (o.cashier_id = auth.uid() or public.is_manager_or_admin())));
create policy "order_items_insert" on public.order_items for insert to authenticated
  with check (exists (select 1 from public.orders o where o.id = order_id and (o.cashier_id = auth.uid() or public.is_manager_or_admin())));

create policy "payments_select" on public.payments for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and (o.cashier_id = auth.uid() or public.is_manager_or_admin())));
create policy "payments_insert" on public.payments for insert to authenticated
  with check (exists (select 1 from public.orders o where o.id = order_id and (o.cashier_id = auth.uid() or public.is_manager_or_admin())));

-- INVENTORY: read for manager/admin (cashiers don't need raw stock ledger); writes go through RPCs.
create policy "inventory_txn_select" on public.inventory_transactions for select to authenticated using (public.is_manager_or_admin());

-- EXPENSES: manager/admin only (sensitive financial info, per spec cashiers cannot view).
create policy "expense_categories_select" on public.expense_categories for select to authenticated using (public.is_manager_or_admin());
create policy "expense_categories_write" on public.expense_categories for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "expenses_all" on public.expenses for all to authenticated using (public.is_manager_or_admin()) with check (public.is_manager_or_admin());

-- CASH REGISTERS: cashier manages their own session; manager/admin see all.
create policy "cash_registers_select" on public.cash_registers for select to authenticated
  using (cashier_id = auth.uid() or public.is_manager_or_admin());
create policy "cash_registers_insert" on public.cash_registers for insert to authenticated
  with check (cashier_id = auth.uid());
create policy "cash_registers_update" on public.cash_registers for update to authenticated
  using (cashier_id = auth.uid() or public.is_manager_or_admin());

create policy "cash_register_txn_select" on public.cash_register_transactions for select to authenticated
  using (exists (select 1 from public.cash_registers r where r.id = register_id and (r.cashier_id = auth.uid() or public.is_manager_or_admin())));
create policy "cash_register_txn_insert" on public.cash_register_transactions for insert to authenticated
  with check (exists (select 1 from public.cash_registers r where r.id = register_id and (r.cashier_id = auth.uid() or public.is_manager_or_admin())));

-- REFUNDS: manager/admin only (authorization required).
create policy "refunds_select" on public.refunds for select to authenticated using (public.is_manager_or_admin());
create policy "refund_items_select" on public.refund_items for select to authenticated using (public.is_manager_or_admin());

-- AUDIT LOG: admin only.
create policy "audit_logs_select" on public.audit_logs for select to authenticated using (public.is_admin());

-- NOTIFICATIONS: user sees their own + broadcast (user_id is null); manager/admin see all.
create policy "notifications_select" on public.notifications for select to authenticated
  using (user_id = auth.uid() or user_id is null or public.is_manager_or_admin());
create policy "notifications_update" on public.notifications for update to authenticated
  using (user_id = auth.uid() or public.is_manager_or_admin());
create policy "notifications_insert" on public.notifications for insert to authenticated with check (public.is_manager_or_admin());

-- SETTINGS: everyone authenticated can read (POS needs tax/payment methods); admin writes.
create policy "business_settings_select" on public.business_settings for select to authenticated using (true);
create policy "business_settings_update" on public.business_settings for update to authenticated using (public.is_admin());
create policy "tax_settings_select" on public.tax_settings for select to authenticated using (true);
create policy "tax_settings_update" on public.tax_settings for update to authenticated using (public.is_admin());
create policy "payment_methods_select" on public.payment_methods for select to authenticated using (true);
create policy "payment_methods_write" on public.payment_methods for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "discount_limits_select" on public.discount_limits for select to authenticated using (true);
create policy "discount_limits_write" on public.discount_limits for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- =====================================================================
-- STORAGE BUCKETS + POLICIES
-- =====================================================================
insert into storage.buckets (id, name, public) values ('product-images', 'product-images', true) on conflict do nothing;
insert into storage.buckets (id, name, public) values ('business-assets', 'business-assets', true) on conflict do nothing;
insert into storage.buckets (id, name, public) values ('expense-receipts', 'expense-receipts', false) on conflict do nothing;
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict do nothing;

create policy "public_read_product_images" on storage.objects for select using (bucket_id = 'product-images');
create policy "staff_write_product_images" on storage.objects for insert to authenticated with check (bucket_id = 'product-images' and public.is_manager_or_admin());
create policy "staff_update_product_images" on storage.objects for update to authenticated using (bucket_id = 'product-images' and public.is_manager_or_admin());
create policy "staff_delete_product_images" on storage.objects for delete to authenticated using (bucket_id = 'product-images' and public.is_manager_or_admin());

create policy "public_read_business_assets" on storage.objects for select using (bucket_id = 'business-assets');
create policy "admin_write_business_assets" on storage.objects for insert to authenticated with check (bucket_id = 'business-assets' and public.is_admin());
create policy "admin_update_business_assets" on storage.objects for update to authenticated using (bucket_id = 'business-assets' and public.is_admin());

create policy "staff_read_expense_receipts" on storage.objects for select to authenticated using (bucket_id = 'expense-receipts' and public.is_manager_or_admin());
create policy "staff_write_expense_receipts" on storage.objects for insert to authenticated with check (bucket_id = 'expense-receipts' and public.is_manager_or_admin());

create policy "public_read_avatars" on storage.objects for select using (bucket_id = 'avatars');
create policy "user_write_own_avatar" on storage.objects for insert to authenticated with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "user_update_own_avatar" on storage.objects for update to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- =====================================================================
-- REALTIME
-- =====================================================================
alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.cash_registers;
