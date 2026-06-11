/**
 * Course presets — static data module (US-0012).
 *
 * Each preset describes a known golf course with 18 holes (par, yardage, strokeIndex).
 * Admins can import a preset to pre-populate the CourseHolesForm rather than hand-keying
 * 18 rows.
 */

export interface CourseHolePreset {
  /** Hole number (1–18) */
  number: number
  /** Par value: 3, 4, or 5 */
  par: 3 | 4 | 5
  /** Yardage from the primary tee */
  yardage: number
  /** Stroke index (1–18, unique within the course) */
  strokeIndex: number
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
    { number: 1,  par: 4, yardage: 385, strokeIndex: 7  },
    { number: 2,  par: 3, yardage: 165, strokeIndex: 15 },
    { number: 3,  par: 5, yardage: 530, strokeIndex: 3  },
    { number: 4,  par: 4, yardage: 410, strokeIndex: 1  },
    { number: 5,  par: 4, yardage: 370, strokeIndex: 11 },
    { number: 6,  par: 3, yardage: 180, strokeIndex: 17 },
    { number: 7,  par: 5, yardage: 545, strokeIndex: 5  },
    { number: 8,  par: 4, yardage: 395, strokeIndex: 9  },
    { number: 9,  par: 4, yardage: 360, strokeIndex: 13 },
    { number: 10, par: 4, yardage: 400, strokeIndex: 2  },
    { number: 11, par: 5, yardage: 520, strokeIndex: 6  },
    { number: 12, par: 3, yardage: 155, strokeIndex: 16 },
    { number: 13, par: 4, yardage: 430, strokeIndex: 4  },
    { number: 14, par: 4, yardage: 375, strokeIndex: 10 },
    { number: 15, par: 5, yardage: 555, strokeIndex: 8  },
    { number: 16, par: 3, yardage: 175, strokeIndex: 18 },
    { number: 17, par: 4, yardage: 415, strokeIndex: 14 },
    { number: 18, par: 4, yardage: 445, strokeIndex: 12 },
  ],
}

/**
 * All available course presets. Add new presets here to make them available in the import
 * dropdown.
 */
export const COURSE_PRESETS: ReadonlyArray<CoursePreset> = [GRANITE_RIDGE_GC]
