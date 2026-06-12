'use client'
import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { importPlayersFromCSV } from '@/lib/actions/csv-import'

interface Props {
  tournamentId: string
  slug: string
  tournamentName: string
}

export function CsvImportClient({ tournamentId, slug, tournamentName }: Props) {
  const [csvText, setCsvText] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{
    imported: number
    invited: number
    errors: { row: number; reason: string }[]
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setResult(null)
    setError(null)
    const reader = new FileReader()
    reader.onload = (ev) => setCsvText(ev.target?.result as string)
    reader.readAsText(file)
  }

  async function handleImport() {
    if (!csvText) return
    setImporting(true)
    setError(null)
    const res = await importPlayersFromCSV(tournamentId, slug, tournamentName, csvText)
    setImporting(false)
    if (res.error) setError(res.error)
    else setResult(res.data!)
  }

  return (
    <div className="space-y-6">
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
        <p className="text-gray-500 mb-3">Upload CSV file</p>
        <p className="text-xs text-gray-400 mb-4">
          Columns: full_name*, email*, phone, handicap, company, title, team
        </p>
        <label htmlFor="csv-file" className="cursor-pointer">
          <span className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium">
            Choose file
          </span>
          <input
            id="csv-file"
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFile}
            className="sr-only"
            aria-label="CSV file"
          />
        </label>
        {fileName && <p className="text-sm text-gray-600 mt-3">Selected: {fileName}</p>}
      </div>

      {csvText && !result && (
        <Button onClick={handleImport} disabled={importing} className="w-full">
          {importing ? 'Importing…' : 'Import players'}
        </Button>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {result && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
          <p className="font-medium text-green-800">
            {result.imported} players imported, {result.invited} invites sent
          </p>
          {result.errors.length > 0 && (
            <div className="mt-2">
              <p className="text-sm font-medium text-yellow-700">
                {result.errors.length} issue(s):
              </p>
              <ul className="text-xs text-yellow-600 list-disc ml-4 mt-1">
                {result.errors.map((e, i) => (
                  <li key={i}>
                    {e.row > 0 ? `Row ${e.row}: ` : ''}
                    {e.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
