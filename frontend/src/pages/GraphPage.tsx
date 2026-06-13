import { useState, useEffect, useCallback } from 'react'
import { graphApi, GraphNode, GraphRelationship, ThreatReport } from '../services/api'
import { GraphCanvas, GraphData } from '../components/graph/GraphCanvas'
import { GraphControls } from '../components/graph/GraphControls'
import { GraphLegend } from '../components/graph/GraphLegend'
import { GraphNodeDetail } from '../components/graph/GraphNodeDetail'
import toast from 'react-hot-toast'

const ALL_TYPES = ['User', 'Session', 'IP', 'Device', 'Resource', 'Threat']

export function GraphPage() {
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] })
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [visibleTypes, setVisibleTypes] = useState<Set<string>>(new Set(ALL_TYPES))
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [relationships, setRelationships] = useState<GraphRelationship[]>([])
  const [isThreatDetecting, setIsThreatDetecting] = useState(false)
  const [threatReport, setThreatReport] = useState<ThreatReport | null>(null)
  const [showReport, setShowReport] = useState(false)

  const fetchGraphData = useCallback(async () => {
    setLoading(true)
    try {
      const healthRes = await graphApi.health()
      if (!healthRes.data.connected) {
        setGraphData({ nodes: [], links: [] })
        setLoading(false)
        return
      }

      const [userRes, sessionRes, ipRes, deviceRes, resourceRes, threatRes, relRes] =
        await Promise.all([
          graphApi.nodes('User', { limit: '200' }),
          graphApi.nodes('Session', { limit: '200' }),
          graphApi.nodes('IP', { limit: '200' }),
          graphApi.nodes('Device', { limit: '100' }),
          graphApi.nodes('Resource', { limit: '100' }),
          graphApi.nodes('Threat', { limit: '200' }),
          graphApi.relationships(),
        ])

      const mapNode = (n: GraphNode) => ({
        id: n.id,
        type: n.labels[0],
        label: (n.properties?.username || n.properties?.address || n.properties?.path || n.id) as string,
        properties: n.properties,
      })

      const nodes = [
        ...(userRes.data || []).map(mapNode),
        ...(sessionRes.data || []).map(mapNode),
        ...(ipRes.data || []).map(mapNode),
        ...(deviceRes.data || []).map(mapNode),
        ...(resourceRes.data || []).map(mapNode),
        ...(threatRes.data || []).map(mapNode),
      ]

      const links = (relRes.data || []).map((r) => ({
        source: r.source ?? r.id,
        target: r.target ?? r.id,
        type: r.type,
      })) as { source: string; target: string; type: string }[]

      setGraphData({ nodes, links })
      setRelationships(relRes.data || [])
    } catch {
      setGraphData({ nodes: [], links: [] })
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchGraphData()
  }, [fetchGraphData])

  const handleRunThreatDetection = async () => {
    setIsThreatDetecting(true)
    try {
      const res = await graphApi.threatReport()
      setThreatReport(res.data)
      setShowReport(true)
      toast.success(`Detected ${res.data.summary.totalThreats} threats`)
      await fetchGraphData()
    } catch {
      toast.error('Threat detection failed')
    }
    setIsThreatDetecting(false)
  }

  const handleToggleType = (type: string) => {
    setVisibleTypes((prev) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Graph Intelligence</h1>
          <p className="text-sm text-gray-400">
            {graphData.nodes.length} nodes · {graphData.links.length} relationships
          </p>
        </div>

        {showReport && threatReport && (
          <div className="flex items-center gap-4 rounded-lg bg-gray-800 px-4 py-2 text-sm">
            <span className="text-gray-400">
              Threats: <span className="font-semibold text-red-400">{threatReport.summary.totalThreats}</span>
            </span>
            <span className="text-gray-400">
              Avg Score: <span className="font-semibold text-yellow-400">{threatReport.summary.averageScore.toFixed(2)}</span>
            </span>
            <button
              onClick={() => setShowReport(false)}
              className="text-gray-500 hover:text-gray-300"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-1 gap-4 overflow-hidden">
        <div className="w-56 shrink-0 space-y-6 overflow-y-auto rounded-lg border border-gray-800 bg-gray-950 p-4">
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Node Types</h3>
            <GraphLegend visibleTypes={visibleTypes} onToggle={handleToggleType} />
          </div>

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Controls</h3>
            <GraphControls
              onRefresh={fetchGraphData}
              onSearch={setSearchQuery}
              onRunThreatDetection={handleRunThreatDetection}
              isThreatDetecting={isThreatDetecting}
            />
          </div>

          <div className="rounded-lg bg-gray-800/50 p-3">
            <p className="text-xs text-gray-500">
              <span className="block font-medium text-gray-400">Tip:</span>
              Click a node to inspect its properties and relationships. Drag nodes to rearrange. Scroll to zoom.
            </p>
          </div>
        </div>

        <div className="flex-1">
          {loading ? (
            <div className="flex h-full items-center justify-center rounded-lg border border-gray-800 bg-gray-950">
              <div className="flex items-center gap-3">
                <svg className="h-5 w-5 animate-spin text-blue-500" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-sm text-gray-400">Loading graph data...</span>
              </div>
            </div>
          ) : (
            <GraphCanvas
              data={graphData}
              onNodeClick={setSelectedNode}
              searchQuery={searchQuery}
              visibleTypes={visibleTypes}
            />
          )}
        </div>
      </div>

      {selectedNode && (
        <GraphNodeDetail
          node={selectedNode}
          relationships={relationships}
          onClose={() => setSelectedNode(null)}
        />
      )}
    </div>
  )
}
