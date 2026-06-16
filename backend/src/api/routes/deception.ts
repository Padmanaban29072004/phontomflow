import { Router, Request, Response } from 'express';
import { DeceptionService } from '@/services/DeceptionService';
import { logger } from '@/utils/logger';

export function createDeceptionRouter(deceptionService: DeceptionService): Router {
  const router = Router();

  router.get('/events', async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const events = await deceptionService.getDeceptionEvents(limit);
      res.json({ success: true, data: events, total: events.length });
    } catch (error) {
      logger.error('Get deception events error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });

  router.get('/stats', async (_req: Request, res: Response) => {
    try {
      const stats = await deceptionService.getDeceptionStats();
      const traps = deceptionService.getActiveTraps();
      const trapArray = Array.from(traps.entries());
      const trapTypes: Record<string, number> = {};
      const threatLevels: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };

      for (const [, trap] of trapArray) {
        trapTypes[trap.type] = (trapTypes[trap.type] || 0) + 1;
      }

      res.json({
        success: true,
        data: {
          totalEvents: stats.totalEvents || 0,
          eventsToday: 0,
          eventsThisWeek: 0,
          activeTraps: trapArray.length,
          trapTypes,
          threatLevels,
        },
      });
    } catch (error) {
      logger.error('Get deception stats error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });

  router.get('/traps', async (_req: Request, res: Response) => {
    try {
      const traps = deceptionService.getActiveTraps();
      const trapList = Array.from(traps.entries()).map(([id, trap]) => ({
        id,
        type: trap.type,
        created: trap.created,
        accessCount: trap.accessCount,
        status: 'active',
      }));
      res.json({ success: true, data: trapList });
    } catch (error) {
      logger.error('Get deception traps error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });

  router.post('/traps', async (req: Request, res: Response) => {
    try {
      const { type, path, credential, filename } = req.body;
      await deceptionService.createTrap({ type, path, credential, filename });
      res.status(201).json({ success: true, message: 'Deception trap created successfully' });
    } catch (error) {
      logger.error('Create deception trap error:', error);
      res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Internal server error' });
    }
  });

  router.put('/traps/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await deceptionService.updateTrap(id, req.body);
      res.json({ success: true, message: 'Deception trap updated successfully' });
    } catch (error) {
      logger.error('Update deception trap error:', error);
      res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Internal server error' });
    }
  });

  router.delete('/traps/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await deceptionService.deleteTrap(id);
      res.json({ success: true, message: 'Deception trap deleted successfully' });
    } catch (error) {
      logger.error('Delete deception trap error:', error);
      res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Internal server error' });
    }
  });

  router.post('/trigger', async (req: Request, res: Response) => {
    try {
      const { type, ipAddress, userAgent, details } = req.body;
      const event = await deceptionService.triggerEvent(type || 'manual_trigger', {
        ipAddress: ipAddress || req.ip,
        userAgent: userAgent || req.get('User-Agent'),
        details: details || {},
      });
      res.json({ success: true, data: event, message: 'Deception event triggered successfully' });
    } catch (error) {
      logger.error('Manual deception trigger error:', error);
      res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Internal server error' });
    }
  });

  return router;
}
