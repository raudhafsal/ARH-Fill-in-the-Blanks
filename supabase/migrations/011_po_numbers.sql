-- Unique, auto-generated purchase order numbers (PO/001 style), separate from the supplier's invoice number.
alter table public.purchases add column if not exists po_number text;

-- Imported Ewity POs carried their number in invoice_number; move it to po_number.
update public.purchases set po_number = invoice_number, invoice_number = null
 where po_number is null and invoice_number ~ '^PO/[0-9]+$';

-- Number any remaining POs in creation order, continuing after the highest existing number.
do $$
declare r record; n int;
begin
  select coalesce(max(substring(po_number from 4)::int), 0) into n from public.purchases where po_number ~ '^PO/[0-9]+$';
  for r in select id from public.purchases where po_number is null order by created_at, id loop
    n := n + 1;
    update public.purchases set po_number = 'PO/' || lpad(n::text, 3, '0') where id = r.id;
  end loop;
  execute format('create sequence if not exists public.purchase_po_seq start %s', n + 1);
  perform setval('public.purchase_po_seq', n + 1, false);
end $$;

create or replace function public.assign_po_number() returns trigger
language plpgsql as $$
begin
  if new.po_number is null or new.po_number = '' then
    new.po_number := 'PO/' || lpad(nextval('public.purchase_po_seq')::text, 3, '0');
  end if;
  return new;
end $$;

create trigger trg_assign_po_number before insert on public.purchases
  for each row execute function public.assign_po_number();

alter table public.purchases alter column po_number set not null;
create unique index if not exists purchases_po_number_key on public.purchases (po_number);
