import { getNeo4jDriver } from './neo4j';

export async function ensureNeo4jSchema(): Promise<void> {
  const session = getNeo4jDriver().session();
  try {
    await session.run('CREATE CONSTRAINT ip_value IF NOT EXISTS FOR (n:IP) REQUIRE n.value IS UNIQUE');
    await session.run('CREATE CONSTRAINT user_value IF NOT EXISTS FOR (n:User) REQUIRE n.value IS UNIQUE');
    await session.run('CREATE CONSTRAINT host_value IF NOT EXISTS FOR (n:Host) REQUIRE n.value IS UNIQUE');
    await session.run('CREATE CONSTRAINT domain_value IF NOT EXISTS FOR (n:Domain) REQUIRE n.value IS UNIQUE');
    await session.run('CREATE CONSTRAINT file_value IF NOT EXISTS FOR (n:File) REQUIRE n.value IS UNIQUE');
  } finally {
    await session.close();
  }
}

export type GraphNodeType = 'IP' | 'User' | 'Host' | 'Domain' | 'File';
export type GraphEdgeType = 'CONNECTED_TO' | 'AUTHENTICATED_AS' | 'ACCESSED' | 'EXECUTED' | 'TRANSFERRED_TO';

