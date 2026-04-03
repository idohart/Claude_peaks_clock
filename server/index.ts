import express from 'express';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

import { handlePromotions } from './handlers';

const app = express();
const port = Number.parseInt(process.env.PORT ?? '8787', 10);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(__dirname, '../dist');

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'rate_limited', message: 'Too many requests. Please try again later.' },
});

app.get('/api/health', (_req, res) => { res.json({ ok: true }); });

app.get('/api/promotions', apiLimiter, async (_req, res) => {
  const result = await handlePromotions();
  for (const [key, value] of Object.entries(result.headers)) {
    res.setHeader(key, value);
  }
  res.status(result.status).json(result.body);
});

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use((_req, res) => { res.sendFile(path.join(distPath, 'index.html')); });
}

app.listen(port, () => {
  console.log(`Claude Promotion Clock API listening on http://127.0.0.1:${port}`);
});
