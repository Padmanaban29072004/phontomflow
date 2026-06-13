import { GraphNode, GraphRelationship } from '../../services/api'
import { NODE_COLORS } from './GraphLegend'

interface GraphNodeDetailProps {
  node: GraphNode | null
  relationships: GraphRelationship[]
  onClose: () => void
}

export function GraphNodeDetail({ node, relationships, onClose }: GraphNodeDetailProps) {
  if (!node) return null

  const label = node.labels[0]
  const color = NODE_COLORS[label] || '#6b7280'
  const nodeRels = relationships.filter(
    (r) => r.properties?.source === node.id || r.properties?.target === node.id
  )

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-80 border-l border-gray-700 bg-gray-900 shadow-xl">
      <div className="flex items-center justify-between border-b border-gray-700 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
          <h3 className="text-sm font-semibold text-gray-200">{label}</h3>
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 text-gray-500 hover:bg-gray-800 hover:text-gray-300"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="overflow-y-auto p-4" style={{ maxHeight: 'calc(100vh - 60px)' }}>
        <div className="mb-4">
          <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">Properties</h4>
          <div className="space-y-1.5">
            {Object.entries(node.properties).map(([key, value]) => (
              <div key={key} className="rounded bg-gray-800/50 px-3 py-2">
                <p className="text-xs text-gray-500">{key}</p>
                <p className="text-sm text-gray-300 break-all">{formatValue(value)}</p>
              </div>
            ))}
            {Object.keys(node.properties).length === 0 && (
              <p className="text-xs text-gray-600 italic">No properties</p>
            )}
          </div>
        </div>

        <div>
          <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">
            Relationships ({nodeRels.length})
          </h4>
          <div className="space-y-1">
            {nodeRels.slice(0, 20).map((r, i) => (
              <div key={i} className="rounded bg-gray-800/30 px-3 py-1.5">
                <p className="text-xs text-gray-400">{r.type}</p>
              </div>
            ))}
            {nodeRels.length > 20 && (
              <p className="text-xs text-gray-600">...and {nodeRels.length - 20} more</p>
            )}
            {nodeRels.length === 0 && (
              <p className="text-xs text-gray-600 italic">No relationships</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
