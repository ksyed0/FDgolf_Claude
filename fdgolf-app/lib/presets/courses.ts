/**
 * Course presets — static data module (US-0012).
 *
 * Each preset describes a known golf course with 18 holes (par, handicap, tees).
 * Admins can import a preset to pre-populate the HoleEditor rather than hand-keying
 * 18 rows.
 */

export interface CourseHolePreset {
  /** Hole number (1–18) */
  number: number
  /** Par value: 3, 4, or 5 */
  par: 3 | 4 | 5
  /** Handicap / stroke index (1–18, unique within the course) */
  handicap: number
  /** Tee boxes for this hole */
  tees: ReadonlyArray<{ colour: string; yardage: number }>
}

export interface CoursePreset {
  /** Unique slug identifier for the preset */
  id: string
  /** Human-readable course name */
  name: string
  /** 18-hole data */
  holes: ReadonlyArray<CourseHolePreset>
}

/**
 * Granite Ridge GC — Preset data.
 * Par 72 layout (10× par 4, 4× par 3, 4× par 5).
 */
export const GRANITE_RIDGE_GC: CoursePreset = {
  id: 'granite-ridge-gc',
  name: 'Granite Ridge GC',
  holes: [
    { number: 1,  par: 4, handicap: 7,  tees: [{ colour: 'Blue', yardage: 385 }] },
    { number: 2,  par: 3, handicap: 15, tees: [{ colour: 'Blue', yardage: 165 }] },
    { number: 3,  par: 5, handicap: 3,  tees: [{ colour: 'Blue', yardage: 530 }] },
    { number: 4,  par: 4, handicap: 1,  tees: [{ colour: 'Blue', yardage: 410 }] },
    { number: 5,  par: 4, handicap: 11, tees: [{ colour: 'Blue', yardage: 370 }] },
    { number: 6,  par: 3, handicap: 17, tees: [{ colour: 'Blue', yardage: 180 }] },
    { number: 7,  par: 5, handicap: 5,  tees: [{ colour: 'Blue', yardage: 545 }] },
    { number: 8,  par: 4, handicap: 9,  tees: [{ colour: 'Blue', yardage: 395 }] },
    { number: 9,  par: 4, handicap: 13, tees: [{ colour: 'Blue', yardage: 360 }] },
    { number: 10, par: 4, handicap: 2,  tees: [{ colour: 'Blue', yardage: 400 }] },
    { number: 11, par: 5, handicap: 6,  tees: [{ colour: 'Blue', yardage: 520 }] },
    { number: 12, par: 3, handicap: 16, tees: [{ colour: 'Blue', yardage: 155 }] },
    { number: 13, par: 4, handicap: 4,  tees: [{ colour: 'Blue', yardage: 430 }] },
    { number: 14, par: 4, handicap: 10, tees: [{ colour: 'Blue', yardage: 375 }] },
    { number: 15, par: 5, handicap: 8,  tees: [{ colour: 'Blue', yardage: 555 }] },
    { number: 16, par: 3, handicap: 18, tees: [{ colour: 'Blue', yardage: 175 }] },
    { number: 17, par: 4, handicap: 14, tees: [{ colour: 'Blue', yardage: 415 }] },
    { number: 18, par: 4, handicap: 12, tees: [{ colour: 'Blue', yardage: 445 }] },
  ],
}

/**
 * All available course presets. Add new presets here to make them available in the import
 * dropdown.
 */
export const COURSE_PRESETS: ReadonlyArray<CoursePreset> = [GRANITE_RIDGE_GC]
