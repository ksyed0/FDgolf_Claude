-- ============================================================
-- FDgolf: Master Club List Seed
-- Story: US-0008
-- Created: 2026-06-09
-- ACs: AC-0040, AC-0041, AC-0042, AC-0043
-- Depends on: 20260609000000_initial_schema.sql (clubs table)
-- ============================================================
-- This migration:
--   1. Adds a UNIQUE constraint on clubs.display_name so that
--      ON CONFLICT (display_name) DO NOTHING is valid (AC-0043).
--   2. Inserts 15 standard golf bag clubs in bag-traversal order
--      (Driver → woods → hybrid → irons → wedges → Putter).
--      Re-running is safe: ON CONFLICT ... DO NOTHING prevents
--      duplicate rows if this migration is applied more than once
--      (e.g. after supabase db reset replay).
-- ============================================================

-- ----------------------------------------------------------------
-- Step 1: Unique constraint on display_name (idempotency foundation)
-- ----------------------------------------------------------------
ALTER TABLE clubs
  ADD CONSTRAINT clubs_display_name_unique UNIQUE (display_name);

-- ----------------------------------------------------------------
-- Step 2: Insert 15 standard clubs (AC-0040, AC-0041, AC-0042)
-- display_order follows real golfer bag traversal: Driver first,
-- Putter last. Loft values are real-world standards. Putter loft
-- is NULL (no meaningful loft for putting strokes).
-- ----------------------------------------------------------------
INSERT INTO clubs (display_name, club_type, default_loft_degrees, display_order, is_active)
VALUES
  -- Woods (display_order 1-3)
  ('Driver',         'wood',   10.5,  1,  true),
  ('3-Wood',         'wood',   15,    2,  true),
  ('5-Wood',         'wood',   18,    3,  true),
  -- Hybrid (display_order 4)
  ('3-Hybrid',       'hybrid', 19,    4,  true),
  -- Irons (display_order 5-10)
  ('4-Iron',         'iron',   20,    5,  true),
  ('5-Iron',         'iron',   24,    6,  true),
  ('6-Iron',         'iron',   28,    7,  true),
  ('7-Iron',         'iron',   32,    8,  true),
  ('8-Iron',         'iron',   37,    9,  true),
  ('9-Iron',         'iron',   42,    10, true),
  -- Wedges (display_order 11-14)
  ('Pitching Wedge', 'wedge',  46,    11, true),
  ('Gap Wedge',      'wedge',  50,    12, true),
  ('Sand Wedge',     'wedge',  55,    13, true),
  ('Lob Wedge',      'wedge',  60,    14, true),
  -- Putter (display_order 15, NULL loft)
  ('Putter',         'putter', NULL,  15, true)
ON CONFLICT (display_name) DO NOTHING;
