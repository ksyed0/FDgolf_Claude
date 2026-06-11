import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

const { mockCreateAction, mockUpdateAction } = vi.hoisted(() => ({
  mockCreateAction: vi.fn(),
  mockUpdateAction: vi.fn(),
}))

vi.mock('@/lib/actions/courses', () => ({
  createCourseAction: mockCreateAction,
  updateCourseAction: mockUpdateAction,
}))

const mockFormAction = vi.fn()
let mockState: { error: string | null } = { error: null }

vi.mock('react-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-dom')>()
  return {
    ...actual,
    useFormState: vi.fn((_action: unknown, _init: unknown) => [mockState, mockFormAction]),
    useFormStatus: vi.fn(() => ({ pending: false })),
  }
})

import { CourseForm } from '@/app/admin/venues/[venueId]/courses/new/course-form'

beforeEach(() => {
  mockState = { error: null }
  vi.clearAllMocks()
})

describe('CourseForm — create mode', () => {
  it('renders name input', () => {
    render(<CourseForm venueId="v-1" />)
    expect(screen.getByLabelText(/course name/i)).toBeInTheDocument()
  })

  it('renders holes_count select with 9 and 18 options', () => {
    render(<CourseForm venueId="v-1" />)
    const select = screen.getByLabelText(/holes/i)
    expect(select).toBeInTheDocument()
    expect(screen.getByRole('option', { name: '18' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: '9' })).toBeInTheDocument()
  })

  it('renders "Create course" submit button', () => {
    render(<CourseForm venueId="v-1" />)
    expect(screen.getByRole('button', { name: /create course/i })).toBeInTheDocument()
  })

  it('renders "+ Add tee" button', () => {
    render(<CourseForm venueId="v-1" />)
    expect(screen.getByRole('button', { name: /add tee/i })).toBeInTheDocument()
  })

  it('starts with one tee row after clicking + Add tee', () => {
    render(<CourseForm venueId="v-1" />)
    fireEvent.click(screen.getByRole('button', { name: /add tee/i }))
    expect(screen.getAllByPlaceholderText(/colour/i)).toHaveLength(1)
  })

  it('shows error when returned from action', () => {
    mockState = { error: 'Course name is required.' }
    render(<CourseForm venueId="v-1" />)
    expect(screen.getByRole('alert')).toHaveTextContent('Course name is required.')
  })

  it('does not show error when state.error is null', () => {
    mockState = { error: null }
    render(<CourseForm venueId="v-1" />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('CourseForm — edit mode', () => {
  const course = {
    id: 'c-1',
    name: 'Main Course',
    holes_count: 18,
    par_total: 72,
    course_rating: 71.5,
    slope_rating: 128,
    tee_yardages: [{ colour: 'Blue', total_yardage: 6540 }],
  }

  it('pre-populates name field', () => {
    render(<CourseForm venueId="v-1" course={course} />)
    expect((screen.getByLabelText(/course name/i) as HTMLInputElement).value).toBe('Main Course')
  })

  it('pre-populates par_total', () => {
    render(<CourseForm venueId="v-1" course={course} />)
    expect((screen.getByLabelText(/par total/i) as HTMLInputElement).value).toBe('72')
  })

  it('renders "Save changes" submit button', () => {
    render(<CourseForm venueId="v-1" course={course} />)
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument()
  })

  it('pre-populates tee rows from tee_yardages', () => {
    render(<CourseForm venueId="v-1" course={course} />)
    expect(screen.getByDisplayValue('Blue')).toBeInTheDocument()
    expect(screen.getByDisplayValue('6540')).toBeInTheDocument()
  })
})
