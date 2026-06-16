import { getNeo4jDriver } from '../db/neo4j';

export interface RelationshipAnalysisResult {
  riskScore: number;
  relatedNodes: number;
  pivotPaths: number;
}

export class Neo4jRelationshipAnalyzer {
  public async analyze(input: { src_ip: string; host?: string; user?: string }): Promise<RelationshipAnalysisResult> {
    const session = getNeo4jDriver().session();
    try {
      const query = `
        MERGE (ip:IP {value: $ip})
        WITH ip
        OPTIONAL MATCH (ip)-[r*1..3]-(n)
        RETURN count(DISTINCT n) AS relatedNodes, count(r) AS pathCount
      `;
      const result = await session.run(query, { ip: input.src_ip });
      const record = result.records[0];
      const relatedNodes = Number(record?.get('relatedNodes') ?? 0);
      const pivotPaths = Number(record?.get('pathCount') ?? 0);
      const riskScore = Math.min(1, (relatedNodes * 0.02) + (pivotPaths * 0.01));
      return { riskScore, relatedNodes, pivotPaths };
    } finally {
      await session.close();
    }
  }
}

