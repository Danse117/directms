-- 005_seed_products.sql
-- Initial product catalog. Idempotent via ON CONFLICT (slug) so it's
-- safe to re-run; updates name/price/flavors/image_path/etc on conflict
-- but preserves the original id and created_at.

insert into public.products (slug, name, subtitle, price, flavors, image_path, sort_order)
values
  (
    'mega-v2-10-packs',
    'Mega V2 — 10 Packs',
    '25 flavor options',
    35.00,
    '["red bull","red apple","frozen tangerine","mega melons","Pineapple ice","Frozen blue razz","Frozen peach","Zero nicotine disposable pods","Strawberry banana","Cotton candy","Strawberry and cream","Frozen cranberry lemon","Guava ice","Frozen lychee ice","Blue razz","Mixed berry ice","Grape","Strawberry mint","Clear ice","Cherry cola","Watermelon mint","Frozen grape","Smooth tobacco","Cool mint","clear 5 percent"]'::jsonb,
    '/products/mega-v2-10-packs.jpg',
    10
  ),
  (
    'adalya-5-pieces-20000-puffs',
    'Adalya — 5 Pieces / 20000 Puffs',
    '16 flavor options',
    35.00,
    '["blueberry","Mi amor","Grape mint","Skyfall","Mint point","Love 66","Lady killer","Orange lemonade","Peach ice","Menthol","Passionfruit guava kiwi","Punk man","Blue min","Angel lips","delons","English lord"]'::jsonb,
    '/products/adalya-5-pieces-20000-puffs.jpg',
    20
  ),
  (
    'fume-extra',
    'Fume Extra',
    '16 flavor options',
    25.00,
    '["blueberry cc","Strawberry","Bubblegum","Paradise","Desert breeze","Hawaii juice","Mango","Banana ice","clear","Melon ice","Gummy bears","Strawberry banana","Fresh lychee","Double apple","Unicorn","mint ice"]'::jsonb,
    '/products/fume-extra.webp',
    30
  ),
  (
    'lava-plus',
    'Lava Plus',
    '22 flavor options',
    30.00,
    '["clear ice","Strawberry watermelon bubblegum","Berry mist","Jolly rancher ice","Watermelon mint","Pineapple, coconut rum","Bloom","Fruit blast","Black ice","Havana tobacco","Mango ice","Strawberry lemonade","Guava ice banana milkshake","Peach mango watermelon","Strawberry quake","Banana milkshake","Sour patch","Dragon flume","Sour watermelon candy","Mojito","Fruit ice","cool mint","peach ice"]'::jsonb,
    '/products/lava-plus.webp',
    40
  ),
  (
    'stig',
    'Stig',
    '1 flavor option',
    25.00,
    '["green apple"]'::jsonb,
    '/products/stig.png',
    50
  ),
  (
    'geek-bars-pulse-x',
    'Geek Bars Pulse X',
    '14 flavor options',
    30.00,
    '["Miami MINT","Mexican mango","Strawberry b pop","Lime berry orange","Clear diamond","Clear ice","Banana taffy freeze","Watermelon ice","Sour apple ice","Virginia tobacco","Blue razz ice","White peach raspberry","Banana taffy","Sour mango pineapple"]'::jsonb,
    '/products/geek-bars-pulse-x.jpg',
    60
  ),
  (
    'geek-x-mega',
    'Geek X Mega',
    '12 flavor options',
    30.00,
    '["clear","Strawberry mango ice","Strawberry kiwi ice","Strawberry ice","Cinnamon","Cool mint","Blue razz ice","Cherry lemon breeze","Tobacco","Blackberry b pop","Raspberry jam","Miami mint","Watermelon ice"]'::jsonb,
    '/products/geek-x-mega.png',
    70
  ),
  (
    'myle-mini-box-1500-puffs',
    'Myle Mini Box — 1500 Puffs',
    '10 flavor options',
    25.00,
    '["Cubano","Strawberry watermelon","Ice blueberry","Red apple","Prime pear","Iced apple","Sweet to","Grape ice","Peach ice","Ice watermelon"]'::jsonb,
    '/products/myle-mini-box-1500-puffs.webp',
    80
  ),
  (
    'mini-myle',
    'Mini Myle',
    '7 flavor options',
    25.00,
    '["ice Leche","Raspberry watermelon","Tobacco gold","Ice blueberry","Pink lemonade","Peach ice","Lemon mint"]'::jsonb,
    '/products/mini-myle.jpg',
    90
  )
on conflict (slug) do update set
  name = excluded.name,
  subtitle = excluded.subtitle,
  price = excluded.price,
  flavors = excluded.flavors,
  image_path = excluded.image_path,
  sort_order = excluded.sort_order;
