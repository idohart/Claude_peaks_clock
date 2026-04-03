import { getPromotionSnapshot } from './promotionWebData';

interface HandlerResult {
  status: number;
  headers: Record<string, string>;
  body: unknown;
}

export async function handlePromotions(): Promise<HandlerResult> {
  try {
    const snapshot = await getPromotionSnapshot();
    return {
      status: 200,
      headers: { 'Cache-Control': 'public, max-age=300', 'Content-Type': 'application/json' },
      body: snapshot,
    };
  } catch {
    return {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
      body: { error: 'promotion_fetch_failed', message: 'Failed to fetch promotion data. Please try again later.' },
    };
  }
}
