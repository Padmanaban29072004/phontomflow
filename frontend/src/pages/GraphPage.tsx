import { useState, useEffect, useCallback } from 'react'
import { graphApi, GraphNode, GraphRelationship, ThreatReport } from '../services/api'
import { unwrapApiPayload } from '../services/apiHelpers'
import { GraphCanvas, GraphData } from '../components/graph/GraphCanvas'
import { GraphControls } from '../components/graph/GraphControls'
import { GraphLegend } from '../components/graph/GraphLegend'
import { GraphNodeDetail } from '../components/graph/GraphNodeDetail'
import { PageShell } from '../components/layout/PageShell'
import toast from 'react-hot-toast'

const ALL_TYPES = ['User', 'Session', 'IP', 'Device', 'Resource', 'Threat']

function unwrapList<T>(response: { data?: unknown }): T[] {
  const payload = unwrapApiPayload<T[] | { data: T[] }>(response)
  if (Array.isArray(payload)) return payload
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as { data: T[] }).data ?? []
  }
  return []
}

export function GraphPage() {
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] })
  const [loading, setLoading] = useState(true)
  const [neo4jConnected, setNeo4jConnected] = useState(false)
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
      const connected = Boolean(healthRes.data.connected)
      setNeo4jConnected(connected)

      if (!connected) {
        setGraphData({ nodes: [], links: [] })
        setRelationships([])
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
        type: n.labels[0] || 'Unknown',
        label: String(
          n.properties?.username ?? n.properties?.address ?? n.properties?.path ?? n.id
        ),
        properties: n.properties,
      })

      const nodes = [
        ...unwrapList<GraphNode>(userRes),
        ...unwrapList<GraphNode>(sessionRes),
        ...unwrapList<GraphNode>(ipRes),
        ...unwrapList<GraphNode>(deviceRes),
        ...unwrapList<GraphNode>(resourceRes),
        ...unwrapList<GraphNode>(threatRes),
      ].map(mapNode)

      const relList = unwrapList<GraphRelationship>(relRes)
      const links = relList
        .filter((r) => r.source && r.target)
        .map((r) => ({
          source: r.source as string,
          target: r.target as string,
          type: r.type,
        }))

      setGraphData({ nodes, links })
      setRelationships(relList)
    } catch {
      setGraphData({ nodes: [], links: [] })
      setRelationships([])
      setNeo4jConnected(false)
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
      const report = unwrapApiPayload<ThreatReport>(res) ?? res.data
      setThreatReport(report)
      setShowReport(true)
      toast.success(`Detected ${report.summary?.totalThreats ?? 0} threats`)
      await fetchGraphData()
    } catch {
      toast.error('Threat detection failed — is Neo4j running?')
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

  const graphSubtitle = `${graphData.nodes.length} nodes · ${graphData.links.length} relationships${
    !neo4jConnected ? ' · Neo4j offline' : ''
  }`

  return (
    <PageShell title="Graph Intelligence" description={graphSubtitle}>
      {showReport && threatReport && (
        <div className="flex flex-wrap items-center gap-4 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm shadow-sm">
          <span className="text-gray-600">
            Threats:{' '}
            <span className="font-semibold text-red-600">{threatReport.summary.totalThreats}</span>
          </span>
          <span className="text-gray-600">
            Avg Score:{' '}
            <span className="font-semibold text-amber-600">
              {threatReport.summary.averageScore.toFixed(2)}
            </span>
          </span>
          <button
            type="button"
            onClick={() => setShowReport(false)}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Dismiss report"
          >
            ×
          </button>
        </div>
      )}

      {!neo4jConnected && !loading && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Neo4j is not connected. Start Neo4j with Docker Compose or set{' '}
          <code className="text-xs">NEO4J_URI</code> in the backend to enable graph visualization.
        </div>
      )}

      <div className="flex min-h-[520px] flex-col gap-4 lg:flex-row">
        <div className="w-56 shrink-0 space-y-6 overflow-y-auto rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Node Types
            </h3>
            <GraphLegend visibleTypes={visibleTypes} onToggle={handleToggleType} />
          </div>

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Controls
            </h3>
            <GraphControls
              onRefresh={fetchGraphData}
              onSearch={setSearchQuery}
              onRunThreatDetection={handleRunThreatDetection}
              isThreatDetecting={isThreatDetecting}
            />
          </div>

          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-xs text-gray-500">
              <span className="block font-medium text-gray-700">Tip:</span>
              Click a node to inspect properties. Drag to rearrange. Scroll to zoom.
            </p>
          </div>
        </div>

        <div className="relative min-h-[480px] flex-1">
          {loading ? (
            <div className="flex h-full items-center justify-center rounded-lg border border-gray-200 bg-white">
              <div className="flex items-center gap-3">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                <span className="text-sm text-gray-500">Loading graph data...</span>
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
    </PageShell>
  )
}
