import { getNeo4jDriver } from '../db/neo4j';

export async function queryKillChainSubgraph(sourceIp: string, windowHours: number): Promise<{ nodes: any[]; edges: any[] }> {
  const session = getNeo4jDriver().session();
  try {
    const result = await session.run(
      `
      MATCH p=(ip:IP {value: $ip})-[r*1..5]-(n)
      WHERE all(rel in r WHERE rel.ts IS NULL OR rel.ts >= datetime() - duration({hours: $window}))
      RETURN p LIMIT 100
      `,
      { ip: sourceIp, window: windowHours }
    );

    const nodes: Record<string, any> = {};
    const edges: any[] = [];
    for (const rec of result.records) {
      const path = rec.get('p');
      for (const seg of path.segments) {
        nodes[seg.start.properties.value] = { label: seg.start.labels[0], ...seg.start.properties };
        nodes[seg.end.properties.value] = { label: seg.end.labels[0], ...seg.end.properties };
        edges.push({
          from: seg.start.properties.value,
          to: seg.end.properties.value,
          type: seg.relationship.type,
        });
      }
    }
    return { nodes: Object.values(nodes), edges };
  } finally {
    await session.close();
  }
}

