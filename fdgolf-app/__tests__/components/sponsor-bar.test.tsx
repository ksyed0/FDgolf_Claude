import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SponsorBar } from '@/components/sponsor-bar'

describe('SponsorBar', () => {
  it('renders both logos for the CIBC slug', () => {
    render(<SponsorBar slug="cibc-granite-ridge-2026" />)
    expect(screen.getByTestId('sponsor-bar')).toBeInTheDocument()
    expect(screen.getByAltText('First Derivative')).toBeInTheDocument()
    expect(screen.getByAltText('AI / RUN')).toBeInTheDocument()
  })

  it('renders nothing for an unknown slug', () => {
    render(<SponsorBar slug="some-other-tournament" />)
    expect(screen.queryByTestId('sponsor-bar')).toBeNull()
  })

  it('renders nothing for an empty slug', () => {
    render(<SponsorBar slug="" />)
    expect(screen.queryByTestId('sponsor-bar')).toBeNull()
  })
})
