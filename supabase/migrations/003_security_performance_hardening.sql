-- =====================================================================
-- Security & performance hardening pass.
-- Applied directly to the live project via the Supabase MCP; included here
-- so the migration history in this repo matches what's actually deployed.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Fix mutable search_path warnings on two functions from 001 that were
-- missing `set search_path`.
-- ---------------------------------------------------------------------
create or replace function public.generate_order_number()
returns text
language sql
set search_path = public
as $$
  select 'ARH-' || lpad(nextval('public.order_number_seq')::text, 6, '0');
$$;

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Postgres grants EXECUTE to PUBLIC by default on new functions, which
-- anon/authenticated both inherit from. These RPCs are only meant to be
-- called by signed-in staff (they check current_role()/is_admin()/
-- is_manager_or_admin() internally, or need auth.uid() to resolve a role),
-- so revoke from PUBLIC and re-grant only to authenticated.
-- ---------------------------------------------------------------------
revoke execute on function public.adjust_stock(uuid, inventory_txn_type, numeric, text, text) from public;
revoke execute on function public.cash_register_movement(uuid, register_txn_type, numeric, text, text) from public;
revoke execute on function public.close_register(uuid, numeric, text) from public;
revoke execute on function public.complete_sale(uuid, order_type, uuid, uuid, numeric, discount_kind, numeric, numeric, numeric, numeric, text, jsonb, jsonb) from public;
revoke execute on function public.current_role() from public;
revoke execute on function public.is_admin() from public;
revoke execute on function public.is_manager_or_admin() from public;
revoke execute on function public.log_audit(text, text, uuid, jsonb, jsonb) from public;
revoke execute on function public.process_refund(uuid, text, jsonb) from public;
revoke execute on function public.receive_purchase(uuid) from public;
revoke execute on function public.void_order(uuid, text) from public;
revoke execute on function public.handle_new_user() from public;

grant execute on function public.adjust_stock(uuid, inventory_txn_type, numeric, text, text) to authenticated;
grant execute on function public.cash_register_movement(uuid, register_txn_type, numeric, text, text) to authenticated;
grant execute on function public.close_register(uuid, numeric, text) to authenticated;
grant execute on function public.complete_sale(uuid, order_type, uuid, uuid, numeric, discount_kind, numeric, numeric, numeric, numeric, text, jsonb, jsonb) to authenticated;
grant execute on function public.current_role() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_manager_or_admin() to authenticated;
grant execute on function public.log_audit(text, text, uuid, jsonb, jsonb) to authenticated;
grant execute on function public.process_refund(uuid, text, jsonb) to authenticated;
grant execute on function public.receive_purchase(uuid) to authenticated;
grant execute on function public.void_order(uuid, text) to authenticated;
-- handle_new_user is a trigger function only; no role needs direct execute.

-- ---------------------------------------------------------------------
-- RLS performance: wrap auth.uid() calls in (select ...) so Postgres
-- evaluates them once per query instead of once per row.
-- ---------------------------------------------------------------------
drop policy "profiles_update_self_or_admin" on public.profiles;
create policy "profiles_update_self_or_admin" on public.profiles for update to authenticated
  using (id = (select auth.uid()) or public.is_admin())
  with check (id = (select auth.uid()) or public.is_admin());

drop policy "orders_select" on public.orders;
create policy "orders_select" on public.orders for select to authenticated
  using (cashier_id = (select auth.uid()) or public.is_manager_or_admin());

drop policy "orders_insert" on public.orders;
create policy "orders_insert" on public.orders for insert to authenticated
  with check (cashier_id = (select auth.uid()) or public.is_manager_or_admin());

drop policy "order_items_select" on public.order_items;
create policy "order_items_select" on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and (o.cashier_id = (select auth.uid()) or public.is_manager_or_admin())));

drop policy "order_items_insert" on public.order_items;
create policy "order_items_insert" on public.order_items for insert to authenticated
  with check (exists (select 1 from public.orders o where o.id = order_id and (o.cashier_id = (select auth.uid()) or public.is_manager_or_admin())));

