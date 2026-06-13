const NODE_COLORS: Record<string, string> = {
  User: '#3b82f6',
  Session: '#f59e0b',
  IP: '#10b981',
  Device: '#8b5cf6',
  Resource: '#14b8a6',
  Threat: '#ef4444',
}

const NODE_LABELS: Record<string, string> = {
  User: 'Users',
  Session: 'Sessions',
  IP: 'IP Addresses',
  Device: 'Devices',
  Resource: 'Resources',
  Threat: 'Threats',
}

interface GraphLegendProps {
  visibleTypes: Set<string>
  onToggle: (type: string) => void
}

export function GraphLegend({ visibleTypes, onToggle }: GraphLegendProps) {
  return (
    <div className="space-y-1.5">
      {Object.entries(NODE_COLORS).map(([type, color]) => (
        <button
          key={type}
          onClick={() => onToggle(type)}
          className="flex w-full items-center gap-2 rounded px-2 py-1 text-xs transition-colors hover:bg-gray-800"
        >
          <div
            className="h-3 w-3 rounded-sm"
            style={{ backgroundColor: color, opacity: visibleTypes.has(type) ? 1 : 0.3 }}
          />
          <span
            className="text-gray-300"
            style={{ opacity: visibleTypes.has(type) ? 1 : 0.4 }}
          >
            {NODE_LABELS[type]}
          </span>
        </button>
      ))}
    </div>
  )
}

export { NODE_COLORS, NODE_LABELS }
