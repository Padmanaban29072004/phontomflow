import { useState } from 'react'
import { graphApi } from '../../services/api'

interface GraphControlsProps {
  onRefresh: () => void
  onSearch: (query: string) => void
  onRunThreatDetection: () => void
  isThreatDetecting: boolean
}

export function GraphControls({
  onRefresh,
  onSearch,
  onRunThreatDetection,
  isThreatDetecting,
}: GraphControlsProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [exporting, setExporting] = useState(false)

  const handleSearch = (value: string) => {
    setSearchQuery(value)
    onSearch(value)
  }

  const handleExport = async (framework: string) => {
    setExporting(true)
    try {
      const res = await graphApi.exportGraph(framework as 'pyg' | 'dgl' | 'tf-gnn')
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `graph-export-${framework}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // silent
    }
    setExporting(false)
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-400">Search</label>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search nodes..."
          className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
        />
      </div>

      <div className="space-y-2">
        <button
          onClick={onRefresh}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-gray-800 px-3 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-700"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh Graph
        </button>

        <button
          onClick={onRunThreatDetection}
          disabled={isThreatDetecting}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-900/50 px-3 py-2 text-sm font-medium text-red-300 transition-colors hover:bg-red-900/70 disabled:opacity-50"
        >
          {isThreatDetecting ? (
            <>
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Detecting...
            </>
          ) : (
            <>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              Run Threat Detection
            </>
          )}
        </button>
      </div>

      <div>
        <label className="mb-2 block text-xs font-medium text-gray-400">Export Graph</label>
        <div className="grid grid-cols-3 gap-1.5">
          {['pyg', 'dgl', 'tf-gnn'].map((fw) => (
            <button
              key={fw}
              onClick={() => handleExport(fw)}
              disabled={exporting}
              className="rounded bg-gray-800 px-2 py-1.5 text-xs font-medium text-gray-400 transition-colors hover:bg-gray-700 hover:text-gray-200 disabled:opacity-50"
            >
              {fw}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
