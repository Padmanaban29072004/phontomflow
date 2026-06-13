import { Router, Request, Response } from 'express';
import { Neo4jService } from '@/graph/Neo4jService';
import { UserRepository } from '@/graph/repositories/UserRepository';
import { SessionRepository } from '@/graph/repositories/SessionRepository';
import { IPRepository } from '@/graph/repositories/IPRepository';
import { DeviceRepository } from '@/graph/repositories/DeviceRepository';
import { ResourceRepository } from '@/graph/repositories/ResourceRepository';
import { ThreatRepository } from '@/graph/repositories/ThreatRepository';
import { GraphThreatEngine } from '@/graph/GraphThreatEngine';
import { GNNExportService } from '@/graph/GNNExportService';
import { logger } from '@/utils/logger';

export function createGraphRouter(neo4j: Neo4jService): Router {
  const router = Router();
  const userRepo = new UserRepository(neo4j);
  const sessionRepo = new SessionRepository(neo4j);
  const ipRepo = new IPRepository(neo4j);
  const deviceRepo = new DeviceRepository(neo4j);
  const resourceRepo = new ResourceRepository(neo4j);
  const threatRepo = new ThreatRepository(neo4j);
  const threatEngine = new GraphThreatEngine(neo4j);
  const exportService = new GNNExportService(neo4j);

  /**
   * @route   GET /api/graph/health
   * @desc    Neo4j connection health check
   */
  router.get('/health', async (_req: Request, res: Response) => {
    try {
      const connected = await neo4j.healthCheck();
      const stats = connected ? await neo4j.getStats() : null;
      res.json({
        connected,
        stats,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.json({ connected: false, stats: null, timestamp: new Date().toISOString() });
    }
  });

  /**
   * @route   GET /api/graph/stats
   * @desc    Graph statistics
   */
  router.get('/stats', async (_req: Request, res: Response) => {
    try {
      const stats = await neo4j.getStats();
      res.json({ success: true, data: stats });
    } catch (error) {
      logger.error('Error getting graph stats:', error);
      res.status(500).json({ success: false, error: 'Failed to get graph stats' });
    }
  });

  /**
   * @route   GET /api/graph/nodes/:type
   * @desc    Query nodes by type with optional filters
   */
  router.get('/nodes/:type', async (req: Request, res: Response) => {
    try {
      const { type } = req.params;
      const { limit, offset, ...filters } = req.query;
      const allowedTypes = ['User', 'Session', 'IP', 'Device', 'Resource', 'Threat'];

      if (!allowedTypes.includes(type)) {
        res.status(400).json({ success: false, error: `Invalid node type: ${type}` });
        return;
      }

      const whereClauses: string[] = [];
      const params: Record<string, unknown> = {
        limit: parseInt(limit as string) || 100,
        offset: parseInt(offset as string) || 0,
      };

      for (const [key, value] of Object.entries(filters)) {
        if (typeof value === 'string') {
          whereClauses.push(`n.${key} CONTAINS $${key}`);
          params[key] = value;
        }
      }

      const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
      const query = `MATCH (n:${type}) ${whereStr} RETURN n SKIP $offset LIMIT $limit`;

      const result = await neo4j.readQuery(query, params);
      const nodes = result.records.map((r) => ({
        id: r.get('n').elementId,
        labels: [type],
        properties: r.get('n').properties,
      }));

      res.json({ success: true, data: nodes });
    } catch (error) {
      logger.error('Error querying nodes:', error);
      res.status(500).json({ success: false, error: 'Failed to query nodes' });
    }
  });

  /**
   * @route   GET /api/graph/relationships
   * @desc    Query relationships with filters
   */
  router.get('/relationships', async (req: Request, res: Response) => {
    try {
      const { type, limit = '100', offset = '0' } = req.query;
      const allowedTypes = ['USED', 'CONNECTED_TO', 'ATTACKED', 'ACCESSED', 'IMPERSONATED', 'ORIGINATED_FROM'];

      let query: string;
      const params = { limit: parseInt(limit as string), offset: parseInt(offset as string) };

      if (type && allowedTypes.includes(type as string)) {
        query = `MATCH ()-[r:${type}]->() RETURN r SKIP $offset LIMIT $limit`;
      } else {
        query = `MATCH ()-[r]->() RETURN r SKIP $offset LIMIT $limit`;
      }

      const result = await neo4j.readQuery(query, params);
      const relationships = result.records.map((r) => ({
        id: r.get('r').elementId,
        type: r.get('r').type,
        properties: r.get('r').properties,
      }));

      res.json({ success: true, data: relationships });
    } catch (error) {
      logger.error('Error querying relationships:', error);
      res.status(500).json({ success: false, error: 'Failed to query relationships' });
    }
  });

  /**
   * @route   POST /api/graph/query
   * @desc    Execute raw Cypher query (admin-protected)
   */
  router.post('/query', async (req: Request, res: Response) => {
    try {
      const { cypher, params = {} } = req.body;

      if (!cypher || typeof cypher !== 'string') {
        res.status(400).json({ success: false, error: 'Cypher query string required' });
        return;
      }

      if (/^\s*(CREATE|MERGE|SET|DELETE|REMOVE|DROP)\s/i.test(cypher)) {
        res.status(403).json({ success: false, error: 'Write queries not allowed via this endpoint' });
        return;
      }

      const result = await neo4j.readQuery(cypher, params);
      const records = result.records.map((r) => {
        const obj: Record<string, unknown> = {};
        (r.keys as string[]).forEach((key: string) => {
          const val = r.get(key);
          if (typeof val !== 'symbol') {
            obj[key] = val;
          }
        });
        return obj;
      });

      res.json({ success: true, data: records, summary: result.summary });
    } catch (error) {
      logger.error('Error executing Cypher query:', error);
      res.status(500).json({ success: false, error: 'Query execution failed' });
    }
  });

  /**
   * @route   GET /api/graph/threats/credential-stuffing
   * @desc    Detect credential stuffing patterns
   */
  router.get('/threats/credential-stuffing', async (_req: Request, res: Response) => {
    try {
      const results = await threatEngine.detectCredentialStuffing();
      res.json({ success: true, data: results });
    } catch (error) {
      logger.error('Error detecting credential stuffing:', error);
      res.status(500).json({ success: false, error: 'Detection failed' });
    }
  });

  /**
   * @route   GET /api/graph/threats/botnets
   * @desc    Detect botnet patterns
   */
  router.get('/threats/botnets', async (_req: Request, res: Response) => {
    try {
      const results = await threatEngine.detectBotnet();
      res.json({ success: true, data: results });
    } catch (error) {
      logger.error('Error detecting botnets:', error);
      res.status(500).json({ success: false, error: 'Detection failed' });
    }
  });

  /**
   * @route   GET /api/graph/threats/lateral-movement
   * @desc    Detect lateral movement patterns
   */
  router.get('/threats/lateral-movement', async (_req: Request, res: Response) => {
    try {
      const results = await threatEngine.detectLateralMovement();
      res.json({ success: true, data: results });
    } catch (error) {
      logger.error('Error detecting lateral movement:', error);
      res.status(500).json({ success: false, error: 'Detection failed' });
    }
  });

  /**
   * @route   GET /api/graph/threats/report
   * @desc    Combined threat report from all patterns
   */
  router.get('/threats/report', async (_req: Request, res: Response) => {
    try {
      const [credentialStuffing, botnets, lateralMovement] = await Promise.all([
        threatEngine.detectCredentialStuffing(),
        threatEngine.detectBotnet(),
        threatEngine.detectLateralMovement(),
      ]);

      const totalThreats = credentialStuffing.length + botnets.length + lateralMovement.length;
      const avgScore = totalThreats > 0
        ? [...credentialStuffing, ...botnets, ...lateralMovement]
            .reduce((sum, t) => sum + t.threatScore, 0) / totalThreats
        : 0;

      res.json({
        success: true,
        data: {
          summary: {
            totalThreats,
            averageScore: Math.round(avgScore * 100) / 100,
            criticalCount: [...credentialStuffing, ...botnets, ...lateralMovement]
              .filter((t) => t.threatScore >= 0.85).length,
            highCount: [...credentialStuffing, ...botnets, ...lateralMovement]
              .filter((t) => t.threatScore >= 0.7 && t.threatScore < 0.85).length,
          },
          credentialStuffing,
          botnets,
          lateralMovement,
          generatedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error('Error generating threat report:', error);
      res.status(500).json({ success: false, error: 'Report generation failed' });
    }
  });

  /**
   * @route   GET /api/graph/export/:framework
   * @desc    GNN export for specified framework
   */
  router.get('/export/:framework', async (req: Request, res: Response) => {
    try {
      const { framework } = req.params;
      let data;

      switch (framework) {
        case 'pyg':
          data = await exportService.exportForPyG();
          break;
        case 'dgl':
          data = await exportService.exportForDGL();
          break;
        case 'tf-gnn':
          data = await exportService.exportForTFGNN();
          break;
        default:
          res.status(400).json({
            success: false,
            error: `Unsupported framework: ${framework}. Use: pyg, dgl, or tf-gnn`,
          });
          return;
      }

      res.json({ success: true, data, framework });
    } catch (error) {
      logger.error('Error exporting graph:', error);
      res.status(500).json({ success: false, error: 'Export failed' });
    }
  });

  return router;
}
