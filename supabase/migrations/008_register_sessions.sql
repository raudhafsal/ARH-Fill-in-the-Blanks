-- ---------------------------------------------------------------------
-- REGISTER SESSIONS (Ewity-style)
--
-- Each cashier still opens/closes their own register (one open session per
-- cashier), but every session now gets a number, records who closed it,
-- optionally keeps the notes-and-coins (denomination) counts, and on close
-- stores a per-payment-method reconciliation (opening / received /
-- expected / counted / difference) — not just cash.
--
-- Backwards compatible: the old close_register() and the old direct insert
-- into cash_registers keep working until the new UI is deployed.
-- ---------------------------------------------------------------------

alter table public.cash_registers
  add column if not exists session_no bigint,
  add column if not exists closed_by uuid references public.profiles(id),
  add column if not exists opening_denominations jsonb,
  add column if not exists closing_denominations jsonb;

create sequence if not exists public.cash_register_session_no_seq;

-- Number existing sessions in the order they were opened.
update public.cash_registers r
set session_no = n.rn
from (
  select id, row_number() over (order by opened_at, id) as rn
  from public.cash_registers
) n
where r.id = n.id and r.session_no is null;

select setval(
  'public.cash_register_session_no_seq',
  coalesce((select max(session_no) from public.cash_registers), 0) + 1,
  false
);

alter table public.cash_registers alter column session_no set default nextval('public.cash_register_session_no_seq');
alter table public.cash_registers alter column session_no set not null;
create unique index if not exists cash_registers_session_no_key on public.cash_registers(session_no);

-- A cashier can only ever have one open session (stops double-click duplicates).
create unique index if not exists cash_registers_one_open_per_cashier
  on public.cash_registers(cashier_id) where status = 'open';

create index if not exists cash_registers_opened_at_idx on public.cash_registers(opened_at desc);

-- ---------------------------------------------------------------------
-- Per-payment-method reconciliation snapshot, written when a session closes.
-- ---------------------------------------------------------------------
create table if not exists public.cash_register_close_lines (
  id uuid primary key default gen_random_uuid(),
  register_id uuid not null references public.cash_registers(id) on delete cascade,
  payment_method_id uuid not null references public.payment_methods(id),
  opening numeric(12,2) not null default 0,
  received numeric(12,2) not null default 0,
  expected numeric(12,2) not null default 0,
  counted numeric(12,2) not null default 0,
  difference numeric(12,2) not null default 0,
  unique (register_id, payment_method_id)
);
create index if not exists cash_register_close_lines_register_idx on public.cash_register_close_lines(register_id);

alter table public.cash_register_close_lines enable row level security;
-- Rows are only ever written by close_register_session() (security definer).
create policy "cash_register_close_lines_select" on public.cash_register_close_lines for select to authenticated
  using (exists (
    select 1 from public.cash_registers r
    where r.id = register_id and (r.cashier_id = (select auth.uid()) or public.is_manager_or_admin())
  ));

