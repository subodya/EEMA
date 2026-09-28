-- =====================================================================
-- Migration 002: product sizes (for the product detail page size picker)
-- Run once in Supabase → SQL Editor if you already ran schema.sql before
-- this change. Safe to re-run.
-- =====================================================================

alter table public.products
  add column if not exists sizes text[] not null default '{}';

-- Give existing Ladies products the standard size run (only where none set yet)
update public.products p
set sizes = '{XS,S,M,L,XL}'
from public.categories c
where p.category_id = c.id
  and c.slug = 'ladies'
  and p.sizes = '{}';
