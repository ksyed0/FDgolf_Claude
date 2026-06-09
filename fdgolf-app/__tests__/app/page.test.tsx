import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Home from '@/app/page'

describe('Home page', () => {
  it('renders the FDgolf heading', () => {
    render(<Home />)
    expect(screen.getByRole('heading', { name: 'FDgolf' })).toBeInTheDocument()
  })

  it('renders the coming soon text', () => {
    render(<Home />)
    expect(screen.getByText('Coming soon')).toBeInTheDocument()
  })

  it('renders a button', () => {
    render(<Home />)
    expect(screen.getByRole('button', { name: 'Test Button' })).toBeInTheDocument()
  })
})
