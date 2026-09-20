-- =====================================================================
-- OPTIONAL demo/seed data. Safe to skip in production — run this only
-- on a fresh project if you want sample categories/products to explore
-- the POS with. All rows are clearly demo data (see product names).
-- =====================================================================

insert into public.categories (name, description, display_order) values
  ('Burgers', 'Grilled and fried burgers', 1),
  ('Rice', 'Rice plates', 2),
  ('Noodles', 'Fried and soup noodles', 3),
  ('Snacks', 'Short eats and sides', 4),
  ('Drinks', 'Cold beverages', 5),
  ('Coffee', 'Hot and iced coffee', 6),
  ('Desserts', 'Sweets and desserts', 7),
  ('Other', 'Everything else', 8)
on conflict do nothing;

do $$
declare
  cat_burgers uuid; cat_rice uuid; cat_noodles uuid; cat_snacks uuid;
  cat_drinks uuid; cat_coffee uuid; cat_desserts uuid;
begin
  select id into cat_burgers from public.categories where name = 'Burgers';
  select id into cat_rice from public.categories where name = 'Rice';
  select id into cat_noodles from public.categories where name = 'Noodles';
  select id into cat_snacks from public.categories where name = 'Snacks';
  select id into cat_drinks from public.categories where name = 'Drinks';
  select id into cat_coffee from public.categories where name = 'Coffee';
  select id into cat_desserts from public.categories where name = 'Desserts';

  insert into public.products (name, sku, category_id, selling_price, cost_price, current_stock, minimum_stock, unit) values
    ('(Demo) Beef Burger', 'DEMO-BRG-001', cat_burgers, 65.00, 35.00, 40, 10, 'pcs'),
    ('(Demo) Chicken Burger', 'DEMO-BRG-002', cat_burgers, 55.00, 28.00, 40, 10, 'pcs'),
    ('(Demo) Chicken Rice', 'DEMO-RIC-001', cat_rice, 45.00, 22.00, 30, 8, 'pcs'),
    ('(Demo) Fried Rice', 'DEMO-RIC-002', cat_rice, 40.00, 20.00, 30, 8, 'pcs'),
    ('(Demo) Chicken Noodles', 'DEMO-NOO-001', cat_noodles, 42.00, 21.00, 25, 8, 'pcs'),
    ('(Demo) Short Eats Pack (5pc)', 'DEMO-SNK-001', cat_snacks, 25.00, 12.00, 50, 15, 'pack'),
    ('(Demo) French Fries', 'DEMO-SNK-002', cat_snacks, 20.00, 8.00, 50, 15, 'pcs'),
    ('(Demo) Coca-Cola 330ml', 'DEMO-DRK-001', cat_drinks, 15.00, 8.00, 60, 20, 'can'),
    ('(Demo) Bottled Water', 'DEMO-DRK-002', cat_drinks, 8.00, 3.00, 80, 20, 'bottle'),
    ('(Demo) Iced Latte', 'DEMO-COF-001', cat_coffee, 35.00, 15.00, 20, 5, 'cup'),
    ('(Demo) Espresso', 'DEMO-COF-002', cat_coffee, 25.00, 10.00, 20, 5, 'cup'),
    ('(Demo) Chocolate Cake Slice', 'DEMO-DES-001', cat_desserts, 30.00, 14.00, 15, 5, 'slice')
  on conflict do nothing;
end $$;
