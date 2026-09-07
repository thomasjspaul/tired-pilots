// Cloudflare Pages Function: POST /api/review
//
// The editorial assistant for the Sveltia CMS. Given a draft page body (and, for
// regulation pages, the verbatim CARs text it paraphrases), it asks Cohere to
// FLAG issues for the human editor to weigh — it never rewrites and never
// certifies accuracy. Two upstream calls:
//   1. /v2/chat  — clarity / consistency / grammar / defined-term / source-fidelity flags
//   2. /v2/embed — a cosine "meaning drift" score of the draft vs. the source
//
// The Cohere key stays server-side. This endpoint is admin-only:
//   - Cloudflare Access (identity policy on /admin/* and /api/review) is the lock.
//   - Same-origin guard + a 32 KB body cap + a Cloudflare WAF rate-limit rule on
//     /api/review + the Cohere spend cap are defence in depth.
//   See docs/EDITORIAL-ASSISTANT.md and docs/PRE-LAUNCH-SECURITY.md.

const MODEL_CHAT = 'command-a-03-2025';
const MODEL_EMBED = 'embed-v4.0';
const EMBED_DIM = 512;

const MAX_BODY_BYTES = 32768; // whole request
const MAX_FIELD_CHARS = 16000; // per text field sent to Cohere
const MIN_BODY_CHARS = 40;
const MAX_ITEMS_PER_GROUP = 25;
const MAX_ITEM_CHARS = 600;

// Hosts allowed to call this endpoint from the browser (mirrors /api/embed).
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
  const { request, env } = context;

  if (!env.COHERE_API_KEY) {
    return json({ error: 'editorial review not configured' }, 503);
  }

  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  if (!originAllowed(origin) && !originAllowed(referer)) {
    return json({ error: 'forbidden' }, 403);
  }

  const contentLength = Number(request.headers.get('content-length') || '0');
  if (contentLength > MAX_BODY_BYTES) {
    return json({ error: 'request too large' }, 413);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'bad request' }, 400);
  }
  if (!payload || typeof payload !== 'object') {
    return json({ error: 'bad request' }, 400);
  }

  const kind = ['regulation', 'explainer', 'page'].includes(payload.kind) ? payload.kind : 'page';
  const title = clampStr(payload.title, 300);
  const summary = clampStr(payload.summary, 1000);
  const citationUrl = clampStr(payload.citationUrl, 500);
  const body = clampStr(payload.body, MAX_FIELD_CHARS);
  const source = kind === 'regulation' ? clampStr(payload.source, MAX_FIELD_CHARS) : '';

  if (body.length < MIN_BODY_CHARS) {
    return json({ error: 'draft too short to review' }, 400);
  }

  const hasSource = source.length >= MIN_BODY_CHARS;

  const [chat, drift] = await Promise.all([
    runChat({ env, title, summary, body, source: hasSource ? source : '', citationUrl }),
    hasSource ? runDrift({ env, body, source }) : Promise.resolve(null),
  ]);

  return json(
    {
      kind,
      hasSource,
      drift,
      clarity: chat.clarity,
      consistency: chat.consistency,
      grammar: chat.grammar,
      fidelity: hasSource ? chat.fidelity : null,
      definedTerms: chat.definedTerms,
      chatError: chat.error || undefined,
      model: MODEL_CHAT,
      usage: chat.usage || undefined,
    },
    200,
    { 'cache-control': 'no-store' },
  );
}

// ---- Cohere: chat (the flags) ------------------------------------------------

function systemPrompt(hasSource) {
  return [
    'You are a meticulous copy editor for tiredpilots.ca, a plain-language guide to',
    "Canada's flight-crew fatigue regulations (Canadian Aviation Regulations, Subpart 700).",
    'You review draft page text written by the site author.',
    '',
    'Rules:',
    '- You do NOT rewrite the text and you do NOT produce a corrected version.',
    '- You do NOT certify or approve accuracy. You only surface concerns for the human to weigh.',
    '- Be specific and conservative. For every item, quote the exact short phrase from the draft.',
    '- Prefer a few high-value flags over exhaustive nitpicking.',
    '- The audience is line pilots. Aim for clear, direct, active-voice prose with defined terms',
    '  used precisely.',
    '',
    'Return ONLY a JSON object with these keys, each an array (use [] when nothing to flag):',
    '- "clarity": [{"quote": string, "issue": string, "suggestion": string}] — wordy, buried,',
    '  ambiguous, or assumption-laden sentences.',
    '- "consistency": [{"quote": string, "issue": string}] — terms, phrasing or formatting used',
    '  inconsistently within the draft.',
    '- "grammar": [{"quote": string, "fix": string}] — grammar, spelling, punctuation, typos.',
    '- "definedTerms": [{"term": string, "note": string}] — places a CARs-defined term (e.g.',
    '  "flight time", "flight duty period", "rest period", "aerodrome") is used loosely, swapped',
    '  for a near-synonym, or where naming the defined term would be clearer.',
    hasSource
      ? '- "fidelity": [{"claim": string, "concern": string}] — statements in the draft that the\n  accompanying verbatim regulation text does not support, contradicts, or that drop a material\n  condition or exception. Quote the draft claim.'
      : '- "fidelity": [] — always empty; no source regulation text was provided.',
  ].join('\n');
}

