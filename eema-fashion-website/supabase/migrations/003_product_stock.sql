-- =====================================================================
-- Migration 003: in-stock flag (admin "In stock / Out of stock" switch)
-- Run once in Supabase → SQL Editor. Safe to re-run.
-- Out-of-stock products stay visible on the site, clearly marked, with a
-- "Ask about restock" WhatsApp button instead of an order button.
-- =====================================================================

alter table public.products
  add column if not exists in_stock boolean not null default true;
