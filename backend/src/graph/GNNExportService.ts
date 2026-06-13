import { Neo4jService } from '@/graph/Neo4jService';
import { GNNExportData } from '@/graph/types';
import { logger } from '@/utils/logger';

export class GNNExportService {
  constructor(private neo4j: Neo4jService) {}

  async exportForPyG(): Promise<GNNExportData> {
    const data = await this.exportGraph();
    return data;
  }

  async exportForDGL(): Promise<GNNExportData> {
    return this.exportGraph();
  }

  async exportForTFGNN(): Promise<GNNExportData> {
    return this.exportGraph();
  }

  private async exportGraph(): Promise<GNNExportData> {
    if (!this.neo4j.isConnected()) {
      return {
        nodeFeatures: [],
        edgeIndex: [[], []],
        nodeLabels: [],
        nodeTypes: [],
        trainMask: [],
        valMask: [],
        testMask: [],
      };
    }

    try {
      const nodeResult = await this.neo4j.readQuery(`
        MATCH (n)
        RETURN n, labels(n)[0] as nodeType
        LIMIT 1000
      `);

      const nodes = nodeResult.records;
      if (nodes.length === 0) {
        throw new Error('No nodes found in graph');
      }

      const typeMap = new Map<string, number>();
      const nodeTypes: string[] = [];
      const nodeFeatures: number[][] = [];
      const nodeIds: string[] = [];

      for (const record of nodes) {
        const node = record.get('n');
        const nodeType = record.get('nodeType') as string;
        const props = node.properties;

        if (!typeMap.has(nodeType)) {
          typeMap.set(nodeType, typeMap.size);
        }

        nodeTypes.push(nodeType);
        nodeIds.push(node.elementId);

        nodeFeatures.push([
          props.riskScore ?? 0,
          this.parseFloat(props.score) ?? 0,
          this.parseFloat(props.failedLogins) ?? 0,
          this.parseFloat(props.actionCount) ?? 0,
          props.proxy ? 1 : 0,
          props.vpn ? 1 : 0,
          props.tor ? 1 : 0,
          nodeType === 'Threat' ? 1 : 0,
          nodeType === 'User' ? 1 : 0,
          nodeType === 'Session' ? 1 : 0,
          nodeType === 'IP' ? 1 : 0,
          nodeType === 'Device' ? 1 : 0,
          nodeType === 'Resource' ? 1 : 0,
        ]);
      }

      const edgeResult = await this.neo4j.readQuery(`
        MATCH (a)-[r]->(b)
        RETURN a.elementId() as fromId, b.elementId() as toId
        LIMIT 5000
      `);

      const nodeIdToIndex = new Map(nodeIds.map((id, i) => [id, i]));
      const edgeIndex: number[][] = [[], []];

      for (const record of edgeResult.records) {
        const fromId = record.get('fromId');
        const toId = record.get('toId');
        const fromIdx = nodeIdToIndex.get(fromId);
        const toIdx = nodeIdToIndex.get(toId);
        if (fromIdx !== undefined && toIdx !== undefined) {
          edgeIndex[0].push(fromIdx);
          edgeIndex[1].push(toIdx);
        }
      }

      const nodeLabels = nodeTypes.map((t) => typeMap.get(t) ?? 0);
      const n = nodes.length;
      const trainMask = new Array(n).fill(false);
      const valMask = new Array(n).fill(false);
      const testMask = new Array(n).fill(false);

      const shuffled = Array.from({ length: n }, (_, i) => i).sort(() => Math.random() - 0.5);
      const trainCount = Math.floor(n * 0.7);
      const valCount = Math.floor(n * 0.15);

      for (let i = 0; i < trainCount; i++) trainMask[shuffled[i]] = true;
      for (let i = trainCount; i < trainCount + valCount; i++) valMask[shuffled[i]] = true;
      for (let i = trainCount + valCount; i < n; i++) testMask[shuffled[i]] = true;

      return { nodeFeatures, edgeIndex, nodeLabels, nodeTypes, trainMask, valMask, testMask };
    } catch (error) {
      logger.warn('GNNExportService.exportGraph error:', error);
      return {
        nodeFeatures: [],
        edgeIndex: [[], []],
        nodeLabels: [],
        nodeTypes: [],
        trainMask: [],
        valMask: [],
        testMask: [],
      };
    }
  }

  private parseFloat(val: unknown): number | null {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      const parsed = parseFloat(val);
      return isNaN(parsed) ? null : parsed;
    }
    if (val instanceof Number) return val.valueOf();
    return null;
  }
}
