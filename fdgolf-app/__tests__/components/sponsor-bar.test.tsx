import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SponsorBar } from '@/components/sponsor-bar'

const LOGOS = [
  { name: 'ACME Corp', slug: 'acme', url: '/sponsors/acme.svg' },
  { name: 'Widget Co', slug: 'widget', url: '/sponsors/widget.svg' },
]

describe('SponsorBar', () => {
  it('renders all logos when sponsorLogos is a non-empty array', () => {
    render(<SponsorBar sponsorLogos={LOGOS} />)
    expect(screen.getByTestId('sponsor-bar')).toBeInTheDocument()
    expect(screen.getByAltText('ACME Corp')).toBeInTheDocument()
    expect(screen.getByAltText('Widget Co')).toBeInTheDocument()
  })

  it('renders nothing when sponsorLogos is null', () => {
    render(<SponsorBar sponsorLogos={null} />)
    expect(screen.queryByTestId('sponsor-bar')).toBeNull()
  })

  it('renders nothing when sponsorLogos is an empty array', () => {
    render(<SponsorBar sponsorLogos={[]} />)
    expect(screen.queryByTestId('sponsor-bar')).toBeNull()
  })
})
