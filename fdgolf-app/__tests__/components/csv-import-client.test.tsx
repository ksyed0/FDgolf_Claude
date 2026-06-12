import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/actions/csv-import', () => ({
  importPlayersFromCSV: vi.fn().mockResolvedValue({
    data: { imported: 2, invited: 2, errors: [] },
    error: null,
  }),
}))

import { CsvImportClient } from '@/app/admin/tournaments/[slug]/players/import/csv-import-client'
import { importPlayersFromCSV } from '@/lib/actions/csv-import'

const PROPS = { tournamentId: 't1', slug: 'cibc-2026', tournamentName: 'CIBC 2026' }

describe('CsvImportClient', () => {
  it('renders file upload UI', () => {
    render(<CsvImportClient {...PROPS} />)
    expect(screen.getByText(/upload csv/i)).toBeInTheDocument()
  })

  it('calls importPlayersFromCSV on confirm', async () => {
    render(<CsvImportClient {...PROPS} />)
    const input = screen.getByLabelText(/csv file/i)
    const csv = 'full_name,email\nAlice,alice@example.com'
    const file = new File([csv], 'players.csv', { type: 'text/csv' })
    fireEvent.change(input, { target: { files: [file] } })
    await waitFor(() => screen.getByRole('button', { name: /import/i }))
    fireEvent.click(screen.getByRole('button', { name: /import/i }))
    await waitFor(() => {
      expect(importPlayersFromCSV).toHaveBeenCalledWith('t1', 'cibc-2026', 'CIBC 2026', csv)
    })
  })

  it('shows success summary after import', async () => {
    render(<CsvImportClient {...PROPS} />)
    const input = screen.getByLabelText(/csv file/i)
    const file = new File(['full_name,email\nAlice,alice@example.com'], 'p.csv', {
      type: 'text/csv',
    })
    fireEvent.change(input, { target: { files: [file] } })
    await waitFor(() => screen.getByRole('button', { name: /import/i }))
    fireEvent.click(screen.getByRole('button', { name: /import/i }))
    await waitFor(() => {
      expect(screen.getByText(/2 players imported/i)).toBeInTheDocument()
    })
  })
})
