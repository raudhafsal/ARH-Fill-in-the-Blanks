-- =====================================================================
-- SELL BY UNIT IN THE POS
-- Mirrors Ewity: a product with extra units (product_units) shows one
-- tile per unit ("Wafer Chocolate / Single", "Wafer Chocolate / Pkt") but
-- all of them deduct from the SAME base-unit stock pool, scaled by that
-- unit's `scale`. Previously the POS had no concept of units at all —
-- every sale deducted exactly 1 base unit per line regardless of what was
-- actually tapped, which under-counted stock for anything sold by the pack.
-- =====================================================================

-- Optional custom price for a unit (e.g. a "Pkt" of 12 priced below 12x the
-- single price). Null means "compute as product.selling_price * scale".
alter table public.product_units add column price numeric(12,2);

-- Record which unit a line was actually sold in, so refunds and receipts
-- can convert back to base-unit stock correctly.
alter table public.order_items add column unit_name text;
alter table public.order_items add column unit_scale numeric not null default 1 check (unit_scale > 0);

-- ---------------------------------------------------------------------
-- COMPLETE SALE — stock (product + recipe ingredients) now deducts
-- quantity * unit_scale base units instead of quantity alone.
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
  v_unit_scale numeric;
  v_base_qty numeric;
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
    v_unit_scale := coalesce(nullif(v_item->>'unit_scale', '')::numeric, 1);

    insert into public.order_items (
      order_id, product_id, product_name, unit_price, quantity,
      item_discount_amount, tax_amount, line_total, notes, unit_name, unit_scale
    ) values (
      v_order_id,
      nullif(v_item->>'product_id','')::uuid,
      v_item->>'product_name',
      (v_item->>'unit_price')::numeric,
      (v_item->>'quantity')::numeric,
      coalesce((v_item->>'item_discount_amount')::numeric, 0),
      coalesce((v_item->>'tax_amount')::numeric, 0),
      (v_item->>'line_total')::numeric,
      v_item->>'notes',
      nullif(v_item->>'unit_name',''),
      v_unit_scale
    );

    if (v_item->>'product_id') is not null and (v_item->>'product_id') <> '' then
      v_sold_qty := (v_item->>'quantity')::numeric;
      -- Base-unit quantity actually leaving stock: e.g. 1 "Pkt" of 12 = 12 base units.
      v_base_qty := v_sold_qty * v_unit_scale;

      select * into v_product from public.products where id = (v_item->>'product_id')::uuid for update;
      if found and v_product.track_inventory then
        v_new_stock := v_product.current_stock - v_base_qty;
        update public.products set current_stock = v_new_stock where id = v_product.id;
        insert into public.inventory_transactions (
          product_id, type, quantity_change, resulting_stock, reference_type, reference_id, created_by
        ) values (
          v_product.id, 'sale', -1 * v_base_qty, v_new_stock, 'order', v_order_id, auth.uid()
        );
      end if;

      -- Recipe ingredients: deducted regardless of the sold product's own
      -- track_inventory flag (a composite item like "Jugo" is often not
      -- itself stocked — only its ingredients are). Scaled by base_qty too,
      -- so a "Pkt" of 12 consumes 12x the recipe's per-unit ingredients.
      for v_recipe in select * from public.recipe_items where product_id = (v_item->>'product_id')::uuid
      loop
        select * into v_ingredient from public.products where id = v_recipe.ingredient_product_id for update;
        if found and v_ingredient.track_inventory then
          v_ingredient_new_stock := v_ingredient.current_stock - (v_recipe.quantity * v_base_qty);
          update public.products set current_stock = v_ingredient_new_stock where id = v_ingredient.id;
          insert into public.inventory_transactions (
            product_id, type, quantity_change, resulting_stock, reference_type, reference_id, created_by, notes
          ) values (
            v_ingredient.id, 'sale', -1 * (v_recipe.quantity * v_base_qty), v_ingredient_new_stock,
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
-- PROCESS REFUND — restores quantity * unit_scale base units, using the
-- unit_scale recorded on the order_item at sale time.
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
  v_base_qty numeric;
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
      v_base_qty := v_refund_qty * coalesce(v_order_item.unit_scale, 1);

      select * into v_product from public.products where id = v_order_item.product_id for update;
      if found and v_product.track_inventory then
        v_new_stock := v_product.current_stock + v_base_qty;
        update public.products set current_stock = v_new_stock where id = v_product.id;
        insert into public.inventory_transactions (
          product_id, type, quantity_change, resulting_stock, reference_type, reference_id, created_by, reason
        ) values (
          v_product.id, 'refund', v_base_qty, v_new_stock, 'refund', v_refund.id, auth.uid(), p_reason
        );
      end if;

      for v_recipe in select * from public.recipe_items where product_id = v_order_item.product_id
      loop
        select * into v_ingredient from public.products where id = v_recipe.ingredient_product_id for update;
        if found and v_ingredient.track_inventory then
          v_ingredient_new_stock := v_ingredient.current_stock + (v_recipe.quantity * v_base_qty);
          update public.products set current_stock = v_ingredient_new_stock where id = v_ingredient.id;
          insert into public.inventory_transactions (
            product_id, type, quantity_change, resulting_stock, reference_type, reference_id, created_by, reason, notes
          ) values (
            v_ingredient.id, 'refund', (v_recipe.quantity * v_base_qty), v_ingredient_new_stock,
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
