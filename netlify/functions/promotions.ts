import { getPromotionSnapshot } from '../../server/promotionWebData';

export default async function handler(): Promise<Response> {
  try {
    const snapshot = await getPromotionSnapshot();
    return new Response(JSON.stringify(snapshot), {
      headers: {
        'Cache-Control': 'public, max-age=300',
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: 'promotion_fetch_failed',
        message: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
  }
}
