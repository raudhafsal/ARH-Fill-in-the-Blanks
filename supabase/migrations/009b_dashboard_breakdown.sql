create or replace function public.dashboard_breakdown(p_from timestamptz, p_to timestamptz)
returns table(kind text, name text, value numeric)
language sql stable
as $$
  select 'category'::text, coalesce(c.name, 'Uncategorized')::text, sum(oi.line_total)::numeric
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  left join public.products p on p.id = oi.product_id
  left join public.categories c on c.id = p.category_id
  where o.voided = false and o.created_at >= p_from and o.created_at < p_to
  group by 2
  union all
  select 'payment'::text, coalesce(pm.name, 'Other')::text, sum(pay.amount)::numeric
  from public.payments pay
  join public.orders o on o.id = pay.order_id
  left join public.payment_methods pm on pm.id = pay.payment_method_id
  where o.voided = false and o.created_at >= p_from and o.created_at < p_to
  group by 2;
$$;
grant execute on function public.dashboard_breakdown(timestamptz, timestamptz) to authenticated;
