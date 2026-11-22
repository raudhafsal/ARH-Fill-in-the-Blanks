-- Notification bell: void / refund / low stock / credit limit / register cash difference events.
-- Re-uses the existing (previously unused) public.notifications table. user_id is null = for all managers/admins.
alter table public.notifications add column if not exists link text;
alter table public.notifications add column if not exists read_by uuid[] not null default '{}';

-- Only managers/admins (or the addressed user) can read notifications; cashiers never see shared ones.
alter policy notifications_select on public.notifications
  using (user_id = (select auth.uid()) or public.is_manager_or_admin());

create index if not exists notifications_created_at_idx on public.notifications (created_at desc);

create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_manager_or_admin() then
    raise exception 'Not allowed';
  end if;
  update public.notifications
     set read_by = array_append(read_by, auth.uid())
   where not (auth.uid() = any(read_by))
     and (p_ids is null or id = any(p_ids));
end $$;

create or replace function public._notify(p_type text, p_title text, p_message text, p_link text)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, type, title, message, link) values (null, p_type, p_title, p_message, p_link);
$$;

create or replace function public._mvr(n numeric) returns text language sql immutable as $$
  select 'MVR ' || to_char(coalesce(n, 0), 'FM999,999,990.00');
$$;

-- 1. Order voided
create or replace function public.trg_notify_void() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public._notify('void', 'Order voided',
    'Order ' || new.order_number || ' (' || public._mvr(new.total) || ') was voided by ' ||
    coalesce((select full_name from public.profiles where id = coalesce(new.voided_by, auth.uid())), 'staff') ||
    coalesce(': ' || nullif(new.voided_reason, ''), ''),
    '/orders/' || new.id);
  return new;
end $$;
create trigger notify_order_voided after update on public.orders
  for each row when (old.voided = false and new.voided = true) execute function public.trg_notify_void();

-- 2. Void requested by a cashier
create or replace function public.trg_notify_void_request() returns trigger language plpgsql security definer set search_path = public as $$
declare o record;
begin
  select order_number, total into o from public.orders where id = new.order_id;
  perform public._notify('void_request', 'Void request needs approval',
    coalesce((select full_name from public.profiles where id = new.requested_by), 'A cashier') ||
    ' asked to void order ' || o.order_number || ' (' || public._mvr(o.total) || '): ' || new.reason,
    '/orders/' || new.order_id);
  return new;
end $$;
create trigger notify_void_request after insert on public.void_requests
  for each row execute function public.trg_notify_void_request();

-- 3. Refund
create or replace function public.trg_notify_refund() returns trigger language plpgsql security definer set search_path = public as $$
declare o record;
begin
  select order_number into o from public.orders where id = new.order_id;
  perform public._notify('refund', 'Refund issued',
    public._mvr(new.refund_amount) || ' refunded on order ' || o.order_number || ' by ' ||
    coalesce((select full_name from public.profiles where id = coalesce(new.created_by, new.authorized_by)), 'staff') ||
    coalesce(': ' || nullif(new.reason, ''), ''),
    '/orders/' || new.order_id);
  return new;
end $$;
create trigger notify_refund after insert on public.refunds
  for each row execute function public.trg_notify_refund();

-- 4. Low stock (fires once when stock drops to or below the minimum)
create or replace function public.trg_notify_low_stock() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public._notify('low_stock',
    case when new.current_stock <= 0 then 'Out of stock' else 'Low stock' end,
    new.name || ' is down to ' || new.current_stock::text || ' ' || coalesce(new.unit, 'pcs') ||
    ' (minimum ' || new.minimum_stock::text || ')',
    '/inventory');
  return new;
end $$;
create trigger notify_low_stock after update of current_stock on public.products
  for each row when (
    new.track_inventory and new.active
    and old.current_stock > old.minimum_stock and new.current_stock <= new.minimum_stock
  ) execute function public.trg_notify_low_stock();

-- 5. Credit sale takes a customer to 90%+ of their credit limit
create or replace function public.trg_notify_credit_limit() returns trigger language plpgsql security definer set search_path = public as $$
declare v_cust uuid; v_limit numeric; v_bal numeric; v_name text; v_is_credit boolean;
begin
  select (code like 'credit%') into v_is_credit from public.payment_methods where id = new.payment_method_id;
  if not coalesce(v_is_credit, false) then return new; end if;
  select customer_id into v_cust from public.orders where id = new.order_id;
  if v_cust is null then return new; end if;
  select credit_limit, full_name into v_limit, v_name from public.customers where id = v_cust;
  if v_limit is null or v_limit <= 0 then return new; end if;
  select balance into v_bal from public.customer_credit_balances where customer_id = v_cust;
  if coalesce(v_bal, 0) >= v_limit * 0.9 then
    perform public._notify('credit_limit', 'Credit limit nearly reached',
      v_name || ' owes ' || public._mvr(v_bal) || ' of a ' || public._mvr(v_limit) || ' limit', '/customers');
  end if;
  return new;
end $$;
create trigger notify_credit_limit after insert on public.payments
  for each row execute function public.trg_notify_credit_limit();

-- 6. Register closed with a cash difference
create or replace function public.trg_notify_cash_difference() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public._notify('cash_difference', 'Register cash difference',
    'Session #' || coalesce(new.session_no::text, '') || ' closed ' ||
    case when new.difference > 0 then 'over by ' else 'short by ' end || public._mvr(abs(new.difference)),
    '/register-sessions/' || new.id);
  return new;
end $$;
create trigger notify_cash_difference after update on public.cash_registers
  for each row when (old.status = 'open' and new.status = 'closed' and coalesce(new.difference, 0) <> 0)
  execute function public.trg_notify_cash_difference();

-- Internal helpers must not be callable from the API.
revoke execute on function public._notify(text, text, text, text) from public, anon, authenticated;
revoke execute on function public._mvr(numeric) from public, anon, authenticated;
revoke execute on function public.trg_notify_void() from public, anon, authenticated;
revoke execute on function public.trg_notify_void_request() from public, anon, authenticated;
revoke execute on function public.trg_notify_refund() from public, anon, authenticated;
revoke execute on function public.trg_notify_low_stock() from public, anon, authenticated;
revoke execute on function public.trg_notify_credit_limit() from public, anon, authenticated;
revoke execute on function public.trg_notify_cash_difference() from public, anon, authenticated;
revoke execute on function public.mark_notifications_read(uuid[]) from public, anon;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;
