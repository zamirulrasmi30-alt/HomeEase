-- ───────────────────────────────────────────────
-- HomeEase — Supabase Database Schema
-- Run this in the Supabase SQL Editor for your project
-- ───────────────────────────────────────────────

-- SERVICES TABLE
create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text unique not null,
  description text,
  price numeric(10,2) default 0,
  icon text default 'fa-tools',
  model_url text,
  image text,
  created_at timestamptz default now()
);

-- Migration for existing projects: add image column if missing
alter table services add column if not exists image text;

-- WORKERS TABLE
create table if not exists workers (
  id uuid primary key default gen_random_uuid(),
  service_id uuid references services(id) on delete cascade,
  name text not null,
  phone text,
  experience int default 0,
  rating numeric(3,2) default 0,
  photo_url text,
  id_card_url text,
  skill text default '',
  skill_level text default 'beginner',
  hourly_rate numeric(10,2) default 0,
  status text default 'active',
  created_at timestamptz default now()
);

-- Migration: add new worker columns if missing
alter table workers add column if not exists skill text default '';
alter table workers add column if not exists skill_level text default 'beginner';
alter table workers add column if not exists hourly_rate numeric(10,2) default 0;
alter table workers add column if not exists status text default 'active';

-- REVIEWS TABLE
create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid references workers(id) on delete cascade,
  user_name text,
  rating int check (rating between 1 and 5),
  comment text,
  created_at timestamptz default now()
);

-- BOOKINGS TABLE
create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  service_id uuid references services(id) on delete set null,
  worker_id uuid references workers(id) on delete set null,
  user_name text not null,
  user_phone text,
  customer_email text default '',
  address text default '',
  service_name text default '',
  worker_name text default '',
  labor_name text default '',
  booking_date date not null,
  booking_time text,
  status text default 'pending',
  notes text default '',
  amount numeric(10,2) default 0,
  visiting_fee numeric(10,2) default 0,
  booking_type text default 'fixed',
  created_at timestamptz default now()
);

-- Safe backfill for new booking columns (idempotent, re-runnable)
alter table bookings add column if not exists customer_email text default '';
alter table bookings add column if not exists address text default '';
alter table bookings add column if not exists service_name text default '';
alter table bookings add column if not exists worker_name text default '';
alter table bookings add column if not exists labor_name text default '';

-- Inspection-based pricing fields (₹199 visiting fee, quoted on-site)
alter table bookings add column if not exists visiting_fee numeric(10,2) default 0;
alter table bookings add column if not exists booking_type text default 'fixed';
update bookings set booking_type = 'fixed' where coalesce(booking_type, '') = '';

-- Row Level Security: allow full access via anon key for this demo.
alter table services enable row level security;
alter table workers enable row level security;
alter table reviews enable row level security;
alter table bookings enable row level security;

create policy "public services" on services for select using (true);
create policy "public services write" on services for all using (true) with check (true);
create policy "public workers" on workers for all using (true) with check (true);
create policy "public reviews" on reviews for all using (true) with check (true);
create policy "public bookings" on bookings for all using (true) with check (true);

