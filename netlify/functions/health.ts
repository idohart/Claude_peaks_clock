export default async function handler(): Promise<Response> {
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
