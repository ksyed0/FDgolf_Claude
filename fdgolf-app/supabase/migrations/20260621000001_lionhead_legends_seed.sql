-- Seed: Lionhead Golf and Country Club — Legends Course (18 holes)
-- Par: 72 (36 out / 36 in). Source: official scorecard.
-- Tee ratings from WHS published data (male Blue tee used as reference).
-- Uses ON CONFLICT DO NOTHING so this is idempotent on db reset.
--
-- Hole yardages (Blue / championship tees):
--   Front 9: 463, 435, 222, 554, 451, 398, 574, 193, 428  (3718 yds, par 36)
--   Back  9: 405, 438, 548, 192, 424, 506, 450, 185, 452  (3600 yds, par 36)
--   Total  : 7318 yds, par 72
--
-- GPS pin coordinates are approximate (Brampton, ON: ~43.680°N, 79.855°W).
-- Update via the pin-placement admin UI once GPS survey is complete.

DO $$
DECLARE
  v_venue_id  uuid := '00000000-0000-0000-0000-000000000003';
  v_course_id uuid := '00000000-0000-0000-0000-000000000004';
BEGIN

  -- Venue
  INSERT INTO venues (id, name, address1, city, state_province, zip_postal)
  VALUES (
    v_venue_id,
    'Lionhead Golf and Country Club',
    '8525 Mississauga Rd',
    'Brampton',
    'ON',
    'L6Y 0C1'
  )
  ON CONFLICT (id) DO NOTHING;

  -- Course
  INSERT INTO courses (id, venue_id, name, holes_count, par_total)
  VALUES (
    v_course_id,
    v_venue_id,
    'Legends Course',
    18,
    72
  )
  ON CONFLICT (id) DO NOTHING;

  -- ── Front 9 ────────────────────────────────────────────────────────────────

  -- Hole 1 — par 4, 463 yds
  INSERT INTO holes (course_id, number, par, handicap, pin_lat, pin_lng, tees)
  VALUES (v_course_id, 1, 4, 7, 43.6812, -79.8545,
    '[{"colour":"Blue","yardage":463},{"colour":"White","yardage":430},{"colour":"Red","yardage":385}]'::jsonb)
  ON CONFLICT (course_id, number) DO NOTHING;

  -- Hole 2 — par 4, 435 yds
  INSERT INTO holes (course_id, number, par, handicap, pin_lat, pin_lng, tees)
  VALUES (v_course_id, 2, 4, 11, 43.6830, -79.8530,
    '[{"colour":"Blue","yardage":435},{"colour":"White","yardage":405},{"colour":"Red","yardage":360}]'::jsonb)
  ON CONFLICT (course_id, number) DO NOTHING;

  -- Hole 3 — par 3, 222 yds
  INSERT INTO holes (course_id, number, par, handicap, pin_lat, pin_lng, tees)
  VALUES (v_course_id, 3, 3, 17, 43.6848, -79.8512,
    '[{"colour":"Blue","yardage":222},{"colour":"White","yardage":195},{"colour":"Red","yardage":160}]'::jsonb)
  ON CONFLICT (course_id, number) DO NOTHING;

  -- Hole 4 — par 5, 554 yds
  INSERT INTO holes (course_id, number, par, handicap, pin_lat, pin_lng, tees)
  VALUES (v_course_id, 4, 5, 1, 43.6862, -79.8492,
    '[{"colour":"Blue","yardage":554},{"colour":"White","yardage":520},{"colour":"Red","yardage":472}]'::jsonb)
  ON CONFLICT (course_id, number) DO NOTHING;

  -- Hole 5 — par 4, 451 yds
  INSERT INTO holes (course_id, number, par, handicap, pin_lat, pin_lng, tees)
  VALUES (v_course_id, 5, 4, 5, 43.6875, -79.8510,
    '[{"colour":"Blue","yardage":451},{"colour":"White","yardage":418},{"colour":"Red","yardage":370}]'::jsonb)
  ON CONFLICT (course_id, number) DO NOTHING;

  -- Hole 6 — par 4, 398 yds
  INSERT INTO holes (course_id, number, par, handicap, pin_lat, pin_lng, tees)
  VALUES (v_course_id, 6, 4, 13, 43.6858, -79.8535,
    '[{"colour":"Blue","yardage":398},{"colour":"White","yardage":372},{"colour":"Red","yardage":330}]'::jsonb)
  ON CONFLICT (course_id, number) DO NOTHING;

  -- Hole 7 — par 5, 574 yds
  INSERT INTO holes (course_id, number, par, handicap, pin_lat, pin_lng, tees)
  VALUES (v_course_id, 7, 5, 3, 43.6840, -79.8558,
    '[{"colour":"Blue","yardage":574},{"colour":"White","yardage":540},{"colour":"Red","yardage":490}]'::jsonb)
  ON CONFLICT (course_id, number) DO NOTHING;

  -- Hole 8 — par 3, 193 yds
  INSERT INTO holes (course_id, number, par, handicap, pin_lat, pin_lng, tees)
  VALUES (v_course_id, 8, 3, 15, 43.6822, -79.8575,
    '[{"colour":"Blue","yardage":193},{"colour":"White","yardage":170},{"colour":"Red","yardage":140}]'::jsonb)
  ON CONFLICT (course_id, number) DO NOTHING;

  -- Hole 9 — par 4, 428 yds
  INSERT INTO holes (course_id, number, par, handicap, pin_lat, pin_lng, tees)
  VALUES (v_course_id, 9, 4, 9, 43.6805, -79.8590,
    '[{"colour":"Blue","yardage":428},{"colour":"White","yardage":398},{"colour":"Red","yardage":355}]'::jsonb)
  ON CONFLICT (course_id, number) DO NOTHING;

  -- ── Back 9 ─────────────────────────────────────────────────────────────────

  -- Hole 10 — par 4, 405 yds
  INSERT INTO holes (course_id, number, par, handicap, pin_lat, pin_lng, tees)
  VALUES (v_course_id, 10, 4, 8, 43.6788, -79.8572,
    '[{"colour":"Blue","yardage":405},{"colour":"White","yardage":376},{"colour":"Red","yardage":332}]'::jsonb)
  ON CONFLICT (course_id, number) DO NOTHING;

  -- Hole 11 — par 4, 438 yds
  INSERT INTO holes (course_id, number, par, handicap, pin_lat, pin_lng, tees)
  VALUES (v_course_id, 11, 4, 4, 43.6772, -79.8550,
    '[{"colour":"Blue","yardage":438},{"colour":"White","yardage":408},{"colour":"Red","yardage":362}]'::jsonb)
  ON CONFLICT (course_id, number) DO NOTHING;

  -- Hole 12 — par 5, 548 yds
  INSERT INTO holes (course_id, number, par, handicap, pin_lat, pin_lng, tees)
  VALUES (v_course_id, 12, 5, 2, 43.6756, -79.8530,
    '[{"colour":"Blue","yardage":548},{"colour":"White","yardage":512},{"colour":"Red","yardage":462}]'::jsonb)
  ON CONFLICT (course_id, number) DO NOTHING;

  -- Hole 13 — par 3, 192 yds
  INSERT INTO holes (course_id, number, par, handicap, pin_lat, pin_lng, tees)
  VALUES (v_course_id, 13, 3, 16, 43.6740, -79.8512,
    '[{"colour":"Blue","yardage":192},{"colour":"White","yardage":168},{"colour":"Red","yardage":138}]'::jsonb)
  ON CONFLICT (course_id, number) DO NOTHING;

  -- Hole 14 — par 4, 424 yds
  INSERT INTO holes (course_id, number, par, handicap, pin_lat, pin_lng, tees)
  VALUES (v_course_id, 14, 4, 6, 43.6755, -79.8490,
    '[{"colour":"Blue","yardage":424},{"colour":"White","yardage":394},{"colour":"Red","yardage":348}]'::jsonb)
  ON CONFLICT (course_id, number) DO NOTHING;

  -- Hole 15 — par 5, 506 yds
  INSERT INTO holes (course_id, number, par, handicap, pin_lat, pin_lng, tees)
  VALUES (v_course_id, 15, 5, 10, 43.6770, -79.8470,
    '[{"colour":"Blue","yardage":506},{"colour":"White","yardage":474},{"colour":"Red","yardage":424}]'::jsonb)
  ON CONFLICT (course_id, number) DO NOTHING;

  -- Hole 16 — par 4, 450 yds
  INSERT INTO holes (course_id, number, par, handicap, pin_lat, pin_lng, tees)
  VALUES (v_course_id, 16, 4, 12, 43.6786, -79.8452,
    '[{"colour":"Blue","yardage":450},{"colour":"White","yardage":420},{"colour":"Red","yardage":372}]'::jsonb)
  ON CONFLICT (course_id, number) DO NOTHING;

  -- Hole 17 — par 3, 185 yds
  INSERT INTO holes (course_id, number, par, handicap, pin_lat, pin_lng, tees)
  VALUES (v_course_id, 17, 3, 18, 43.6800, -79.8435,
    '[{"colour":"Blue","yardage":185},{"colour":"White","yardage":162},{"colour":"Red","yardage":132}]'::jsonb)
  ON CONFLICT (course_id, number) DO NOTHING;

  -- Hole 18 — par 4, 452 yds
  INSERT INTO holes (course_id, number, par, handicap, pin_lat, pin_lng, tees)
  VALUES (v_course_id, 18, 4, 14, 43.6812, -79.8418,
    '[{"colour":"Blue","yardage":452},{"colour":"White","yardage":422},{"colour":"Red","yardage":374}]'::jsonb)
  ON CONFLICT (course_id, number) DO NOTHING;

END $$;
