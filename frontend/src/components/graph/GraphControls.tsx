import { useState } from 'react'
import { graphApi } from '../../services/api'
import toast from 'react-hot-toast'

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
      toast.success(`Exported graph as ${framework}`)
    } catch {
      toast.error('Export failed — Neo4j may be offline')
    }
    setExporting(false)
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">Search</label>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search nodes..."
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div className="space-y-2">
        <button
          onClick={onRefresh}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          Refresh Graph
        </button>

        <button
          onClick={onRunThreatDetection}
          disabled={isThreatDetecting}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50"
        >
          {isThreatDetecting ? 'Detecting...' : 'Run Threat Detection'}
        </button>
      </div>

      <div>
        <label className="mb-2 block text-xs font-medium text-gray-600">Export Graph</label>
        <div className="grid grid-cols-3 gap-1.5">
          {['pyg', 'dgl', 'tf-gnn'].map((fw) => (
            <button
              key={fw}
              onClick={() => handleExport(fw)}
              disabled={exporting}
              className="rounded border border-gray-300 bg-white px-2 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
            >
              {fw}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
