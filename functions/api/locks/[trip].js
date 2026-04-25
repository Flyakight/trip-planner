/**
 * GET  /api/locks/<trip-slug>  → returns the saved locks JSON (or [])
 * PUT  /api/locks/<trip-slug>  → overwrites with the request body (last write wins)
 *
 * Authority model: the trip slug is the password — same as the CSV at
 * /trips/<slug>.csv. Anyone with the URL can read/write. Don't share URLs.
 *
 * Requires a KV namespace binding named `LOCKS` in the Pages project.
 * (Settings → Functions → KV namespace bindings → Variable name: LOCKS)
 */

const SLUG_RE  = /^[a-z0-9][a-z0-9-]{2,79}$/;
const MAX_BYTES = 50_000;

export async function onRequest({ request, env, params }) {
  const trip = (params.trip || '').toLowerCase();
  if (!SLUG_RE.test(trip)) {
    return json({ error: 'Bad trip slug' }, 400);
  }
  if (!env.LOCKS) {
    return json({ error: 'KV namespace not bound. See DEPLOY.md.' }, 500);
  }

  if (request.method === 'GET') {
    const data = await env.LOCKS.get(trip);
    return new Response(data || '[]', {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
      },
    });
  }

  if (request.method === 'PUT') {
    const body = await request.text();
    if (body.length > MAX_BYTES) return json({ error: 'Payload too large' }, 413);
    // Validate it's JSON-parseable as an array (defense against junk writes)
    try {
      const parsed = JSON.parse(body);
      if (!Array.isArray(parsed)) throw new Error('not an array');
    } catch (_) {
      return json({ error: 'Body must be a JSON array' }, 400);
    }
    await env.LOCKS.put(trip, body);
    return json({ ok: true });
  }

  return json({ error: 'Method not allowed' }, 405);
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}
