import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'

const { mockDeleteAction, mockRefresh } = vi.hoisted(() => ({
  mockDeleteAction: vi.fn(),
  mockRefresh: vi.fn(),
}))

vi.mock('@/lib/actions/courses', () => ({
  deleteCourseAction: mockDeleteAction,
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}))

import { CourseListClient } from '@/app/admin/venues/[venueId]/course-list-client'

const venueId = 'v-1'
const courses = [
  { id: 'c-1', name: 'Main Course', holes_count: 18, par_total: 72, course_rating: 71.5, slope_rating: 128 },
  { id: 'c-2', name: 'Executive 9', holes_count: 9, par_total: null, course_rating: null, slope_rating: null },
]

beforeEach(() => {
  vi.clearAllMocks()
  mockDeleteAction.mockResolvedValue({ error: null })
})

describe('CourseListClient', () => {
  it('renders all course names', () => {
    render(<CourseListClient venueId={venueId} courses={courses} />)
    expect(screen.getByText('Main Course')).toBeInTheDocument()
    expect(screen.getByText('Executive 9')).toBeInTheDocument()
  })

  it('renders holes count and par when available', () => {
    render(<CourseListClient venueId={venueId} courses={courses} />)
    expect(screen.getByText(/18 holes/i)).toBeInTheDocument()
    expect(screen.getByText(/par 72/i)).toBeInTheDocument()
  })

  it('renders holes count without par when par_total is null', () => {
    render(<CourseListClient venueId={venueId} courses={courses} />)
    expect(screen.getByText(/9 holes/i)).toBeInTheDocument()
  })

  it('renders Setup holes link pointing to course detail', () => {
    render(<CourseListClient venueId={venueId} courses={courses} />)
    const setupLinks = screen.getAllByRole('link', { name: /setup holes/i })
    expect(setupLinks[0]).toHaveAttribute('href', '/admin/venues/v-1/courses/c-1')
  })

  it('renders Edit link pointing to course edit page', () => {
    render(<CourseListClient venueId={venueId} courses={courses} />)
    const editLinks = screen.getAllByRole('link', { name: /edit/i })
    expect(editLinks[0]).toHaveAttribute('href', '/admin/venues/v-1/courses/c-1/edit')
  })

  it('shows delete confirm row on Delete click', () => {
    render(<CourseListClient venueId={venueId} courses={courses} />)
    fireEvent.click(screen.getAllByRole('button', { name: /delete/i })[0])
    expect(screen.getByText(/confirm/i)).toBeInTheDocument()
  })

  it('calls deleteCourseAction with correct id on confirm', async () => {
    render(<CourseListClient venueId={venueId} courses={courses} />)
    fireEvent.click(screen.getAllByRole('button', { name: /delete/i })[0])
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
    await waitFor(() => {
      expect(mockDeleteAction).toHaveBeenCalledWith('c-1')
    })
  })

  it('refreshes router after successful delete', async () => {
    render(<CourseListClient venueId={venueId} courses={courses} />)
    fireEvent.click(screen.getAllByRole('button', { name: /delete/i })[0])
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  it('shows error when delete fails', async () => {
    mockDeleteAction.mockResolvedValue({ error: 'Cannot delete: 1 tournament(s) reference this course.' })
    render(<CourseListClient venueId={venueId} courses={courses} />)
    fireEvent.click(screen.getAllByRole('button', { name: /delete/i })[0])
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Cannot delete')
    })
  })

  it('renders + Add course link', () => {
    render(<CourseListClient venueId={venueId} courses={courses} />)
    expect(screen.getByRole('link', { name: /add course/i })).toHaveAttribute('href', '/admin/venues/v-1/courses/new')
  })

  it('shows empty state when no courses', () => {
    render(<CourseListClient venueId={venueId} courses={[]} />)
    expect(screen.getByText(/no courses/i)).toBeInTheDocument()
  })
})
