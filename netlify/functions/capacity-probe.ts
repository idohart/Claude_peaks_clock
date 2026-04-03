export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: { apiKey?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const apiKey = body?.apiKey;
  if (!apiKey || typeof apiKey !== 'string') {
    return new Response(JSON.stringify({ error: 'missing_api_key' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
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

    return new Response(JSON.stringify({ status: probeResponse.status, rateLimits: rateLimitHeaders }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: 'probe_failed',
        message: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}
