// Cloudflare Pages Function: POST /api/embed  { q: string } -> { vec: number[] }
//
// Embeds ONLY the user's search query with Cohere, so the API key stays server-
// side. The document vectors are built at deploy time (scripts/build-search-
// vectors.mjs) and served as a static file. Identical queries are cached at the
// edge for a day.

const MODEL = 'embed-v4.0';
const DIM = 512;

export async function onRequestPost(context) {
  const { request, env, waitUntil } = context;

  if (!env.COHERE_API_KEY) {
    return json({ error: 'semantic search not configured' }, 503);
  }

  let q;
  try {
    ({ q } = await request.json());
  } catch {
    return json({ error: 'bad request' }, 400);
  }
  if (typeof q !== 'string') return json({ error: 'bad request' }, 400);
  q = q.trim().slice(0, 300);
  if (q.length < 2) return json({ error: 'query too short' }, 400);

  const cache = caches.default;
  const cacheKey = new Request(
    `https://tiredpilots.ca/_embed?q=${encodeURIComponent(q.toLowerCase())}`,
  );
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const res = await fetch('https://api.cohere.com/v2/embed', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.COHERE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      input_type: 'search_query',
      output_dimension: DIM,
      embedding_types: ['float'],
      texts: [q],
    }),
  });

  if (!res.ok) {
    return json({ error: 'embedding failed' }, 502);
  }
  const data = await res.json();
  const vec = data?.embeddings?.float?.[0];
  if (!Array.isArray(vec)) return json({ error: 'embedding failed' }, 502);

  const out = json({ vec: vec.map((n) => Math.round(n * 1e6) / 1e6) }, 200, {
    'cache-control': 'public, max-age=86400',
  });
  waitUntil(cache.put(cacheKey, out.clone()));
  return out;
}

function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...extra },
  });
}
