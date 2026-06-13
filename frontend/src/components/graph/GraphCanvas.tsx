import { useRef, useCallback, useEffect, useState } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import { GraphNode, GraphRelationship } from '../../services/api'
import { NODE_COLORS } from './GraphLegend'

interface GraphData {
  nodes: { id: string; type: string; label: string; properties: Record<string, unknown> }[]
  links: { source: string; target: string; type: string }[]
}

interface GraphCanvasProps {
  data: GraphData
  onNodeClick: (node: GraphNode | null) => void
  searchQuery: string
  visibleTypes: Set<string>
}

export function GraphCanvas({ data, onNodeClick, searchQuery, visibleTypes }: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        })
      }
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  const filteredData = {
    nodes: data.nodes.filter(
      (n) =>
        visibleTypes.has(n.type) &&
        (!searchQuery || n.label.toLowerCase().includes(searchQuery.toLowerCase()) || n.id.toLowerCase().includes(searchQuery.toLowerCase()))
    ),
    links: data.links.filter(
      (l) =>
        visibleTypes.has(data.nodes.find((n) => n.id === l.source)?.type || '') &&
        visibleTypes.has(data.nodes.find((n) => n.id === l.target)?.type || '')
    ),
  }

  const handleNodeClick = useCallback(
    (node: Record<string, unknown>) => {
      const graphNode: GraphNode = {
        id: node.id as string,
        labels: [node.type as string],
        properties: node.properties as Record<string, unknown>,
      }
      onNodeClick(graphNode)
    },
    [onNodeClick]
  )

  return (
    <div ref={containerRef} className="h-full w-full rounded-lg border border-gray-800 bg-gray-950">
      {filteredData.nodes.length === 0 ? (
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <svg className="mx-auto h-12 w-12 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
            </svg>
            <p className="mt-2 text-sm text-gray-600">No graph data available</p>
            <p className="text-xs text-gray-700">Start the server and Neo4j to populate the graph</p>
          </div>
        </div>
      ) : (
        <ForceGraph2D
          graphData={filteredData}
          width={dimensions.width}
          height={dimensions.height}
          backgroundColor="#030712"
          nodeColor={(node: Record<string, unknown>) =>
            NODE_COLORS[node.type as string] || '#6b7280'
          }
          nodeLabel={(node: Record<string, unknown>) =>
            `${node.type}: ${node.label || node.id}`
          }
          nodeVal={(node: Record<string, unknown>) =>
            (node.type === 'Threat' || node.type === 'User' ? 8 : 5)
          }
          linkColor={() => 'rgba(255,255,255,0.08)'}
          linkWidth={0.5}
          linkDirectionalParticles={1}
          linkDirectionalParticleWidth={1.5}
          linkDirectionalParticleColor={() => 'rgba(255,255,255,0.3)'}
          onNodeClick={handleNodeClick}
          cooldownTicks={100}
          d3AlphaDecay={0.02}
          d3VelocityDecay={0.3}
        />
      )}
    </div>
  )
}

export type { GraphData }
