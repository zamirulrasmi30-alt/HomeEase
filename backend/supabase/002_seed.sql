-- Clean Reset & Seed Data
truncate table public.stock_transactions, public.order_items, public.orders, public.products, public.categories cascade;

insert into public.categories (id, name, description) values
  ('c8000000-0000-4000-8000-000000000001'::uuid, 'Cement & Aggregates', 'Portland cement, M-Sand, P-Sand, 20mm aggregates'),
  ('c8000000-0000-4000-8000-000000000002'::uuid, 'Steel & TMT Bars', 'Fe550D TMT rebars, binding wire, structural steel'),
  ('c8000000-0000-4000-8000-000000000003'::uuid, 'Bricks & Blocks', 'Red clay bricks, AAC blocks, solid concrete blocks'),
  ('c8000000-0000-4000-8000-000000000004'::uuid, 'Tiles & Flooring', 'Vitrified floor tiles, wall tiles, waterproofing compound'),
  ('c8000000-0000-4000-8000-000000000005'::uuid, 'Plumbing', 'CPVC pipes, fittings, water tanks, valves'),
  ('c8000000-0000-4000-8000-000000000006'::uuid, 'Electricals', 'Copper wires, switches, conduits, MCBs')
on conflict (id) do update set name = excluded.name, description = excluded.description;

insert into public.products (id, category_id, name, brand, description, price_per_unit, unit_type, image_url)
select 
  p.id, 
  c.id as category_id, 
  p.name, 
  p.brand, 
  p.description, 
  p.price, 
  p.unit_type,
  p.image_url
