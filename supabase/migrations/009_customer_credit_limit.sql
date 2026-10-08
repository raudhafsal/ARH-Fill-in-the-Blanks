-- Customer credit limit (null = no limit), enforced in complete_sale.
alter table public.customers add column if not exists credit_limit numeric(12,2) check (credit_limit is null or credit_limit >= 0);

CREATE OR REPLACE FUNCTION public.complete_sale(p_client_txn_id uuid, p_order_type order_type, p_customer_id uuid, p_register_id uuid, p_subtotal numeric, p_discount_type discount_kind, p_discount_value numeric, p_discount_amount numeric, p_tax_amount numeric, p_total numeric, p_notes text, p_items jsonb, p_payments jsonb)
 RETURNS orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_has_credit boolean := false;
  v_limit numeric;
  v_balance numeric;
  v_cname text;
begin
  v_role := public.current_role();
  if v_role is null then
    raise exception 'Not authorized';
  end if;

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

    if (select code from public.payment_methods where id = (v_payment->>'payment_method_id')::uuid) like 'credit%' then
      v_has_credit := true;
    end if;

    if p_register_id is not null and (select code from public.payment_methods where id = (v_payment->>'payment_method_id')::uuid) = 'cash' then
      insert into public.cash_register_transactions (register_id, type, amount, reference_order_id, created_by)
      values (p_register_id, 'cash_sale', (v_payment->>'amount')::numeric, v_order_id, auth.uid());
    end if;
  end loop;

  -- Credit limit: balance (which already includes this sale) must not exceed the limit.
  if v_has_credit and p_customer_id is not null then
    select credit_limit, full_name into v_limit, v_cname from public.customers where id = p_customer_id;
    if v_limit is not null then
      select balance into v_balance from public.customer_credit_balances where customer_id = p_customer_id;
      if coalesce(v_balance, 0) > v_limit then
        raise exception 'CREDIT_LIMIT_EXCEEDED: % has a credit limit of MVR %. This sale would bring the balance to MVR %.',
          v_cname, to_char(v_limit, 'FM999999990.00'), to_char(v_balance, 'FM999999990.00');
      end if;
    end if;
  end if;

  perform public.log_audit('sale_created', 'order', v_order_id, null, to_jsonb(v_order));

  return v_order;
end;
$function$;
