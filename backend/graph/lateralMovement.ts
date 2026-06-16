import { getNeo4jDriver } from '../db/neo4j';

export async function detectLateralMovementPaths(sourceHost: string, maxDepth = 4): Promise<any[]> {
  const session = getNeo4jDriver().session();
  try {
    const result = await session.run(
      `
      MATCH p=(h:Host {value:$host})-[:AUTHENTICATED_AS|ACCESSED|EXECUTED*1..${maxDepth}]-(target:Host)
      WHERE h <> target
      RETURN p LIMIT 50
      `,
      { host: sourceHost }
    );
    return result.records.map((r) => r.get('p'));
  } finally {
    await session.close();
  }
}