from (
  values
    ('c8000000-0000-4000-8000-000000000011'::uuid, 'Cement & Aggregates', 'OPC 53 Grade Cement (50kg)', 'UltraTech', 'High-strength Portland cement', 385.00, 'bag', 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=600'),
    ('c8000000-0000-4000-8000-000000000012'::uuid, 'Cement & Aggregates', 'PPC Cement (50kg)', 'Ramco', 'Portland Pozzolana Cement', 360.00, 'bag', 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=600'),
    ('c8000000-0000-4000-8000-000000000013'::uuid, 'Cement & Aggregates', 'M-Sand (Manufactured Sand)', 'Local Quarry', 'Washed double-screened sand', 1450.00, 'ton', 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600'),
    ('c8000000-0000-4000-8000-000000000021'::uuid, 'Steel & TMT Bars', '12mm Fe550D TMT Rebar (12m)', 'TATA Tiscon', 'High-ductility TMT bar', 68.50, 'kg', 'https://images.unsplash.com/photo-1535813547-99c456a41d4a?w=600'),
    ('c8000000-0000-4000-8000-000000000022'::uuid, 'Steel & TMT Bars', '16mm Fe550D TMT Rebar (12m)', 'JSW Neosteel', 'Heavy structural TMT bar', 67.00, 'kg', 'https://images.unsplash.com/photo-1535813547-99c456a41d4a?w=600'),
    ('c8000000-0000-4000-8000-000000000023'::uuid, 'Steel & TMT Bars', 'Binding Wire 18 Gauge', 'Generic', 'Annealed iron wire', 92.00, 'kg', 'https://images.unsplash.com/photo-1535813547-99c456a41d4a?w=600'),
    ('c8000000-0000-4000-8000-000000000024'::uuid, 'Steel & TMT Bars', '8mm Fe550D TMT Rebar (12m)', 'TATA Tiscon', 'Stirrup reinforcement bar', 70.00, 'kg', 'https://images.unsplash.com/photo-1535813547-99c456a41d4a?w=600'),
    ('c8000000-0000-4000-8000-000000000031'::uuid, 'Bricks & Blocks', 'Red Clay Wire-Cut Bricks', 'Kiln Prime', 'Red bricks for masonry', 9.50, 'piece', 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=600'),
    ('c8000000-0000-4000-8000-000000000032'::uuid, 'Bricks & Blocks', 'AAC Blocks 600x200x150mm', 'Godrej', 'Lightweight concrete blocks', 62.00, 'piece', 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=600'),
    ('c8000000-0000-4000-8000-000000000041'::uuid, 'Tiles & Flooring', 'Double Charge Vitrified Tile 2x2 ft', 'Kajaria', 'Stain-resistant floor tiles', 52.00, 'sqft', 'https://images.unsplash.com/photo-1615873968403-89e068629265?w=600'),
    ('c8000000-0000-4000-8000-000000000042'::uuid, 'Tiles & Flooring', 'Tile Adhesive (20kg)', 'Roff', 'Tile fixing adhesive', 420.00, 'bag', 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=600'),
    ('c8000000-0000-4000-8000-000000000043'::uuid, 'Tiles & Flooring', 'Waterproofing Compound 5L', 'Dr. Fixit', 'Liquid waterproofing compound', 650.00, 'can', 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=600'),
    ('c8000000-0000-4000-8000-000000000051'::uuid, 'Plumbing', '1 inch CPVC Pipe (3 meter)', 'Astral', 'CPVC plumbing pipe', 310.00, 'piece', 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600'),
    ('c8000000-0000-4000-8000-000000000052'::uuid, 'Plumbing', '1000L Triple Layer Water Tank', 'Sintex', 'Overhead water tank', 5800.00, 'piece', 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600'),
    ('c8000000-0000-4000-8000-000000000061'::uuid, 'Electricals', '2.5 sq mm FR Copper Wire (90m)', 'Finolex', 'Copper wire', 2450.00, 'box', 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=600'),
    ('c8000000-0000-4000-8000-000000000062'::uuid, 'Electricals', '6A Modular Switch White', 'Anchor Roma', 'Modular switch', 45.00, 'piece', 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=600')
) as p(id, cat_name, name, brand, description, price, unit_type, image_url)
join public.categories c on c.name = p.cat_name
on conflict (id) do update set 
  price_per_unit = excluded.price_per_unit, 
  unit_type = excluded.unit_type,
  name = excluded.name, 
  brand = excluded.brand, 
  description = excluded.description;

insert into public.stock_transactions (product_id, type, quantity, supplier_or_order_ref, notes, tx_date) values
  ('c8000000-0000-4000-8000-000000000011', 'IN', 1500.0000, 'SRV-10466', 'Opening stock', current_date - interval '25 days'),
  ('c8000000-0000-4000-8000-000000000012', 'IN', 1100.0000, 'SRV-10467', 'Opening stock', current_date - interval '25 days'),
  ('c8000000-0000-4000-8000-000000000013', 'IN', 50.0000,   'SRV-10468', 'Opening stock', current_date - interval '20 days'),
  ('c8000000-0000-4000-8000-000000000021', 'IN', 12000.0000,'SRV-10469', 'Opening stock', current_date - interval '18 days'),
  ('c8000000-0000-4000-8000-000000000022', 'IN', 8000.0000, 'SRV-10470', 'Opening stock', current_date - interval '18 days'),
  ('c8000000-0000-4000-8000-000000000023', 'IN', 500.0000,  'SRV-10471', 'Opening stock', current_date - interval '15 days'),
  ('c8000000-0000-4000-8000-000000000024', 'IN', 4000.0000, 'SRV-10472', 'Opening stock', current_date - interval '15 days'),
  ('c8000000-0000-4000-8000-000000000031', 'IN', 25000.0000,'SRV-10473', 'Opening stock', current_date - interval '12 days'),
  ('c8000000-0000-4000-8000-000000000032', 'IN', 3000.0000, 'SRV-10474', 'Opening stock', current_date - interval '12 days'),
  ('c8000000-0000-4000-8000-000000000041', 'IN', 8000.0000, 'SRV-10475', 'Opening stock', current_date - interval '10 days'),
  ('c8000000-0000-4000-8000-000000000042', 'IN', 400.0000,  'SRV-10476', 'Opening stock', current_date - interval '10 days'),
  ('c8000000-0000-4000-8000-000000000043', 'IN', 150.0000,  'SRV-10477', 'Opening stock', current_date - interval '10 days'),
  ('c8000000-0000-4000-8000-000000000051', 'IN', 600.0000,  'SRV-10478', 'Opening stock', current_date - interval '8 days'),
  ('c8000000-0000-4000-8000-000000000052', 'IN', 25.0000,   'SRV-10479', 'Opening stock', current_date - interval '8 days'),
  ('c8000000-0000-4000-8000-000000000061', 'IN', 80.0000,   'SRV-10480', 'Opening stock', current_date - interval '5 days'),
  ('c8000000-0000-4000-8000-000000000062', 'IN', 500.0000,  'SRV-10481', 'Opening stock', current_date - interval '5 days');