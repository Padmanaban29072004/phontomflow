import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { PlaybookExecutor } from '../soar/executor';
import { PlaybookSchema, validatePlaybook } from '../soar/playbook.schema';

const router = Router();
const executor = new PlaybookExecutor();
const playbooksDir = path.join(__dirname, '..', 'soar', 'playbooks');

function loadPlaybookById(id: string): PlaybookSchema | null {
  const filePath = path.join(playbooksDir, `${id}.json`);
  if (!fs.existsSync(filePath)) return null;
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  validatePlaybook(parsed);
  return parsed;
}

router.get('/', (_req, res) => {
  if (!fs.existsSync(playbooksDir)) {
    res.json([]);
    return;
  }
  const files = fs.readdirSync(playbooksDir).filter((f) => f.endsWith('.json'));
  res.json(files.map((f) => ({ id: f.replace('.json', ''), file: f })));
});

router.get('/:id', (req, res) => {
  const playbook = loadPlaybookById(req.params.id);
  if (!playbook) {
    res.status(404).json({ error: 'Playbook not found' });
    return;
  }
  res.json(playbook);
});

router.post('/', (req, res) => {
  try {
    validatePlaybook(req.body);
    const filePath = path.join(playbooksDir, `${req.body.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(req.body, null, 2), 'utf8');
    res.status(201).json({ ok: true, id: req.body.id });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid playbook' });
  }
});

router.put('/:id', (req, res) => {
  try {
    validatePlaybook(req.body);
    const filePath = path.join(playbooksDir, `${req.params.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(req.body, null, 2), 'utf8');
    res.json({ ok: true, id: req.params.id });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid playbook' });
  }
});

router.delete('/:id', (req, res) => {
  const filePath = path.join(playbooksDir, `${req.params.id}.json`);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  res.json({ ok: true });
});

router.post('/:id/trigger', async (req, res) => {
  const playbook = loadPlaybookById(req.params.id);
  if (!playbook) {
    res.status(404).json({ error: 'Playbook not found' });
    return;
  }
  const result = await executor.execute(playbook, req.body?.operator === 'human' ? 'human' : 'system');
  res.json(result);
});

export default router;

