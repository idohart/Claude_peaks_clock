import { handlePromotions } from '../../server/handlers';

export default async function handler(): Promise<Response> {
  const result = await handlePromotions();
  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: result.headers,
  });
}
