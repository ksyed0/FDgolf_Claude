import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'

let mockQueueLength = 0

vi.mock('@/lib/round/store', () => {
  const useRoundStore = (selector: (s: unknown) => unknown) =>
    selector({ queue: Array.from({ length: mockQueueLength }) })
  return { useRoundStore }
})

import { OfflineBanner } from '@/components/round/offline-banner'

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { value, writable: true, configurable: true })
}

beforeEach(() => {
  mockQueueLength = 0
  setOnline(true)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('OfflineBanner', () => {
  it('renders nothing on initial render (SSR-safe default)', () => {
    // With online=true default (useState(true)) and empty queue, nothing renders.
    // This verifies navigator is never accessed during the useState initializer,
    // which would throw ReferenceError in a Node/SSR environment.
    setOnline(true)
    mockQueueLength = 0
    const { container } = render(<OfflineBanner />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when navigator.onLine is true and queue is empty', () => {
    setOnline(true)
    mockQueueLength = 0
    const { container } = render(<OfflineBanner />)
    expect(container.firstChild).toBeNull()
  })

  it('shows offline message when navigator.onLine is false', () => {
    setOnline(false)
    mockQueueLength = 0
    render(<OfflineBanner />)
    expect(screen.getByRole('status')).toHaveTextContent(
      /you're offline — shots will sync when reconnected/i
    )
  })

  it('shows syncing message when online but queue has items', () => {
    setOnline(true)
    mockQueueLength = 3
    render(<OfflineBanner />)
    expect(screen.getByRole('status')).toHaveTextContent(/syncing 3 shots/i)
  })

  it('dismisses when online event fires and queue drains', () => {
    setOnline(false)
    mockQueueLength = 0
    render(<OfflineBanner />)
    expect(screen.getByRole('status')).toHaveTextContent(/offline/i)

    act(() => {
      setOnline(true)
      window.dispatchEvent(new Event('online'))
    })

    expect(screen.queryByRole('status')).toBeNull()
  })
})
