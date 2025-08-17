import { Router, Request, Response } from 'express';
import { logger } from '@/utils/logger';
import path from 'path';
import fs from 'fs';

const router = Router();

/**
 * @route   GET /api/docs
 * @desc    Serve API documentation HTML page
 * @access  Public
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    logger.info('API documentation requested:', { ip: req.ip });
    
    const htmlPath = path.join(__dirname, 'index.html');
    
    if (fs.existsSync(htmlPath)) {
      const htmlContent = fs.readFileSync(htmlPath, 'utf8');
      res.setHeader('Content-Type', 'text/html');
      res.send(htmlContent);
    } else {
      res.status(404).json({
        success: false,
        message: 'API documentation not found'
      });
    }
  } catch (error) {
    logger.error('Error serving API documentation:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @route   GET /api/docs/health
 * @desc    Health check for documentation service
 * @access  Public
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      message: 'API Documentation service is running',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    });
  } catch (error) {
    logger.error('Documentation health check error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

export const docsRoutes = router;
