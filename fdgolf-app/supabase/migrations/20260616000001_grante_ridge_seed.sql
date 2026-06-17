-- Seed: Grante Ridge Golf Club — Ruby Course (18 holes)
-- Par: 70 (35 out / 35 in). Blue: 5747 yds, White: 5300 yds, Red: 4649 yds.
-- Stroke index (SI) sourced from official scorecard.
-- Uses ON CONFLICT DO NOTHING so this is idempotent on db reset.

DO $$
DECLARE
  v_venue_id  uuid;
  v_course_id uuid;
BEGIN
  -- Venue
  -- NOTE: venues has no `country` column (see 20260611000001_master_data_v2.sql) —
  -- address fields are address1/address2/city/state_province/zip_postal only.
  -- Dropped the stray `country` value that broke `supabase db reset` (BUG-0021).
  INSERT INTO venues (id, name, address1, city, state_province, zip_postal)
  VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Grante Ridge Golf Club',
    '1 Grante Ridge Dr',
    'Caledon',
    'ON',
    'L7K 0Z7'
  )
  ON CONFLICT (id) DO NOTHING;

  v_venue_id := '00000000-0000-0000-0000-000000000001';

  -- Course
  INSERT INTO courses (id, venue_id, name, holes_count, par_total)
  VALUES (
    '00000000-0000-0000-0000-000000000002',
    v_venue_id,
    'Ruby Course',
    18,
    70
  )
  ON CONFLICT (id) DO NOTHING;

  v_course_id := '00000000-0000-0000-0000-000000000002';

  -- Holes (par, handicap/stroke-index, Blue/White/Red tee yardages)
  -- Hole 1
  INSERT INTO holes (course_id, number, par, handicap, tees)
  VALUES (v_course_id, 1, 4, 13,
    '[{"colour":"Blue","yardage":285},{"colour":"White","yardage":280},{"colour":"Red","yardage":243}]'::jsonb)
  ON CONFLICT (course_id, number) DO NOTHING;

  -- Hole 2
  INSERT INTO holes (course_id, number, par, handicap, tees)
  VALUES (v_course_id, 2, 4, 17,
    '[{"colour":"Blue","yardage":314},{"colour":"White","yardage":303},{"colour":"Red","yardage":277}]'::jsonb)
  ON CONFLICT (course_id, number) DO NOTHING;

  -- Hole 3
  INSERT INTO holes (course_id, number, par, handicap, tees)
  VALUES (v_course_id, 3, 3, 15,
    '[{"colour":"Blue","yardage":170},{"colour":"White","yardage":150},{"colour":"Red","yardage":120}]'::jsonb)
  ON CONFLICT (course_id, number) DO NOTHING;

  -- Hole 4
  INSERT INTO holes (course_id, number, par, handicap, tees)
  VALUES (v_course_id, 4, 5, 1,
    '[{"colour":"Blue","yardage":523},{"colour":"White","yardage":505},{"colour":"Red","yardage":472}]'::jsonb)
  ON CONFLICT (course_id, number) DO NOTHING;

  -- Hole 5
  INSERT INTO holes (course_id, number, par, handicap, tees)
  VALUES (v_course_id, 5, 4, 3,
    '[{"colour":"Blue","yardage":358},{"colour":"White","yardage":340},{"colour":"Red","yardage":275}]'::jsonb)
  ON CONFLICT (course_id, number) DO NOTHING;

  -- Hole 6
  INSERT INTO holes (course_id, number, par, handicap, tees)
  VALUES (v_course_id, 6, 4, 9,
    '[{"colour":"Blue","yardage":361},{"colour":"White","yardage":332},{"colour":"Red","yardage":297}]'::jsonb)
  ON CONFLICT (course_id, number) DO NOTHING;

  -- Hole 7
  INSERT INTO holes (course_id, number, par, handicap, tees)
  VALUES (v_course_id, 7, 4, 7,
    '[{"colour":"Blue","yardage":345},{"colour":"White","yardage":305},{"colour":"Red","yardage":276}]'::jsonb)
  ON CONFLICT (course_id, number) DO NOTHING;

  -- Hole 8
  INSERT INTO holes (course_id, number, par, handicap, tees)
  VALUES (v_course_id, 8, 4, 5,
    '[{"colour":"Blue","yardage":348},{"colour":"White","yardage":293},{"colour":"Red","yardage":257}]'::jsonb)
  ON CONFLICT (course_id, number) DO NOTHING;

  -- Hole 9
  INSERT INTO holes (course_id, number, par, handicap, tees)
  VALUES (v_course_id, 9, 3, 11,
    '[{"colour":"Blue","yardage":168},{"colour":"White","yardage":155},{"colour":"Red","yardage":127}]'::jsonb)
  ON CONFLICT (course_id, number) DO NOTHING;

  -- Hole 10
  INSERT INTO holes (course_id, number, par, handicap, tees)
  VALUES (v_course_id, 10, 4, 4,
    '[{"colour":"Blue","yardage":413},{"colour":"White","yardage":383},{"colour":"Red","yardage":356}]'::jsonb)
  ON CONFLICT (course_id, number) DO NOTHING;

  -- Hole 11
  INSERT INTO holes (course_id, number, par, handicap, tees)
  VALUES (v_course_id, 11, 4, 12,
    '[{"colour":"Blue","yardage":304},{"colour":"White","yardage":293},{"colour":"Red","yardage":225}]'::jsonb)
  ON CONFLICT (course_id, number) DO NOTHING;

  -- Hole 12
  INSERT INTO holes (course_id, number, par, handicap, tees)
  VALUES (v_course_id, 12, 3, 16,
    '[{"colour":"Blue","yardage":151},{"colour":"White","yardage":119},{"colour":"Red","yardage":90}]'::jsonb)
  ON CONFLICT (course_id, number) DO NOTHING;

  -- Hole 13
  INSERT INTO holes (course_id, number, par, handicap, tees)
  VALUES (v_course_id, 13, 5, 2,
    '[{"colour":"Blue","yardage":502},{"colour":"White","yardage":483},{"colour":"Red","yardage":459}]'::jsonb)
  ON CONFLICT (course_id, number) DO NOTHING;

  -- Hole 14
  INSERT INTO holes (course_id, number, par, handicap, tees)
  VALUES (v_course_id, 14, 4, 8,
    '[{"colour":"Blue","yardage":368},{"colour":"White","yardage":325},{"colour":"Red","yardage":277}]'::jsonb)
  ON CONFLICT (course_id, number) DO NOTHING;

  -- Hole 15
  INSERT INTO holes (course_id, number, par, handicap, tees)
  VALUES (v_course_id, 15, 4, 6,
    '[{"colour":"Blue","yardage":396},{"colour":"White","yardage":345},{"colour":"Red","yardage":310}]'::jsonb)
  ON CONFLICT (course_id, number) DO NOTHING;

  -- Hole 16
  INSERT INTO holes (course_id, number, par, handicap, tees)
  VALUES (v_course_id, 16, 4, 18,
    '[{"colour":"Blue","yardage":255},{"colour":"White","yardage":243},{"colour":"Red","yardage":218}]'::jsonb)
  ON CONFLICT (course_id, number) DO NOTHING;

  -- Hole 17
  INSERT INTO holes (course_id, number, par, handicap, tees)
  VALUES (v_course_id, 17, 3, 14,
    '[{"colour":"Blue","yardage":151},{"colour":"White","yardage":140},{"colour":"Red","yardage":120}]'::jsonb)
  ON CONFLICT (course_id, number) DO NOTHING;

  -- Hole 18
  INSERT INTO holes (course_id, number, par, handicap, tees)
  VALUES (v_course_id, 18, 4, 10,
    '[{"colour":"Blue","yardage":335},{"colour":"White","yardage":306},{"colour":"Red","yardage":250}]'::jsonb)
  ON CONFLICT (course_id, number) DO NOTHING;

END $$;
