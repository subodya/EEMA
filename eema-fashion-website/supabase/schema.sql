-- =====================================================================
-- EEMA Fashion — product catalog schema
-- Run once in Supabase Dashboard → SQL Editor (then run seed.sql).
-- Safe to re-run: uses IF NOT EXISTS / OR REPLACE / DROP POLICY IF EXISTS.
-- =====================================================================

-- ---------- Tables ----------------------------------------------------

create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.products (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  slug         text not null unique,
  short_note   text,                         -- one-line subtitle under the name on cards
  description  text,
  price        integer not null check (price >= 0),   -- LKR, whole rupees
  category_id  uuid references public.categories(id) on delete restrict,
  tags         text[] not null default '{}',  -- e.g. {pure-linen,batik,coords,dresses,tailored}
  fabric       text,
  colors       jsonb not null default '[]',   -- [{"name":"Rose Guava","hex":"#f28e8e"}]
  sizes        text[] not null default '{}',  -- e.g. {XS,S,M,L,XL} or {2-3Y,4-5Y}; empty = made to measure only
  images       text[] not null default '{}',  -- public URLs, first = cover
  is_published boolean not null default true,
  is_featured  boolean not null default false,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Added after the first release; keeps older databases in step when schema.sql is re-run
alter table public.products add column if not exists sizes text[] not null default '{}';

create index if not exists products_category_idx  on public.products (category_id);
create index if not exists products_published_idx on public.products (is_published, sort_order);

create table if not exists public.admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ---------- updated_at trigger ---------------------------------------

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists products_touch_updated_at on public.products;
create trigger products_touch_updated_at
  before update on public.products
  for each row execute function public.touch_updated_at();

-- ---------- Admin check helper ---------------------------------------
-- SECURITY DEFINER so policies can read `admins` without exposing it.

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- ---------- Row Level Security ---------------------------------------

alter table public.categories enable row level security;
alter table public.products   enable row level security;
alter table public.admins     enable row level security;

-- categories: everyone reads, admins write
drop policy if exists "categories public read" on public.categories;
create policy "categories public read" on public.categories
  for select using (true);

drop policy if exists "categories admin write" on public.categories;
create policy "categories admin write" on public.categories
  for all using (public.is_admin()) with check (public.is_admin());

-- products: everyone reads published rows, admins read/write everything
drop policy if exists "products public read" on public.products;
create policy "products public read" on public.products
  for select using (is_published or public.is_admin());

drop policy if exists "products admin write" on public.products;
create policy "products admin write" on public.products
  for all using (public.is_admin()) with check (public.is_admin());

-- admins: a signed-in user may only see their own row (used by the admin login check)
drop policy if exists "admins read self" on public.admins;
create policy "admins read self" on public.admins
  for select using (user_id = auth.uid());

-- ---------- Storage bucket for product photos ------------------------

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true;

drop policy if exists "product images public read" on storage.objects;
create policy "product images public read" on storage.objects
  for select using (bucket_id = 'product-images');

drop policy if exists "product images admin insert" on storage.objects;
create policy "product images admin insert" on storage.objects
  for insert with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "product images admin update" on storage.objects;
create policy "product images admin update" on storage.objects
  for update using (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "product images admin delete" on storage.objects;
create policy "product images admin delete" on storage.objects
  for delete using (bucket_id = 'product-images' and public.is_admin());

-- ---------- Make yourself an admin -----------------------------------
-- 1. Authentication → Users → "Add user" (email + password, auto-confirm).
-- 2. Then run (replace the email):
--
--   insert into public.admins (user_id)
--   select id from auth.users where email = 'owner@example.com';
