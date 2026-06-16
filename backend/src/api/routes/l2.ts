import { Router } from 'express';
import axios from 'axios';

const l2Routes = Router();

l2Routes.post('/investigate', async (req, res) => {
  const l2Url = process.env.L2_AGENT_URL || 'http://127.0.0.1:8000/investigate';
  try {
    const response = await axios.post(l2Url, req.body, { timeout: 30000 });
    res.json(response.data);
  } catch (error) {
    res.status(502).json({
      error: 'L2 agent unavailable',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export { l2Routes };

