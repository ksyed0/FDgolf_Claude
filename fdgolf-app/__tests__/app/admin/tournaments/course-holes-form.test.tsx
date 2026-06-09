import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// Mock the server action
vi.mock('@/lib/actions/course', () => ({
  saveCourseHolesAction: vi.fn(),
}))

// Mock useFormState and useFormStatus
const mockFormAction = vi.fn()
let mockState: { error: string | null; courseId?: string } = { error: null }

vi.mock('react-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-dom')>()
  return {
    ...actual,
    useFormState: vi.fn((_action, _initialState) => [mockState, mockFormAction]),
    useFormStatus: vi.fn(() => ({ pending: false })),
  }
})

import { CourseHolesForm } from '@/app/admin/tournaments/[slug]/course/course-holes-form'

const defaultProps = {
  tournamentId: 'tournament-uuid-1',
  courseId: null,
  tournamentName: 'Summer Classic',
  venue: 'Pine Valley Golf Club',
  holesCount: 18,
  existingHoles: [],
}

describe('CourseHolesForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockState = { error: null }
  })

  it('renders 18 rows by default (holesCount=18)', () => {
    render(<CourseHolesForm {...defaultProps} />)
    // Each hole row has a select for par
    const parSelects = screen.getAllByRole('combobox')
    expect(parSelects).toHaveLength(18)
  })

  it('renders correct number of rows when holesCount=9', () => {
    render(<CourseHolesForm {...defaultProps} holesCount={9} />)
    const parSelects = screen.getAllByRole('combobox')
    expect(parSelects).toHaveLength(9)
  })

  it('populates form from existingHoles', () => {
    const existingHoles = [
      { number: 1, par: 3, yardage: 150, stroke_index: 7 },
      { number: 2, par: 5, yardage: 520, stroke_index: 11 },
    ]
    render(<CourseHolesForm {...defaultProps} existingHoles={existingHoles} />)

    // Check hole 1 par select value
    const parSelects = screen.getAllByRole('combobox')
    expect((parSelects[0] as HTMLSelectElement).value).toBe('3')
    expect((parSelects[1] as HTMLSelectElement).value).toBe('5')

    // Check yardage inputs
    const yardageInputs = screen.getAllByLabelText(/yardage/i)
    expect((yardageInputs[0] as HTMLInputElement).value).toBe('150')
    expect((yardageInputs[1] as HTMLInputElement).value).toBe('520')

    // Check stroke index inputs
    const strokeInputs = screen.getAllByLabelText(/stroke index/i)
    expect((strokeInputs[0] as HTMLInputElement).value).toBe('7')
    expect((strokeInputs[1] as HTMLInputElement).value).toBe('11')
  })

  it('total par reflects default par values (18 holes × 4 = 72)', () => {
    render(<CourseHolesForm {...defaultProps} />)
    const totalPar = screen.getByTestId('total-par')
    expect(totalPar).toHaveTextContent('Par: 72')
  })

  it('total par updates when a par value changes', () => {
    render(<CourseHolesForm {...defaultProps} />)

    // Change hole 1 par from 4 to 3
    const parSelects = screen.getAllByRole('combobox')
    fireEvent.change(parSelects[0], { target: { value: '3' } })

    const totalPar = screen.getByTestId('total-par')
    // 17 holes × 4 + 1 hole × 3 = 71
    expect(totalPar).toHaveTextContent('Par: 71')
  })

  it('shows success message when save succeeds', () => {
    mockState = { error: null, courseId: 'new-course-uuid' }

    render(<CourseHolesForm {...defaultProps} />)

    // Simulate form submission that sets submitted=true
    const form = document.querySelector('form')!
    fireEvent.submit(form)

    // After submission with no errors, success message should appear
    expect(screen.getByRole('status')).toHaveTextContent('Course saved!')
  })

  it('shows error message from server action when save fails', () => {
    mockState = { error: 'DB error: constraint violation' }

    render(<CourseHolesForm {...defaultProps} />)

    expect(screen.getByRole('alert')).toHaveTextContent('DB error: constraint violation')
  })

  it('shows client error when stroke indices are duplicated on submit', () => {
    render(<CourseHolesForm {...defaultProps} />)

    // Set hole 1 and hole 2 stroke index to the same value
    const strokeInputs = screen.getAllByLabelText(/stroke index/i)
    fireEvent.change(strokeInputs[0], { target: { value: '5' } })
    fireEvent.change(strokeInputs[1], { target: { value: '5' } })

    const form = document.querySelector('form')!
    fireEvent.submit(form)

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Stroke indices must be unique across all holes.'
    )
  })

  it('renders the tournament name in the heading', () => {
    render(<CourseHolesForm {...defaultProps} />)
    expect(
      screen.getByRole('heading', { name: /Course Setup — Summer Classic/i })
    ).toBeInTheDocument()
  })

  it('renders hidden inputs for tournament_id and course_id', () => {
    render(<CourseHolesForm {...defaultProps} tournamentId="tid-123" courseId="cid-456" />)

    const tidInput = document.querySelector('input[name="tournament_id"]') as HTMLInputElement
    const cidInput = document.querySelector('input[name="course_id"]') as HTMLInputElement

    expect(tidInput?.value).toBe('tid-123')
    expect(cidInput?.value).toBe('cid-456')
  })
})
