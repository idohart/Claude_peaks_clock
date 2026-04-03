import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

import { getPromotionSnapshot } from './promotionWebData';

const app = express();
const port = Number.parseInt(process.env.PORT ?? '8787', 10);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(__dirname, '../dist');

app.use(express.json());

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

app.post('/api/capacity-probe', async (request, response) => {
  const apiKey = request.body?.apiKey;
  if (!apiKey || typeof apiKey !== 'string') {
    response.status(400).json({ error: 'missing_api_key' });
    return;
  }

  try {
    const probeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      }),
    });

    const rateLimitHeaders: Record<string, string> = {};
    for (const header of [
      'anthropic-ratelimit-requests-limit',
      'anthropic-ratelimit-requests-remaining',
      'anthropic-ratelimit-requests-reset',
      'anthropic-ratelimit-tokens-limit',
      'anthropic-ratelimit-tokens-remaining',
      'anthropic-ratelimit-tokens-reset',
      'retry-after',
    ]) {
      const value = probeResponse.headers.get(header);
      if (value) {
        rateLimitHeaders[header] = value;
      }
    }

    response.json({
      status: probeResponse.status,
      rateLimits: rateLimitHeaders,
    });
  } catch (error) {
    response.status(502).json({
      error: 'probe_failed',
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
