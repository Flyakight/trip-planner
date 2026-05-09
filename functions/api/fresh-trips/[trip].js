/**
 * GET /api/trips/<trip-slug> -> returns published admin CSV override
 * PUT /api/trips/<trip-slug> -> publishes edited CSV for clients
 *
 * Requires a KV namespace binding named `ITINERARIES`.
 * The static trips/<slug>.csv file remains the fallback/source of last resort.
 */

const SLUG_RE = /^[a-z0-9][a-z0-9-]{2,79}$/;
const REQUIRED = [
  'Date','WakeUp','Sleep','Type','Category','TimeSlot',
  'Title','Location','MapLink','Details','ConfNo','Cost','TicketLink',
];
const MAX_BYTES = 1_000_000;

export async function onRequest({ request, env, params }) {
  const trip = (params.trip || '').toLowerCase();
  if (!SLUG_RE.test(trip)) return json({ error: 'Bad trip slug' }, 400);
  if (!env.ITINERARIES) return json({ error: 'ITINERARIES KV namespace not bound.' }, 500);

  if (request.method === 'GET') {
    const csv = await env.ITINERARIES.get(trip);
    if (!csv) return json({ error: 'No published itinerary override.' }, 404);
    return new Response(csv, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'cache-control': 'no-store',
      },
    });
  }

  if (request.method === 'PUT') {
    const csv = await request.text();
    if (csv.length > MAX_BYTES) return json({ error: 'Payload too large' }, 413);
    const firstLine = csv.split(/\r?\n/, 1)[0] || '';
    const missing = REQUIRED.filter(h => !csvHeaderIncludes(firstLine, h));
    if (missing.length) {
      return json({ error: `Missing required columns: ${missing.join(', ')}` }, 400);
    }
    await env.ITINERARIES.put(trip, csv);
    return json({ ok: true });
  }

  return json({ error: 'Method not allowed' }, 405);
}

function csvHeaderIncludes(line, header) {
  return line.split(',').map(h => h.trim().replace(/^"|"$/g, '')).includes(header);
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}
