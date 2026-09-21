-- =====================================================================
-- RECIPES / BILL OF MATERIALS
-- Lets a composite product (e.g. "Jugo") list the raw-ingredient products
-- it consumes per unit sold (e.g. 1x Orange, 0.05x Sugar (kg), 1x Cup).
-- complete_sale() and process_refund() deduct/restore ingredient stock
-- automatically, in addition to the sold product's own stock (if tracked).
-- =====================================================================

create table public.recipe_items (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  ingredient_product_id uuid not null references public.products(id) on delete restrict,
  quantity numeric(12, 4) not null check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, ingredient_product_id),
  check (product_id <> ingredient_product_id)
);
create index recipe_items_product_idx on public.recipe_items(product_id);
create index recipe_items_ingredient_idx on public.recipe_items(ingredient_product_id);
comment on table public.recipe_items is 'Bill of materials: product_id consumes `quantity` units of ingredient_product_id per 1 unit sold.';

create trigger set_updated_at before update on public.recipe_items
  for each row execute function public.set_updated_at();

alter table public.recipe_items enable row level security;
create policy "recipe_items_select" on public.recipe_items for select to authenticated using (true);
create policy "recipe_items_write" on public.recipe_items for insert to authenticated with check (public.is_manager_or_admin());
create policy "recipe_items_update" on public.recipe_items for update to authenticated using (public.is_manager_or_admin());
create policy "recipe_items_delete" on public.recipe_items for delete to authenticated using (public.is_manager_or_admin());

-- ---------------------------------------------------------------------
-- COMPLETE SALE — now also deducts recipe ingredients for each item sold.
-- ---------------------------------------------------------------------
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
  v_recipe public.recipe_items;
  v_ingredient public.products;
  v_ingredient_new_stock numeric;
  v_sold_qty numeric;
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
      v_sold_qty := (v_item->>'quantity')::numeric;

      select * into v_product from public.products where id = (v_item->>'product_id')::uuid for update;
      if found and v_product.track_inventory then
        v_new_stock := v_product.current_stock - v_sold_qty;
        update public.products set current_stock = v_new_stock where id = v_product.id;
        insert into public.inventory_transactions (
          product_id, type, quantity_change, resulting_stock, reference_type, reference_id, created_by
        ) values (
          v_product.id, 'sale', -1 * v_sold_qty, v_new_stock, 'order', v_order_id, auth.uid()
        );
      end if;

      -- Recipe ingredients: deducted regardless of the sold product's own
      -- track_inventory flag (a composite item like "Jugo" is often not
      -- itself stocked — only its ingredients are).
      for v_recipe in select * from public.recipe_items where product_id = (v_item->>'product_id')::uuid
      loop
        select * into v_ingredient from public.products where id = v_recipe.ingredient_product_id for update;
        if found and v_ingredient.track_inventory then
          v_ingredient_new_stock := v_ingredient.current_stock - (v_recipe.quantity * v_sold_qty);
          update public.products set current_stock = v_ingredient_new_stock where id = v_ingredient.id;
          insert into public.inventory_transactions (
            product_id, type, quantity_change, resulting_stock, reference_type, reference_id, created_by, notes
          ) values (
            v_ingredient.id, 'sale', -1 * (v_recipe.quantity * v_sold_qty), v_ingredient_new_stock,
            'order', v_order_id, auth.uid(), 'Recipe ingredient for ' || (v_item->>'product_name')
          );
        end if;
      end loop;
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
-- PROCESS REFUND — now also restores recipe ingredients for each item refunded.
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
  v_recipe public.recipe_items;
  v_ingredient public.products;
  v_ingredient_new_stock numeric;
  v_refund_qty numeric;
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
      v_refund_qty := (v_item->>'quantity')::numeric;

      select * into v_product from public.products where id = v_order_item.product_id for update;
      if found and v_product.track_inventory then
        v_new_stock := v_product.current_stock + v_refund_qty;
        update public.products set current_stock = v_new_stock where id = v_product.id;
        insert into public.inventory_transactions (
          product_id, type, quantity_change, resulting_stock, reference_type, reference_id, created_by, reason
        ) values (
          v_product.id, 'refund', v_refund_qty, v_new_stock, 'refund', v_refund.id, auth.uid(), p_reason
        );
      end if;

      for v_recipe in select * from public.recipe_items where product_id = v_order_item.product_id
      loop
        select * into v_ingredient from public.products where id = v_recipe.ingredient_product_id for update;
        if found and v_ingredient.track_inventory then
          v_ingredient_new_stock := v_ingredient.current_stock + (v_recipe.quantity * v_refund_qty);
          update public.products set current_stock = v_ingredient_new_stock where id = v_ingredient.id;
          insert into public.inventory_transactions (
            product_id, type, quantity_change, resulting_stock, reference_type, reference_id, created_by, reason, notes
          ) values (
            v_ingredient.id, 'refund', (v_recipe.quantity * v_refund_qty), v_ingredient_new_stock,
            'refund', v_refund.id, auth.uid(), p_reason, 'Recipe ingredient for ' || v_order_item.product_name
          );
        end if;
      end loop;
    end if;
  end loop;

  perform public.log_audit('sale_refunded', 'order', p_order_id, null, to_jsonb(v_refund));

  return v_refund;
end;
$$;