-- ---------------------------------------------------------------------
-- LIVE SUMMARY for one session, per payment method.
--   received = payments on this session's non-voided orders
--   cash expected = opening cash + cash received + cash in - cash out
--   other methods expected = received
--   credit methods are "sold on credit" (no money collected), expected = 0
-- ---------------------------------------------------------------------
create or replace function public.register_session_summary(p_register_id uuid)
returns table (
  payment_method_id uuid,
  method_name text,
  method_code text,
  method_order integer,
  opening numeric,
  received numeric,
  cash_in numeric,
  cash_out numeric,
  expected numeric,
  is_cash boolean,
  is_credit boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_reg public.cash_registers;
begin
  select * into v_reg from public.cash_registers where id = p_register_id;
  if v_reg.id is null then
    raise exception 'Register session not found';
  end if;
  if v_reg.cashier_id is distinct from auth.uid() and not public.is_manager_or_admin() then
    raise exception 'Not allowed to view this register session';
  end if;

  return query
  with recv as (
    select p.payment_method_id as pmid, sum(p.amount) as amt
    from public.payments p
    join public.orders o on o.id = p.order_id
    where o.register_id = p_register_id and o.voided = false
    group by p.payment_method_id
  ),
  mv as (
    select
      coalesce(sum(case when t.type = 'cash_in' then t.amount end), 0) as cin,
      coalesce(sum(case when t.type = 'cash_out' then t.amount end), 0) as cout
    from public.cash_register_transactions t
    where t.register_id = p_register_id
  )
  select
    pm.id,
    pm.name,
    pm.code,
    pm.display_order,
    case when pm.code = 'cash' then v_reg.opening_cash else 0::numeric end,
    coalesce(recv.amt, 0::numeric),
    case when pm.code = 'cash' then mv.cin else 0::numeric end,
    case when pm.code = 'cash' then mv.cout else 0::numeric end,
    case
      when pm.code like 'credit%' then 0::numeric
      when pm.code = 'cash' then v_reg.opening_cash + coalesce(recv.amt, 0::numeric) + mv.cin - mv.cout
      else coalesce(recv.amt, 0::numeric)
    end,
    (pm.code = 'cash'),
    (pm.code like 'credit%')
  from public.payment_methods pm
  cross join mv
  left join recv on recv.pmid = pm.id
  where pm.enabled or recv.amt is not null or pm.code = 'cash'
  order by pm.display_order, pm.name;
end;
$$;

-- ---------------------------------------------------------------------
-- OPEN a register session (one per cashier).
-- ---------------------------------------------------------------------
create or replace function public.open_register_session(
  p_opening_cash numeric,
  p_notes text,
  p_denominations jsonb
) returns public.cash_registers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_register public.cash_registers;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if p_opening_cash is null or p_opening_cash < 0 then
    raise exception 'Opening cash must be 0 or more';
  end if;
  if exists (select 1 from public.cash_registers where cashier_id = auth.uid() and status = 'open') then
    raise exception 'You already have an open register';
  end if;

  insert into public.cash_registers (cashier_id, opening_cash, opening_notes, opening_denominations, status)
  values (auth.uid(), p_opening_cash, nullif(trim(coalesce(p_notes, '')), ''), p_denominations, 'open')
  returning * into v_register;

  perform public.log_audit('register_opened', 'cash_register', v_register.id, null, to_jsonb(v_register));
  return v_register;
end;
$$;

-- ---------------------------------------------------------------------
-- CLOSE a register session with a per-payment-method count.
--   p_counts: [{ "payment_method_id": uuid, "counted": number }]
--   Cash must be counted. Other methods default to expected if omitted.
--   Expected figures are always recomputed here — never trusted from the client.
--   Cashiers may close their own session; managers/admins may close any.
-- ---------------------------------------------------------------------
create or replace function public.close_register_session(
  p_register_id uuid,
  p_counts jsonb,
  p_denominations jsonb,
  p_notes text
) returns public.cash_registers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_register public.cash_registers;
  v_row record;
  v_counted numeric;
  v_cash_expected numeric := 0;
  v_cash_counted numeric;
  v_given jsonb;
begin
  select * into v_register from public.cash_registers where id = p_register_id for update;
  if v_register.id is null then
    raise exception 'Register session not found';
  end if;
  if v_register.cashier_id is distinct from auth.uid() and not public.is_manager_or_admin() then
    raise exception 'Not allowed to close this register session';
  end if;
  if v_register.status <> 'open' then
    raise exception 'This register session is already closed';
  end if;

  for v_row in select * from public.register_session_summary(p_register_id) loop
    if v_row.is_credit then
      continue;
    end if;

    select e into v_given
    from jsonb_array_elements(coalesce(p_counts, '[]'::jsonb)) e
    where (e->>'payment_method_id')::uuid = v_row.payment_method_id
    limit 1;

    if v_given is not null and nullif(v_given->>'counted', '') is not null then
      v_counted := (v_given->>'counted')::numeric;
    elsif v_row.is_cash then
      raise exception 'The cash count is required to close the register';
    else
      v_counted := v_row.expected;
    end if;

    if v_counted < 0 then
      raise exception 'Counted amounts cannot be negative';
    end if;

    insert into public.cash_register_close_lines (
      register_id, payment_method_id, opening, received, expected, counted, difference
    ) values (
      p_register_id, v_row.payment_method_id, v_row.opening, v_row.received,
      v_row.expected, v_counted, v_counted - v_row.expected
    )
    on conflict (register_id, payment_method_id) do update
      set opening = excluded.opening, received = excluded.received, expected = excluded.expected,
          counted = excluded.counted, difference = excluded.difference;

    if v_row.is_cash then
      v_cash_expected := v_row.expected;
      v_cash_counted := v_counted;
    end if;
  end loop;

  if v_cash_counted is null then
    raise exception 'The cash payment method is missing — cannot close the register';
  end if;

  update public.cash_registers
  set status = 'closed',
      closing_cash_expected = v_cash_expected,
      closing_cash_actual = v_cash_counted,
      difference = v_cash_counted - v_cash_expected,
      closing_notes = nullif(trim(coalesce(p_notes, '')), ''),
      closing_denominations = p_denominations,
      closed_at = now(),
      closed_by = auth.uid()
  where id = p_register_id
  returning * into v_register;

  perform public.log_audit('register_closed', 'cash_register', p_register_id, null, to_jsonb(v_register));
  return v_register;
end;
$$;

revoke execute on function public.register_session_summary(uuid) from public;
revoke execute on function public.open_register_session(numeric, text, jsonb) from public;
revoke execute on function public.close_register_session(uuid, jsonb, jsonb, text) from public;
revoke execute on function public.register_session_summary(uuid) from anon;
revoke execute on function public.open_register_session(numeric, text, jsonb) from anon;
revoke execute on function public.close_register_session(uuid, jsonb, jsonb, text) from anon;
grant execute on function public.register_session_summary(uuid) to authenticated;
grant execute on function public.open_register_session(numeric, text, jsonb) to authenticated;
grant execute on function public.close_register_session(uuid, jsonb, jsonb, text) to authenticated;