drop policy "payments_select" on public.payments;
create policy "payments_select" on public.payments for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and (o.cashier_id = (select auth.uid()) or public.is_manager_or_admin())));

drop policy "payments_insert" on public.payments;
create policy "payments_insert" on public.payments for insert to authenticated
  with check (exists (select 1 from public.orders o where o.id = order_id and (o.cashier_id = (select auth.uid()) or public.is_manager_or_admin())));

drop policy "cash_registers_select" on public.cash_registers;
create policy "cash_registers_select" on public.cash_registers for select to authenticated
  using (cashier_id = (select auth.uid()) or public.is_manager_or_admin());

drop policy "cash_registers_insert" on public.cash_registers;
create policy "cash_registers_insert" on public.cash_registers for insert to authenticated
  with check (cashier_id = (select auth.uid()));

drop policy "cash_registers_update" on public.cash_registers;
create policy "cash_registers_update" on public.cash_registers for update to authenticated
  using (cashier_id = (select auth.uid()) or public.is_manager_or_admin());

drop policy "cash_register_txn_select" on public.cash_register_transactions;
create policy "cash_register_txn_select" on public.cash_register_transactions for select to authenticated
  using (exists (select 1 from public.cash_registers r where r.id = register_id and (r.cashier_id = (select auth.uid()) or public.is_manager_or_admin())));

drop policy "cash_register_txn_insert" on public.cash_register_transactions;
create policy "cash_register_txn_insert" on public.cash_register_transactions for insert to authenticated
  with check (exists (select 1 from public.cash_registers r where r.id = register_id and (r.cashier_id = (select auth.uid()) or public.is_manager_or_admin())));

drop policy "notifications_select" on public.notifications;
create policy "notifications_select" on public.notifications for select to authenticated
  using (user_id = (select auth.uid()) or user_id is null or public.is_manager_or_admin());

drop policy "notifications_update" on public.notifications;
create policy "notifications_update" on public.notifications for update to authenticated
  using (user_id = (select auth.uid()) or public.is_manager_or_admin());

-- ---------------------------------------------------------------------
-- Collapse duplicate-permissive-policy warnings on three small settings
-- tables (an ALL policy and a SELECT policy both applying to SELECT for
-- the same role is redundant work for the planner).
-- ---------------------------------------------------------------------
drop policy "discount_limits_select" on public.discount_limits;
drop policy "expense_categories_select" on public.expense_categories;
drop policy "payment_methods_select" on public.payment_methods;

create policy "discount_limits_select_all" on public.discount_limits for select to authenticated using (true);
create policy "expense_categories_select_managers" on public.expense_categories for select to authenticated using (public.is_manager_or_admin());
create policy "payment_methods_select_all" on public.payment_methods for select to authenticated using (true);

drop policy "discount_limits_write" on public.discount_limits;
create policy "discount_limits_insert" on public.discount_limits for insert to authenticated with check (public.is_admin());
create policy "discount_limits_update" on public.discount_limits for update to authenticated using (public.is_admin());
create policy "discount_limits_delete" on public.discount_limits for delete to authenticated using (public.is_admin());

drop policy "expense_categories_write" on public.expense_categories;
create policy "expense_categories_insert" on public.expense_categories for insert to authenticated with check (public.is_admin());
create policy "expense_categories_update" on public.expense_categories for update to authenticated using (public.is_admin());
create policy "expense_categories_delete" on public.expense_categories for delete to authenticated using (public.is_admin());

drop policy "payment_methods_write" on public.payment_methods;
create policy "payment_methods_insert" on public.payment_methods for insert to authenticated with check (public.is_admin());
create policy "payment_methods_update" on public.payment_methods for update to authenticated using (public.is_admin());
create policy "payment_methods_delete" on public.payment_methods for delete to authenticated using (public.is_admin());