function userPrompt({ title, summary, body, source, citationUrl }) {
  let msg = `DRAFT`;
  if (title) msg += ` (title: ${title})`;
  if (summary) msg += `\nAuthor's one-line summary: ${summary}`;
  msg += `\n\n${body}`;
  if (source) {
    msg += `\n\n---\nVERBATIM REGULATION TEXT the draft must stay faithful to`;
    if (citationUrl) msg += ` (${citationUrl})`;
    msg += `:\n\n${source}`;
  }
  return msg;
}

async function runChat({ env, title, summary, body, source, citationUrl }) {
  const empty = {
    clarity: [],
    consistency: [],
    grammar: [],
    fidelity: [],
    definedTerms: [],
  };
  let res;
  try {
    res = await fetch('https://api.cohere.com/v2/chat', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.COHERE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL_CHAT,
        temperature: 0.2,
        max_tokens: 1600,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt(!!source) },
          { role: 'user', content: userPrompt({ title, summary, body, source, citationUrl }) },
        ],
      }),
    });
  } catch {
    return { ...empty, error: true };
  }
  if (!res.ok) return { ...empty, error: true };

  let data;
  try {
    data = await res.json();
  } catch {
    return { ...empty, error: true };
  }

  const text = extractText(data);
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ...empty, error: true };
  }

  return {
    clarity: normList(parsed.clarity, ['quote', 'issue', 'suggestion']),
    consistency: normList(parsed.consistency, ['quote', 'issue']),
    grammar: normList(parsed.grammar, ['quote', 'fix']),
    fidelity: normList(parsed.fidelity, ['claim', 'concern']),
    definedTerms: normList(parsed.definedTerms, ['term', 'note']),
    usage: data && data.usage ? data.usage : undefined,
    error: false,
  };
}

function extractText(data) {
  const content = data && data.message && data.message.content;
  if (Array.isArray(content)) {
    const block = content.find((c) => c && c.type === 'text' && typeof c.text === 'string');
    if (block) return block.text;
    if (content[0] && typeof content[0].text === 'string') return content[0].text;
  }
  if (typeof content === 'string') return content;
  return '';
}

function normList(value, keys) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((row) => row && typeof row === 'object')
    .slice(0, MAX_ITEMS_PER_GROUP)
    .map((row) => {
      const out = {};
      for (const k of keys) out[k] = clampStr(row[k], MAX_ITEM_CHARS);
      return out;
    })
    .filter((row) => keys.some((k) => row[k].length > 0));
}

// ---- Cohere: embed (the drift score) --------------------------------------

async function runDrift({ env, body, source }) {
  let res;
  try {
    res = await fetch('https://api.cohere.com/v2/embed', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.COHERE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL_EMBED,
        input_type: 'search_document',
        output_dimension: EMBED_DIM,
        embedding_types: ['float'],
        texts: [body, source],
      }),
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;

  let data;
  try {
    data = await res.json();
  } catch {
    return null;
  }
  const vecs = data && data.embeddings && data.embeddings.float;
  if (!Array.isArray(vecs) || vecs.length < 2) return null;

  const score = cosine(vecs[0], vecs[1]);
  return { score: Math.round(score * 1000) / 1000, ...driftBand(score) };
}

function driftBand(score) {
  if (score >= 0.82) {
    return { band: 'aligned', note: 'Closely aligned with the regulation text.' };
  }
  if (score >= 0.65) {
    return {
      band: 'review',
      note: 'Some divergence — check the draft still says what the regulation says.',
    };
  }
  return {
    band: 'divergent',
    note: 'Significant divergence from the regulation text — review carefully.',
  };
}

function cosine(a, b) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

// ---- helpers --------------------------------------------------------------

function clampStr(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
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
