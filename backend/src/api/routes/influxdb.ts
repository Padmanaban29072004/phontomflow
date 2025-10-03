/**
 * InfluxDB API Routes
 * REST API endpoints for InfluxDB data access and management
 */

import { Router, Request, Response } from 'express';
import { logger } from '@/utils/logger';
import { InfluxDBIntegration } from '@/services/InfluxDBIntegration';

const router = Router();

// Initialize InfluxDB integration
let influxIntegration: InfluxDBIntegration | null = null;

// Initialize InfluxDB integration on startup
(async () => {
  try {
    influxIntegration = new InfluxDBIntegration();
    await influxIntegration.initialize();
    logger.info('InfluxDB integration initialized for API routes');
  } catch (error) {
    logger.error('Failed to initialize InfluxDB integration for API routes:', error);
  }
})();

// ============================================================================
// HEALTH AND STATUS ENDPOINTS
// ============================================================================

/**
 * @route   GET /api/influxdb/health
 * @desc    Get InfluxDB health status
 * @access  Private
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    if (!influxIntegration) {
      return res.status(503).json({
        success: false,
        message: 'InfluxDB integration not available'
      });
    }

    const healthStatus = await influxIntegration.getHealthStatus();
    
    return res.json({
      success: true,
      data: healthStatus,
      message: 'InfluxDB health status retrieved successfully'
    });
  } catch (error) {
    logger.error('Get InfluxDB health error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @route   GET /api/influxdb/status
 * @desc    Get InfluxDB integration status
 * @access  Private
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    if (!influxIntegration) {
      return res.status(503).json({
        success: false,
        message: 'InfluxDB integration not available'
      });
    }

    const isReady = influxIntegration.isReady();
    const pendingMetrics = influxIntegration.getPendingMetricsCount();
    
    return res.json({
      success: true,
      data: {
        ready: isReady,
        pendingMetrics,
        timestamp: new Date().toISOString()
      },
      message: 'InfluxDB status retrieved successfully'
    });
  } catch (error) {
    logger.error('Get InfluxDB status error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// ============================================================================
// PERFORMANCE METRICS ENDPOINTS
// ============================================================================

/**
 * @route   GET /api/influxdb/performance
 * @desc    Get performance metrics report
 * @access  Private
 */
