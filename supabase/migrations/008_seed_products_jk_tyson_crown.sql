-- 008_seed_products_jk_tyson_crown.sql
-- Adds JK Air Bar, Tyson, and Crown Bar product lines. Placeholder price
-- of 0.00 and null image_path — edit via admin. Idempotent via ON CONFLICT
-- (slug) so it's safe to re-run.

insert into public.products (slug, name, subtitle, price, flavors, image_path, sort_order)
values
  (
    'jk-air-bar-ab10000',
    'JK Air Bar — AB10000',
    '1 flavor option',
    0.00,
    '["Strawberry Watermelon 5%"]'::jsonb,
    null,
    100
  ),
  (
    'jk-air-bar-nex',
    'JK Air Bar — NEX',
    '1 flavor option',
    0.00,
    '["Blueberry Ice 5%"]'::jsonb,
    null,
    110
  ),
  (
    'jk-air-bar-mini',
    'JK Air Bar — Mini',
    '6 flavor options',
    0.00,
    '["Pacific Cooler 5%","Fruit Cereal 5%","Strawberry Cheesecake 5%","Rainbow Blast 5%","Rootbeer 5%","Red Tobacco 5%"]'::jsonb,
    null,
    120
  ),
  (
    'jk-air-bar-diamond',
    'JK Air Bar — Diamond',
    '2 flavor options',
    0.00,
    '["Clear","Banana Ice"]'::jsonb,
    null,
    130
  ),
  (
    'jk-air-bar-ab5000',
    'JK Air Bar — AB5000',
    '5 flavor options',
    0.00,
    '["Strawberry Pina Colada 5%","Black Cheese Cake 5%","Cranberry Lemonade Ice 5%","Berries Blast 5%","Blueberry Kiwi Ice 5%"]'::jsonb,
    null,
    140
  ),
  (
    'jk-air-bar-atron-5000-puffs',
    'JK Air Bar — Atron / 5000 Puffs',
    '6 flavor options',
    0.00,
    '["Berry Freeze","Strawberry Watermelon Refresher","Coffee","Watermelon Cantaloupe Honeydew","Fruit Saga","Juicy Peach"]'::jsonb,
    null,
    150
  ),
  (
    'tyson-legend-30k-hits',
    'Tyson — Legend 30K Hits',
    '7 flavor options',
    0.00,
    '["Menthol","Apple Melonberry","Green Apple","Frozen Strawberry","Cherry Bomb","Watermelon","Tobacco"]'::jsonb,
    null,
    160
  ),
  (
    'tyson-triple-mesh-coil-2-0',
    'Tyson — Triple Mesh Coil / 2.0',
    '2 flavor options',
    0.00,
    '["Cool Mint","Frozen Blueberry"]'::jsonb,
    null,
    170
  ),
  (
    'tyson-legend-2-0',
    'Tyson — Legend / 2.0',
    '3 flavor options',
    0.00,
    '["Frozen Grape","Frozen Mango","Strawberry Banana"]'::jsonb,
    null,
    180
  ),
  (
    'crown-bar-e-hose-x-60k',
    'Crown Bar — E-Hose X / 60K',
    '1 flavor option',
    0.00,
    '["Alpha"]'::jsonb,
    null,
    190
  ),
  (
    'crown-bar-dual-mesh-80k',
    'Crown Bar — Dual Mesh / 80K',
    '1 flavor option',
    0.00,
    '["Black Currant Ice"]'::jsonb,
    null,
    200
  )
on conflict (slug) do update set
  name = excluded.name,
  subtitle = excluded.subtitle,
  price = excluded.price,
  flavors = excluded.flavors,
  image_path = excluded.image_path,
  sort_order = excluded.sort_order;
