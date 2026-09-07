// Cloudflare Pages Function: POST /api/embed  { q: string } -> { vec: number[] }
//
// Embeds ONLY the user's search query with Cohere, so the API key stays server-
// side. The document vectors are built at deploy time (scripts/build-search-
// vectors.mjs) and served as a static file. Identical queries are cached at the
// edge for a day.
//
// Abuse controls (this is a paid upstream call, so it is worth protecting):
//   - Same-origin only: the Origin/Referer must be one of our own hosts. This
//     stops other websites and casual scripts from billing our Cohere key.
//   - Small body only: a query is a search box, not a document.
//   - Length-clamped and edge-cached: repeated queries never reach Cohere.
//   - A Cloudflare WAF rate-limiting rule on /api/embed and a Cohere spend cap
//     are the backstops for a determined caller — see docs/PRE-LAUNCH-SECURITY.md.

const MODEL = 'embed-v4.0';
const DIM = 512;
const MAX_BODY_BYTES = 2048;

// Hosts allowed to call this endpoint from the browser. Covers the apex, www,
// the *.pages.dev project domain, and per-PR preview deployments.
function originAllowed(value) {
  if (!value) return false;
  let host;
  try {
    host = new URL(value).host;
  } catch {
    return false;
  }
  return (
    host === 'tiredpilots.ca' ||
    host === 'www.tiredpilots.ca' ||
    host === 'tired-pilots.pages.dev' ||
    host.endsWith('.tired-pilots.pages.dev')
  );
}

export async function onRequestPost(context) {
  const { request, env, waitUntil } = context;

  if (!env.COHERE_API_KEY) {
    return json({ error: 'semantic search not configured' }, 503);
  }

  // Same-origin guard. Browsers always send Origin on a cross-origin POST and on
  // same-origin POSTs to a different path; we fall back to Referer for the rare
  // client that omits Origin. A request with neither is rejected.
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  if (!originAllowed(origin) && !originAllowed(referer)) {
    return json({ error: 'forbidden' }, 403);
  }

  const contentLength = Number(request.headers.get('content-length') || '0');
  if (contentLength > MAX_BODY_BYTES) {
    return json({ error: 'request too large' }, 413);
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
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'x-content-type-options': 'nosniff',
      'x-robots-tag': 'noindex',
      ...extra,
    },
  });
}
