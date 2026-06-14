// fdgolf-app/__tests__/components/pre-round/bag-review-step.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BagReviewStep } from '@/components/pre-round/bag-review-step'

const CLUBS = [
  { id: 'c1', display_name: 'Driver' },
  { id: 'c2', display_name: '7 Iron' },
  { id: 'c3', display_name: 'Putter' },
]

describe('BagReviewStep', () => {
  it('renders all clubs as chips', () => {
    render(
      <BagReviewStep
        clubs={CLUBS}
        selectedIds={['c1', 'c2', 'c3']}
        onChange={vi.fn()}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    )
    expect(screen.getByText('Driver')).toBeInTheDocument()
    expect(screen.getByText('7 Iron')).toBeInTheDocument()
    expect(screen.getByText('Putter')).toBeInTheDocument()
  })

  it('shows count of clubs in bag', () => {
    render(
      <BagReviewStep
        clubs={CLUBS}
        selectedIds={['c1', 'c3']}
        onChange={vi.fn()}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    )
    expect(screen.getByText(/2 in bag/i)).toBeInTheDocument()
  })

  it('calls onChange with toggled list when chip tapped', () => {
    const onChange = vi.fn()
    render(
      <BagReviewStep
        clubs={CLUBS}
        selectedIds={['c1', 'c2', 'c3']}
        onChange={onChange}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    )
    fireEvent.click(screen.getByText('7 Iron'))
    expect(onChange).toHaveBeenCalledWith(['c1', 'c3'])
  })

  it('re-adds a removed club when tapped again', () => {
    const onChange = vi.fn()
    render(
      <BagReviewStep
        clubs={CLUBS}
        selectedIds={['c1', 'c3']}
        onChange={onChange}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    )
    fireEvent.click(screen.getByText('7 Iron'))
    expect(onChange).toHaveBeenCalledWith(['c1', 'c3', 'c2'])
  })

  it('calls onNext when Next tapped', () => {
    const onNext = vi.fn()
    render(
      <BagReviewStep
        clubs={CLUBS}
        selectedIds={['c1']}
        onChange={vi.fn()}
        onNext={onNext}
        onBack={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(onNext).toHaveBeenCalled()
  })

  it('calls onBack when Back tapped', () => {
    const onBack = vi.fn()
    render(
      <BagReviewStep
        clubs={CLUBS}
        selectedIds={['c1']}
        onChange={vi.fn()}
        onNext={vi.fn()}
        onBack={onBack}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /back/i }))
    expect(onBack).toHaveBeenCalled()
  })
})
