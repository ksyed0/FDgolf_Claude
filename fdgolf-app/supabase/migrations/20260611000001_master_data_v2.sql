-- ============================================================
-- FDgolf: Master Data V2 — Venues / Courses / Holes rebuild
-- Plan: Master Data V2, Task 1
-- Created: 2026-06-11
-- ============================================================
-- Changes:
--   1. Drop old holes + courses tables (CASCADE removes FK refs)
--   2. Create venues table
--   3. Recreate courses with venue_id FK
--   4. Recreate holes with JSONB tees, handicap (was stroke_index)
--   5. Add venue_id + course_id to tournaments; drop text venue column
--   6. Enable RLS + policies on venues, courses, holes
-- ============================================================

-- 1. Remove old tables (cascade clears FK refs in tournaments, tournament_clubs, etc.)
DROP TABLE IF EXISTS holes CASCADE;
DROP TABLE IF EXISTS courses CASCADE;

-- 2. Create venues
CREATE TABLE venues (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name           TEXT        NOT NULL,
  address1       TEXT,
  address2       TEXT,
  city           TEXT,
  state_province TEXT,
  zip_postal     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Recreate courses with venue_id
CREATE TABLE courses (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  venue_id      UUID        NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,
  holes_count   INT         NOT NULL DEFAULT 18 CHECK (holes_count IN (9, 18)),
  par_total     INT,
  course_rating NUMERIC(4,1),
  slope_rating  INT,
  tee_yardages  JSONB       NOT NULL DEFAULT '[]'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Recreate holes with JSONB tees, renamed stroke_index → handicap
CREATE TABLE holes (
  id        UUID  PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID  NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  number    INT   NOT NULL CHECK (number BETWEEN 1 AND 18),
  par       INT   NOT NULL CHECK (par BETWEEN 3 AND 5),
  handicap  INT   CHECK (handicap BETWEEN 1 AND 18),
  pin_lat   DOUBLE PRECISION,
  pin_lng   DOUBLE PRECISION,
  tees      JSONB NOT NULL DEFAULT '[]'::jsonb,
  UNIQUE (course_id, number)
);

-- 5. Add venue_id and course_id to tournaments; drop old text venue column
--    course_id already existed in initial_schema but its FK was dropped when
--    courses was dropped (CASCADE). We re-add the column idempotently, then
--    explicitly (re)attach the FK constraint.
ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS venue_id  UUID REFERENCES venues(id)  ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS course_id UUID;

-- Re-attach (or attach for first time) the FK on course_id to the new courses table.
-- Drop first so reset replays are idempotent.
ALTER TABLE tournaments
  DROP CONSTRAINT IF EXISTS tournaments_course_id_fkey;

ALTER TABLE tournaments
  ADD CONSTRAINT tournaments_course_id_fkey
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL;

ALTER TABLE tournaments
  DROP COLUMN IF EXISTS venue;

-- 6. RLS
ALTER TABLE venues  ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE holes   ENABLE ROW LEVEL SECURITY;

-- Admins can do everything; public reads venues, courses, holes
CREATE POLICY "admins_all_venues"   ON venues  FOR ALL  USING (fdgolf_is_admin());
CREATE POLICY "public_read_venues"  ON venues  FOR SELECT USING (true);

CREATE POLICY "admins_all_courses"  ON courses FOR ALL  USING (fdgolf_is_admin());
CREATE POLICY "public_read_courses" ON courses FOR SELECT USING (true);

CREATE POLICY "admins_all_holes"    ON holes   FOR ALL  USING (fdgolf_is_admin());
CREATE POLICY "public_read_holes"   ON holes   FOR SELECT USING (true);