-- Seed services (includes high-res visual image from Unsplash)
insert into services (title, category, description, price, icon, image) values
  ('Home Cleaning', 'cleaning', 'Professional home cleaning services for a spotless living space.', 49, 'fa-broom', 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80'),
  ('AC Mechanic', 'ac-mechanic', 'Expert AC repair, installation, and maintenance services.', 79, 'fa-snowflake', 'https://images.unsplash.com/photo-1603366591683-a5abc153411f?auto=format&fit=crop&w=1200&q=80'),
  ('Vehicle Mechanic', 'vehicle-mechanic', 'Skilled mechanics for all types of vehicle repairs and servicing.', 99, 'fa-car', 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&w=1200&q=80'),
  ('Plumber', 'plumber', 'Reliable plumbing solutions for leaks, installations, and repairs.', 69, 'fa-faucet', 'https://images.unsplash.com/photo-1585704032915-c3400ca199e7?auto=format&fit=crop&w=1200&q=80'),
  ('Electrician', 'electrician', 'Certified electricians for wiring, fixtures, and electrical repairs.', 89, 'fa-bolt', 'https://images.unsplash.com/photo-1548962727-4b25973b73f2?auto=format&fit=crop&w=1200&q=80')
on conflict (category) do nothing;

-- Backfill image URLs on existing rows (safe to re-run)
update services set image = case category
  when 'cleaning' then 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80'
  when 'ac-mechanic' then 'https://images.unsplash.com/photo-1603366591683-a5abc153411f?auto=format&fit=crop&w=1200&q=80'
  when 'vehicle-mechanic' then 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&w=1200&q=80'
  when 'plumber' then 'https://images.unsplash.com/photo-1585704032915-c3400ca199e7?auto=format&fit=crop&w=1200&q=80'
  when 'electrician' then 'https://images.unsplash.com/photo-1548962727-4b25973b73f2?auto=format&fit=crop&w=1200&q=80'
end
where category in ('cleaning', 'ac-mechanic', 'vehicle-mechanic', 'plumber', 'electrician') and coalesce(image, '') = '';

-- Seed workers
insert into workers (service_id, name, phone, experience, rating) values
  ((select id from services where category = 'ac-mechanic'), 'Rajesh Kumar', '+91 98765 43210', 8, 4.7),
  ((select id from services where category = 'ac-mechanic'), 'Amit Singh', '+91 87654 32109', 5, 4.3),
  ((select id from services where category = 'cleaning'), 'Priya Sharma', '+91 76543 21098', 3, 4.8),
  ((select id from services where category = 'vehicle-mechanic'), 'Vikram Patel', '+91 65432 10987', 12, 4.9),
  ((select id from services where category = 'plumber'), 'Suresh Reddy', '+91 54321 09876', 7, 4.5),
  ((select id from services where category = 'electrician'), 'Anil Mehta', '+91 43210 98765', 10, 4.6),
  ((select id from services where category = 'electrician'), 'Deepak Joshi', '+91 32109 87654', 4, 4.2),
  ((select id from services where category = 'plumber'), 'Manoj Gupta', '+91 21098 76543', 6, 4.4)
on conflict do nothing;

-- Backfill new worker columns (safe to re-run)
update workers set skill = 'HVAC Repair' where service_id = (select id from services where category = 'ac-mechanic') and coalesce(skill, '') = '';
update workers set skill = 'Home Cleaning' where service_id = (select id from services where category = 'cleaning') and coalesce(skill, '') = '';
update workers set skill = 'Auto Repair' where service_id = (select id from services where category = 'vehicle-mechanic') and coalesce(skill, '') = '';
update workers set skill = 'Pipe Fitting' where service_id = (select id from services where category = 'plumber') and coalesce(skill, '') = '';
update workers set skill = 'Wiring & Fixtures' where service_id = (select id from services where category = 'electrician') and coalesce(skill, '') = '';

update workers set skill_level = case
  when experience >= 8 then 'expert'
  when experience >= 4 then 'intermediate'
  else 'beginner'
end
where coalesce(skill_level, '') = '' or skill_level = 'beginner';

update workers set hourly_rate = case
  when experience >= 8 then 500
  when experience >= 4 then 350
  else 200
end
where coalesce(hourly_rate, 0) = 0;

update workers set status = 'active' where coalesce(status, '') = '';

-- Seed bookings
insert into bookings (service_id, worker_id, user_name, user_phone, customer_email, address, service_name, labor_name, booking_date, booking_time, status, amount, notes, created_at) values
  ((select id from services where category = 'cleaning'), (select id from workers where name = 'Priya Sharma'), 'Rahul Verma', '+91 99887 76655', 'rahul.verma@example.com', '12 Green Park, New Delhi', 'Home Cleaning', 'Priya Sharma', current_date + interval '2 days', '10:00 AM', 'pending', 249, '2BHK deep cleaning', now() - interval '3 hours'),
  ((select id from services where category = 'ac-mechanic'), (select id from workers where name = 'Rajesh Kumar'), 'Neha Gupta', '+91 88776 65544', 'neha.gupta@example.com', '8/4 Lajpat Nagar, New Delhi', 'AC Mechanic', 'Rajesh Kumar', current_date + interval '1 day', '02:00 PM', 'assigned', 579, 'AC not cooling properly', now() - interval '1 day'),
  ((select id from services where category = 'plumber'), (select id from workers where name = 'Suresh Reddy'), 'Arun Nair', '+91 77665 54433', 'arun.nair@example.com', '55 MG Road, Bengaluru', 'Plumber', 'Suresh Reddy', current_date, '11:00 AM', 'completed', 419, 'Kitchen sink leak', now() - interval '2 days'),
  ((select id from services where category = 'electrician'), (select id from workers where name = 'Anil Mehta'), 'Sanjay Rao', '+91 66554 43322', 'sanjay.rao@example.com', '21 Anna Nagar, Chennai', 'Electrician', 'Anil Mehta', current_date + interval '3 days', '09:00 AM', 'pending', 589, 'Full house rewiring', now() - interval '4 hours'),
  ((select id from services where category = 'vehicle-mechanic'), (select id from workers where name = 'Vikram Patel'), 'Pooja Das', '+91 55443 32211', 'pooja.das@example.com', '7 Sector 15, Gurugram', 'Vehicle Mechanic', 'Vikram Patel', current_date + interval '1 day', '04:00 PM', 'cancelled', 599, 'Car brake issue', now() - interval '5 days'),
  ((select id from services where category = 'cleaning'), (select id from workers where name = 'Priya Sharma'), 'Vikash Singh', '+91 44332 21100', 'vikash.singh@example.com', '102 Boring Road, Patna', 'Home Cleaning', 'Priya Sharma', current_date + interval '4 days', '08:00 AM', 'pending', 249, 'Office cleaning', now() - interval '2 hours'),
  ((select id from services where category = 'ac-mechanic'), (select id from workers where name = 'Amit Singh'), 'Meera Joshi', '+91 33221 10099', 'meera.joshi@example.com', '34 Civil Lines, Jaipur', 'AC Mechanic', 'Amit Singh', current_date + interval '2 days', '03:00 PM', 'completed', 579, 'AC installation', now() - interval '3 days'),
  ((select id from services where category = 'plumber'), (select id from workers where name = 'Manoj Gupta'), 'Karan Malhotra', '+91 22110 09988', 'karan.malhotra@example.com', '18 Boat Club Road, Pune', 'Plumber', 'Manoj Gupta', current_date + interval '5 days', '01:00 PM', 'assigned', 419, 'Bathroom renovation piping', now() - interval '1 day')
on conflict do nothing;

-- Backfill worker_name for booking rows that predate the column
update bookings set worker_name = coalesce(nullif(worker_name, ''), labor_name, '')
where coalesce(worker_name, '') = '' and coalesce(labor_name, '') <> '';