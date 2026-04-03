import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

import { getPromotionSnapshot } from './promotionWebData';

const app = express();
const port = Number.parseInt(process.env.PORT ?? '8787', 10);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(__dirname, '../dist');

app.get('/api/health', (_request, response) => {
  response.json({ ok: true });
});

app.get('/api/promotions', async (_request, response) => {
  try {
    const snapshot = await getPromotionSnapshot();
    response.setHeader('Cache-Control', 'public, max-age=300');
    response.json(snapshot);
  } catch (error) {
    response.status(502).json({
      error: 'promotion_fetch_failed',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));

  app.use((_request, response) => {
    response.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(port, () => {
  console.log(`Claude Promotion Clock API listening on http://127.0.0.1:${port}`);
});
