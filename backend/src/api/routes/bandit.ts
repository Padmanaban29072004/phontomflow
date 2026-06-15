import { Router, Request, Response } from 'express';
import { AdaptiveDecisionEngine } from '@/services/AdaptiveDecisionEngine';
import { FeedbackCollector, FeedbackSignal } from '@/services/FeedbackCollector';
import { BanditContext, BANDIT_ACTIONS } from '@/types/bandit';
import { logger } from '@/utils/logger';

export function createBanditRouter(
  engine: AdaptiveDecisionEngine,
  feedbackCollector: FeedbackCollector,
): Router {
  const router = Router();

  /**
   * @route   GET /api/bandit/actions
   * @desc    List all available bandit actions with descriptions
   */
  router.get('/actions', (_req: Request, res: Response) => {
    res.json({
      success: true,
      data: {
        actions: [
          { id: 'allow',    description: 'Allow request to proceed normally (no-op)', severity: 0 },
          { id: 'monitor',  description: 'Passive monitoring — log only', severity: 1 },
          { id: 'warn',     description: 'Active monitoring with light rate limiting', severity: 2 },
          { id: 'restrict', description: 'Moderate restriction with rate limiting and alerts', severity: 3 },
          { id: 'block',    description: 'Temporary block with session suspension', severity: 4 },
          { id: 'isolate',  description: 'Maximum security isolation with extended block', severity: 5 },
          { id: 'divert',   description: 'Redirect to deception/honeypot environment', severity: 6 },
        ],
        contextBuckets: ['threat_low_reputation_trusted', 'threat_low_reputation_unknown', 'threat_low_reputation_suspicious', 'threat_medium_reputation_trusted', 'threat_medium_reputation_unknown', 'threat_medium_reputation_suspicious', 'threat_high_reputation_trusted', 'threat_high_reputation_unknown', 'threat_high_reputation_suspicious'],
      },
    });
  });

  /**
   * @route   GET /api/bandit/stats
   * @desc    Get bandit state and statistics for all contexts
   */
  router.get('/stats', (req: Request, res: Response) => {
    try {
      const contextFilter = req.query.context as string | undefined;
      const bandit = engine.getBandit();

      let stats: Record<string, unknown>;

      if (contextFilter) {
        stats = { [contextFilter]: bandit.getAllStats()[contextFilter] };
        if (!stats[contextFilter]) {
          res.status(404).json({ success: false, error: `Context not found: ${contextFilter}` });
          return;
        }
      } else {
        stats = bandit.getAllStats();
      }

      const feedbackStats = feedbackCollector.getStats();

      res.json({
        success: true,
        data: {
          contexts: stats,
          feedback: feedbackStats,
          config: engine.getConfig(),
        },
      });
    } catch (error) {
      logger.error('Error getting bandit stats:', error);
      res.status(500).json({ success: false, error: 'Failed to get bandit stats' });
    }
  });

  /**
   * @route   POST /api/bandit/feedback
   * @desc    Submit manual feedback for a bandit decision
   */
  router.post('/feedback', (req: Request, res: Response) => {
    try {
      const { action, context, signals, sessionId, userId } = req.body;

      if (!action || !BANDIT_ACTIONS.includes(action)) {
        res.status(400).json({ success: false, error: `Invalid action. Must be one of: ${BANDIT_ACTIONS.join(', ')}` });
        return;
      }

      if (!context || !context.threatBucket || !context.reputationTier) {
        res.status(400).json({ success: false, error: 'Invalid context. Must include threatBucket and reputationTier' });
        return;
      }

      if (!signals || !Array.isArray(signals) || signals.length === 0) {
        res.status(400).json({ success: false, error: 'At least one feedback signal is required' });
        return;
      }

      const validSignals: FeedbackSignal[] = [
        'true_positive', 'false_positive',
        'user_satisfied', 'user_unsatisfied',
        'cost_low', 'cost_high',
        'threat_reduced', 'threat_persisted',
      ];

      for (const signal of signals) {
        if (!validSignals.includes(signal)) {
          res.status(400).json({ success: false, error: `Invalid signal: ${signal}` });
          return;
        }
      }

      const reward = feedbackCollector.submitManualFeedback(
        action,
        context as BanditContext,
        signals as FeedbackSignal[],
        sessionId,
        userId,
      );

      logger.info('Manual feedback submitted', {
        action,
        context,
        signals,
        reward: reward.toFixed(3),
        sessionId,
      });

      res.json({
        success: true,
        data: { reward, action, context },
      });
    } catch (error) {
      logger.error('Error submitting feedback:', error);
      res.status(500).json({ success: false, error: 'Failed to submit feedback' });
    }
  });

  /**
   * @route   GET /api/bandit/feedback
   * @desc    Get recent feedback history
   */
  router.get('/feedback', (req: Request, res: Response) => {
    try {
      const count = Math.min(parseInt(req.query.count as string) || 20, 100);
      const recent = feedbackCollector.getRecentFeedback(count);
      res.json({ success: true, data: recent });
    } catch (error) {
      logger.error('Error getting feedback:', error);
      res.status(500).json({ success: false, error: 'Failed to get feedback' });
    }
  });

  /**
   * @route   POST /api/bandit/reset
   * @desc    Reset bandit state to warm-start priors (dev only)
   */
  router.post('/reset', (req: Request, res: Response) => {
    try {
      const isDev = process.env.NODE_ENV === 'development';
      if (!isDev) {
        res.status(403).json({ success: false, error: 'Reset only allowed in development mode' });
        return;
      }

      engine.getBandit().reset();

      logger.info('Bandit state reset to warm-start priors');

      res.json({ success: true, message: 'Bandit state reset to warm-start priors' });
    } catch (error) {
      logger.error('Error resetting bandit:', error);
      res.status(500).json({ success: false, error: 'Failed to reset bandit' });
    }
  });

  return router;
}
