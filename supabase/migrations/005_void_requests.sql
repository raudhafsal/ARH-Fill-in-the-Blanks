-- ---------------------------------------------------------------------
-- VOID REQUESTS
-- Cashiers cannot void orders directly (enforced in void_order()); instead
-- they raise a void request that a manager/administrator must approve.
-- Approving a request performs the actual void via the existing void_order
-- logic; rejecting it just closes the request out with a note.
-- ---------------------------------------------------------------------
create table public.void_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id),
  review_note text,
  reviewed_at timestamptz
);
create index void_requests_order_idx on public.void_requests(order_id);
create index void_requests_status_idx on public.void_requests(status);

alter table public.void_requests enable row level security;

create policy "void_requests_select" on public.void_requests for select to authenticated
  using (public.is_manager_or_admin() or requested_by = (select auth.uid()));

-- ---------------------------------------------------------------------
-- REQUEST VOID (cashier-initiated)
-- ---------------------------------------------------------------------
create or replace function public.request_void_order(p_order_id uuid, p_reason text)
returns public.void_requests language plpgsql security definer set search_path = public as $$
declare
  v_request public.void_requests;
  v_order public.orders;
begin
  if trim(coalesce(p_reason, '')) = '' then
    raise exception 'A reason is required to request a void';
  end if;

  select * into v_order from public.orders where id = p_order_id;
  if v_order.id is null then
    raise exception 'Order not found';
  end if;
  if v_order.voided then
    raise exception 'This order has already been voided';
  end if;
  if exists (select 1 from public.void_requests where order_id = p_order_id and status = 'pending') then
    raise exception 'A void request for this order is already pending approval';
  end if;

  insert into public.void_requests (order_id, reason, requested_by)
  values (p_order_id, trim(p_reason), auth.uid())
  returning * into v_request;

  perform public.log_audit('void_requested', 'order', p_order_id, null, to_jsonb(v_request));

  return v_request;
end;
$$;

-- ---------------------------------------------------------------------
-- APPROVE VOID REQUEST (manager/administrator)
-- ---------------------------------------------------------------------
create or replace function public.approve_void_request(p_request_id uuid, p_note text default null)
returns public.void_requests language plpgsql security definer set search_path = public as $$
declare
  v_request public.void_requests;
begin
  if public.current_role() not in ('administrator', 'manager') then
    raise exception 'Only managers/administrators can approve void requests';
  end if;

  select * into v_request from public.void_requests where id = p_request_id for update;
  if v_request.id is null then
    raise exception 'Void request not found';
  end if;
  if v_request.status <> 'pending' then
    raise exception 'This void request has already been reviewed';
  end if;

  perform public.void_order(v_request.order_id, v_request.reason);

  update public.void_requests
  set status = 'approved', reviewed_by = auth.uid(), review_note = p_note, reviewed_at = now()
  where id = p_request_id
  returning * into v_request;

  perform public.log_audit('void_request_approved', 'order', v_request.order_id, null, to_jsonb(v_request));

  return v_request;
end;
$$;

-- ---------------------------------------------------------------------
-- REJECT VOID REQUEST (manager/administrator)
-- ---------------------------------------------------------------------
create or replace function public.reject_void_request(p_request_id uuid, p_note text default null)
returns public.void_requests language plpgsql security definer set search_path = public as $$
declare
  v_request public.void_requests;
begin
  if public.current_role() not in ('administrator', 'manager') then
    raise exception 'Only managers/administrators can review void requests';
  end if;

  select * into v_request from public.void_requests where id = p_request_id for update;
  if v_request.id is null then
    raise exception 'Void request not found';
  end if;
  if v_request.status <> 'pending' then
    raise exception 'This void request has already been reviewed';
  end if;

  update public.void_requests
  set status = 'rejected', reviewed_by = auth.uid(), review_note = p_note, reviewed_at = now()
  where id = p_request_id
  returning * into v_request;

  perform public.log_audit('void_request_rejected', 'order', v_request.order_id, null, to_jsonb(v_request));

  return v_request;
end;
$$;

revoke execute on function public.request_void_order(uuid, text) from public;
revoke execute on function public.approve_void_request(uuid, text) from public;
revoke execute on function public.reject_void_request(uuid, text) from public;
revoke execute on function public.request_void_order(uuid, text) from anon;
revoke execute on function public.approve_void_request(uuid, text) from anon;
revoke execute on function public.reject_void_request(uuid, text) from anon;
grant execute on function public.request_void_order(uuid, text) to authenticated;
grant execute on function public.approve_void_request(uuid, text) to authenticated;
grant execute on function public.reject_void_request(uuid, text) to authenticated;
