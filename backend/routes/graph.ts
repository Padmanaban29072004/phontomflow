import { Router } from 'express';
import { queryKillChainSubgraph } from '../graph/killchain';
import { detectLateralMovementPaths } from '../graph/lateralMovement';

const router = Router();

router.get('/killchain', async (req, res) => {
  const sourceIp = String(req.query.sourceIp || '');
  const windowHours = Number(req.query.windowHours || 6);
  if (!sourceIp) {
    res.status(400).json({ error: 'sourceIp is required' });
    return;
  }
  const data = await queryKillChainSubgraph(sourceIp, windowHours);
  res.json(data);
});

router.get('/lateral-movement', async (req, res) => {
  const sourceHost = String(req.query.sourceHost || '');
  const maxDepth = Number(req.query.maxDepth || 4);
  if (!sourceHost) {
    res.status(400).json({ error: 'sourceHost is required' });
    return;
  }
  const paths = await detectLateralMovementPaths(sourceHost, maxDepth);
  res.json({ count: paths.length, paths });
});

export default router;

