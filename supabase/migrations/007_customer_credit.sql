-- ---------------------------------------------------------------------
-- CUSTOMER CREDIT: outstanding balances + settlements
--
-- A "credit" sale is just a normal order whose payment method's code starts
-- with 'credit' (the Credit payment method is admin-configurable, like any
-- other). This migration adds a ledger of settlements (money the customer
-- pays back later) and a view that nets credit sales - refunds - settlements
-- into a live outstanding balance per customer.
-- ---------------------------------------------------------------------

create table public.credit_settlements (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  payment_method_id uuid references public.payment_methods(id),
  reference text,
  notes text,
  cashier_id uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index credit_settlements_customer_idx on public.credit_settlements(customer_id);

alter table public.credit_settlements enable row level security;
-- Everyone at the register needs to see and settle credit; no direct insert
-- policy on purpose — all inserts go through settle_credit() below, which
-- validates the amount against the live balance (same pattern as refunds).
create policy "credit_settlements_select" on public.credit_settlements for select to authenticated using (true);
create policy "credit_settlements_update" on public.credit_settlements for update to authenticated using (public.is_manager_or_admin());
create policy "credit_settlements_delete" on public.credit_settlements for delete to authenticated using (public.is_manager_or_admin());

-- Not security_invoker: orders_select RLS only lets a cashier see their own
-- orders, which would understate a customer's true balance for anyone else.
-- Credit owed is shop-wide information everyone at the register needs to see
-- accurately, so this view intentionally runs with the owner's privileges.
create or replace view public.customer_credit_balances as
select
  c.id as customer_id,
  c.full_name,
  coalesce(sold.gross_credit, 0) as gross_credit,
  coalesce(refunded.total_refunded, 0) as total_refunded,
  coalesce(settled.total_settled, 0) as total_settled,
  coalesce(sold.gross_credit, 0) - coalesce(refunded.total_refunded, 0) - coalesce(settled.total_settled, 0) as balance
from public.customers c
left join (
  select o.customer_id, sum(o.total) as gross_credit
  from public.orders o
  join public.payments p on p.order_id = o.id
  join public.payment_methods pm on pm.id = p.payment_method_id
  where o.voided = false and pm.code like 'credit%'
  group by o.customer_id
) sold on sold.customer_id = c.id
left join (
  select o.customer_id, sum(r.refund_amount) as total_refunded
  from public.refunds r
  join public.orders o on o.id = r.order_id
  join public.payments p on p.order_id = o.id
  join public.payment_methods pm on pm.id = p.payment_method_id
  where pm.code like 'credit%'
  group by o.customer_id
) refunded on refunded.customer_id = c.id
left join (
  select cs.customer_id, sum(cs.amount) as total_settled
  from public.credit_settlements cs
  group by cs.customer_id
) settled on settled.customer_id = c.id;

grant select on public.customer_credit_balances to authenticated;

-- ---------------------------------------------------------------------
-- SETTLE CREDIT (only way to insert a settlement — validates against the
-- live balance so a customer can never be recorded as overpaying)
-- ---------------------------------------------------------------------
create or replace function public.settle_credit(
  p_customer_id uuid,
  p_amount numeric,
  p_payment_method_id uuid,
  p_reference text,
  p_notes text
) returns public.credit_settlements
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settlement public.credit_settlements;
  v_balance numeric;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Settlement amount must be greater than zero';
  end if;

  select balance into v_balance from public.customer_credit_balances where customer_id = p_customer_id;
  if v_balance is null or v_balance <= 0 then
    raise exception 'This customer has no outstanding credit balance';
  end if;
  if p_amount > v_balance + 0.01 then
    raise exception 'Settlement amount exceeds the outstanding balance of %', v_balance;
  end if;

  insert into public.credit_settlements (customer_id, amount, payment_method_id, reference, notes, cashier_id)
  values (p_customer_id, p_amount, p_payment_method_id, nullif(p_reference, ''), nullif(p_notes, ''), auth.uid())
  returning * into v_settlement;

  perform public.log_audit('credit_settled', 'customer', p_customer_id, null, to_jsonb(v_settlement));

  return v_settlement;
end;
$$;
