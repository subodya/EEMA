-- =====================================================================
-- Migration 004: Sanya kaftan in blue tie-dye + category tab order
-- Run once in Supabase → SQL Editor. Safe to re-run.
-- =====================================================================

-- Sanya Sunset Spiral Kaftan: two tie-dye colourways, one photo each (same order),
-- so choosing a colour on the product page shows its photo.
-- The blue photo ships with the site at images/products/.
update public.products
set colors = '[{"name":"Tangerine","hex":"#db6024"},{"name":"Blue","hex":"#1d5bbf"}]'::jsonb,
    images = array[images[1], 'images/products/sanya-sunset-spiral-kaftan-blue.webp']
where slug = 'sanya-sunset-spiral-kaftan';

-- Category tabs on the Collections page: All | Ladies | Gents | Kids
update public.categories set sort_order = 1 where slug = 'ladies';
update public.categories set sort_order = 2 where slug = 'gents';
update public.categories set sort_order = 3 where slug = 'kids';
