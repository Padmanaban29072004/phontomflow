import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { PlaybookExecutor } from '@/core/soar/PlaybookExecutor';
import { PlaybookSchema, validatePlaybook } from '@/core/soar/types';

const playbooksRoutes = Router();
const executor = new PlaybookExecutor();

const playbooksDir = path.resolve(process.cwd(), 'soar', 'playbooks');

function ensurePlaybooksDir(): void {
  if (!fs.existsSync(playbooksDir)) {
    fs.mkdirSync(playbooksDir, { recursive: true });
  }
}

function readPlaybook(id: string): PlaybookSchema | null {
  ensurePlaybooksDir();
  const filePath = path.join(playbooksDir, `${id}.json`);
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(content);
  validatePlaybook(parsed);
  return parsed;
}

playbooksRoutes.get('/', (_req, res) => {
  ensurePlaybooksDir();
  const files = fs
    .readdirSync(playbooksDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({ id: f.replace('.json', ''), file: f }));
  res.json(files);
});

playbooksRoutes.get('/:id', (req, res) => {
  try {
    const playbook = readPlaybook(req.params.id);
    if (!playbook) {
      res.status(404).json({ error: 'Playbook not found' });
      return;
    }
    res.json(playbook);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to load playbook' });
  }
});

playbooksRoutes.post('/', (req, res) => {
  try {
    ensurePlaybooksDir();
    validatePlaybook(req.body);
    const filePath = path.join(playbooksDir, `${req.body.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(req.body, null, 2), 'utf8');
    res.status(201).json({ ok: true, id: req.body.id });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid playbook payload' });
  }
});

playbooksRoutes.put('/:id', (req, res) => {
  try {
    ensurePlaybooksDir();
    validatePlaybook(req.body);
    const filePath = path.join(playbooksDir, `${req.params.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(req.body, null, 2), 'utf8');
    res.json({ ok: true, id: req.params.id });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid playbook payload' });
  }
});

playbooksRoutes.delete('/:id', (req, res) => {
  ensurePlaybooksDir();
  const filePath = path.join(playbooksDir, `${req.params.id}.json`);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  res.json({ ok: true });
});

playbooksRoutes.post('/:id/trigger', async (req, res) => {
  try {
    const playbook = readPlaybook(req.params.id);
    if (!playbook) {
      res.status(404).json({ error: 'Playbook not found' });
      return;
    }
    const context = req.body?.context || {};
    const result = await executor.execute(playbook, context, req.body?.operator === 'human' ? 'human' : 'system');
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to execute playbook' });
  }
});

export { playbooksRoutes };