router.get('/performance', async (req: Request, res: Response) => {
  try {
    if (!influxIntegration) {
      return res.status(503).json({
        success: false,
        message: 'InfluxDB integration not available'
      });
    }

    const { startTime, endTime } = req.query;
    
    const start = startTime ? new Date(startTime as string) : undefined;
    const end = endTime ? new Date(endTime as string) : undefined;
    
    const report = await influxIntegration.getPerformanceReport(start, end);
    
    return res.json({
      success: true,
      data: report,
      message: 'Performance report retrieved successfully'
    });
  } catch (error) {
    logger.error('Get performance report error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @route   GET /api/influxdb/performance/realtime
 * @desc    Get real-time performance metrics
 * @access  Private
 */
router.get('/performance/realtime', async (req: Request, res: Response) => {
  try {
    if (!influxIntegration) {
      return res.status(503).json({
        success: false,
        message: 'InfluxDB integration not available'
      });
    }

    const { lastMinutes = '5' } = req.query;
    const minutes = parseInt(lastMinutes as string);
    
    const metrics = await influxIntegration.getRealTimeMetrics('performance_metrics', minutes);
    
    return res.json({
      success: true,
      data: metrics,
      message: 'Real-time performance metrics retrieved successfully'
    });
  } catch (error) {
    logger.error('Get real-time performance metrics error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// ============================================================================
// THREAT ANALYTICS ENDPOINTS
// ============================================================================

/**
 * @route   GET /api/influxdb/threats
 * @desc    Get threat analytics report
 * @access  Private
 */
router.get('/threats', async (req: Request, res: Response) => {
  try {
    if (!influxIntegration) {
      return res.status(503).json({
        success: false,
        message: 'InfluxDB integration not available'
      });
    }

    const { startTime, endTime } = req.query;
    
    const start = startTime ? new Date(startTime as string) : undefined;
    const end = endTime ? new Date(endTime as string) : undefined;
    
    const analytics = await influxIntegration.getThreatAnalytics(start, end);
    
    return res.json({
      success: true,
      data: analytics,
      message: 'Threat analytics retrieved successfully'
    });
  } catch (error) {
    logger.error('Get threat analytics error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @route   GET /api/influxdb/threats/realtime
 * @desc    Get real-time threat metrics
 * @access  Private
 */
router.get('/threats/realtime', async (req: Request, res: Response) => {
  try {
    if (!influxIntegration) {
      return res.status(503).json({
        success: false,
        message: 'InfluxDB integration not available'
      });
    }

    const { lastMinutes = '5' } = req.query;
    const minutes = parseInt(lastMinutes as string);
    
    const metrics = await influxIntegration.getRealTimeMetrics('threat_detection', minutes);
    
    return res.json({
      success: true,
      data: metrics,
      message: 'Real-time threat metrics retrieved successfully'
    });
  } catch (error) {
    logger.error('Get real-time threat metrics error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// ============================================================================
// USER BEHAVIOR ENDPOINTS
// ============================================================================

/**
 * @route   GET /api/influxdb/behavior
 * @desc    Get user behavior analytics
 * @access  Private
 */
router.get('/behavior', async (req: Request, res: Response) => {
  try {
    if (!influxIntegration) {
      return res.status(503).json({
        success: false,
        message: 'InfluxDB integration not available'
      });
    }

    const { startTime, endTime, lastMinutes = '60' } = req.query;
    
    let start: Date | undefined;
    let end: Date | undefined;
    
    if (startTime && endTime) {
      start = new Date(startTime as string);
      end = new Date(endTime as string);
    } else {
      const minutes = parseInt(lastMinutes as string);
      end = new Date();
      start = new Date(end.getTime() - minutes * 60 * 1000);
    }
    
    const metrics = await influxIntegration.getRealTimeMetrics('user_behavior', 
      startTime && endTime ? undefined : parseInt(lastMinutes as string));
    
    return res.json({
      success: true,
      data: metrics,
      message: 'User behavior analytics retrieved successfully'
    });
  } catch (error) {
    logger.error('Get user behavior analytics error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// ============================================================================
// SYSTEM HEALTH ENDPOINTS
// ============================================================================

/**
 * @route   GET /api/influxdb/system
 * @desc    Get system health metrics
 * @access  Private
 */
router.get('/system', async (req: Request, res: Response) => {
  try {
    if (!influxIntegration) {
      return res.status(503).json({
        success: false,
        message: 'InfluxDB integration not available'
      });
    }

    const { lastMinutes = '60' } = req.query;
    const minutes = parseInt(lastMinutes as string);
    
    const metrics = await influxIntegration.getRealTimeMetrics('system_health', minutes);
    
    return res.json({
      success: true,
      data: metrics,
      message: 'System health metrics retrieved successfully'
    });
  } catch (error) {
    logger.error('Get system health metrics error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// ============================================================================
// RATE LIMITING ENDPOINTS
// ============================================================================

/**
 * @route   GET /api/influxdb/rate-limiting
 * @desc    Get rate limiting metrics
 * @access  Private
 */
router.get('/rate-limiting', async (req: Request, res: Response) => {
  try {
    if (!influxIntegration) {
      return res.status(503).json({
        success: false,
        message: 'InfluxDB integration not available'
      });
    }

    const { lastMinutes = '60' } = req.query;
    const minutes = parseInt(lastMinutes as string);
    
    const metrics = await influxIntegration.getRealTimeMetrics('rate_limiting', minutes);
    
    return res.json({
      success: true,
      data: metrics,
      message: 'Rate limiting metrics retrieved successfully'
    });
  } catch (error) {
    logger.error('Get rate limiting metrics error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// ============================================================================
// STORAGE MANAGEMENT ENDPOINTS
// ============================================================================

/**
 * @route   GET /api/influxdb/storage
 * @desc    Get storage usage information
 * @access  Private
 */
router.get('/storage', async (req: Request, res: Response) => {
  try {
    if (!influxIntegration) {
      return res.status(503).json({
        success: false,
        message: 'InfluxDB integration not available'
      });
    }

    const usage = await influxIntegration.getStorageUsage();
    
    return res.json({
      success: true,
      data: usage,
      message: 'Storage usage retrieved successfully'
    });
  } catch (error) {
    logger.error('Get storage usage error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @route   GET /api/influxdb/storage/limit
 * @desc    Check storage limit status
 * @access  Private
 */
router.get('/storage/limit', async (req: Request, res: Response) => {
  try {
    if (!influxIntegration) {
      return res.status(503).json({
        success: false,
        message: 'InfluxDB integration not available'
      });
    }

    const limitStatus = await influxIntegration.checkStorageLimit();
    
    return res.json({
      success: true,
      data: limitStatus,
      message: 'Storage limit status retrieved successfully'
    });
  } catch (error) {
    logger.error('Get storage limit status error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// ============================================================================
// UTILITY ENDPOINTS
// ============================================================================

/**
 * @route   POST /api/influxdb/flush
 * @desc    Flush pending metrics to InfluxDB
 * @access  Private
 */
router.post('/flush', async (req: Request, res: Response) => {
  try {
    if (!influxIntegration) {
      return res.status(503).json({
        success: false,
        message: 'InfluxDB integration not available'
      });
    }

    await influxIntegration.flushMetrics();
    
    return res.json({
      success: true,
      message: 'Metrics flushed successfully'
    });
  } catch (error) {
    logger.error('Flush metrics error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @route   GET /api/influxdb/metrics/pending
 * @desc    Get count of pending metrics
 * @access  Private
 */
router.get('/metrics/pending', async (req: Request, res: Response) => {
  try {
    if (!influxIntegration) {
      return res.status(503).json({
        success: false,
        message: 'InfluxDB integration not available'
      });
    }

    const pendingCount = influxIntegration.getPendingMetricsCount();
    
    return res.json({
      success: true,
      data: {
        pendingCount,
        timestamp: new Date().toISOString()
      },
      message: 'Pending metrics count retrieved successfully'
    });
  } catch (error) {
    logger.error('Get pending metrics count error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// ============================================================================
// DASHBOARD DATA ENDPOINTS
// ============================================================================

/**
 * @route   GET /api/influxdb/dashboard/summary
 * @desc    Get dashboard summary data
 * @access  Private
 */
router.get('/dashboard/summary', async (req: Request, res: Response) => {
  try {
    if (!influxIntegration) {
      return res.status(503).json({
        success: false,
        message: 'InfluxDB integration not available'
      });
    }

    const { lastHours = '24' } = req.query;
    const hours = parseInt(lastHours as string);
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - hours * 60 * 60 * 1000);

    // Get data from multiple sources
    const [performance, threats, systemHealth] = await Promise.all([
      influxIntegration.getPerformanceReport(startTime, endTime).catch(() => null),
      influxIntegration.getThreatAnalytics(startTime, endTime).catch(() => null),
      influxIntegration.getRealTimeMetrics('system_health', 60).catch(() => null)
    ]);

    const summary = {
      timeRange: {
        start: startTime,
        end: endTime,
        hours
      },
      performance: performance ? {
        averageResponseTime: performance.metrics?.averageResponseTime || 0,
        throughput: performance.metrics?.throughput || 0,
        errorRate: performance.metrics?.errorRate || 0
      } : null,
      threats: threats ? {
        totalThreats: threats.summary?.totalThreats || 0,
        blockedThreats: threats.summary?.blockedThreats || 0,
        averageRiskScore: threats.summary?.averageRiskScore || 0
      } : null,
      systemHealth: systemHealth ? {
        uptime: systemHealth.data?.[0]?.uptime || 0,
        cpuUsage: systemHealth.data?.[0]?.cpu_usage || 0,
        memoryUsage: systemHealth.data?.[0]?.memory_usage || 0
      } : null,
      timestamp: new Date().toISOString()
    };

    return res.json({
      success: true,
      data: summary,
      message: 'Dashboard summary retrieved successfully'
    });
  } catch (error) {
    logger.error('Get dashboard summary error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

export const influxdbRoutes = router;
