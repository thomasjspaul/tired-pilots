// Cloudflare Pages Function: POST /api/rewrite
//
// Backs the editor tool at /rewrite. Given a chunk of a page's Markdown, it asks
// Cohere to return a SMOOTHER version — choppy sentences joined, plainer wording,
// active voice — WITHOUT changing meaning, numbers, citations, links, or the CARs
// defined terms. It also returns a cosine "meaning match" score (rewrite vs the
// original, and vs the verbatim regulation text when supplied) so the editor can
// see at a glance whether anything drifted. Nothing is applied automatically —
// the editor reviews the result and pastes it into the CMS by hand.
//
// The Cohere key stays server-side. This endpoint is editor-only:
//   - Cloudflare Access (identity policy on /rewrite and /api/rewrite) is the
//     lock — see docs/PRE-LAUNCH-SECURITY.md §F.
//   - Same-origin guard + a 40 KB body cap + a Cloudflare WAF rate-limit rule +
//     the Cohere spend cap are defence in depth.

const MODEL_CHAT = 'command-a-03-2025';
const MODEL_EMBED = 'embed-v4.0';
const EMBED_DIM = 512;

const MAX_BODY_BYTES = 40000;
const MAX_FIELD_CHARS = 20000;
const MIN_TEXT_CHARS = 40;
const MAX_CHECKS = 25;
const MAX_CHECK_CHARS = 400;

const TEMPERATURE = { light: 0.15, standard: 0.25, firm: 0.35 };

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
    return json({ error: 'rewrite helper not configured' }, 503);
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

  const text = clampStr(payload.text, MAX_FIELD_CHARS);
  const source = clampStr(payload.source, MAX_FIELD_CHARS);
  const touch = ['light', 'standard', 'firm'].includes(payload.touch) ? payload.touch : 'standard';

  if (text.length < MIN_TEXT_CHARS) {
    return json({ error: 'text too short to rewrite' }, 400);
  }
  const hasSource = source.length >= MIN_TEXT_CHARS;

  // 1. The rewrite itself.
  const chat = await runChat({ env, text, source: hasSource ? source : '', touch });
  if (chat.error || !chat.rewrite) {
    return json({ error: 'rewrite failed' }, 502);
  }

  // 2. The meaning-match score (best effort — a failure here is not fatal).
  const match = await runMatch({
    env,
    text,
    rewrite: chat.rewrite,
    source: hasSource ? source : '',
  });

  return json(
    {
      rewrite: chat.rewrite,
      checks: chat.checks,
      truncated: chat.truncated || undefined,
      match,
      model: MODEL_CHAT,
      usage: chat.usage || undefined,
    },
    200,
    { 'cache-control': 'no-store' },
  );
}

// ---- Cohere: chat (the rewrite) ------------------------------------------

const SYSTEM_PROMPT = [
  "You smooth choppy prose for tiredpilots.ca, a plain-language guide to Canada's flight-crew",
  'fatigue regulations (Canadian Aviation Regulations, Subpart 700). The author writes for line',
  'pilots and wants the text to read more smoothly.',
  '',
  'Your ONLY job is readability and flow:',
  '- Join short, disconnected sentences; add connective words so ideas link up; vary sentence',
  '  length; cut filler and redundancy; prefer active voice and everyday words.',
  '- Do NOT change meaning, facts, numbers, dates, times, or any CARs section reference',
  '  (e.g. "700.28(2)").',
  '- Keep every defined term exactly as written — "flight time", "flight duty period", "rest',
  '  period", "aerodrome", "acclimatized", etc. Never swap a defined term for a synonym.',
  '- Keep every Markdown link, heading, list, table, blockquote, and any <Component ... /> or',
  '  <Tag> exactly as-is, in the same place.',
  '- Do not add claims, caveats, or examples; do not remove information. Shorter is fine; padding',
  '  is not. Keep the author’s direct, practical, second-person voice.',
  '- touch is one of light / standard / firm: light = fix only the obviously choppy spots;',
  '  standard = smooth throughout; firm = also restructure awkward paragraphs, still without',
  '  changing meaning.',
  '',
  'Return ONLY a JSON object:',
  '{ "rewrite": "<the full rewritten Markdown>",',
  '  "checks": [ { "quote": "<short phrase from YOUR rewrite>", "concern": "<why a human should',
  '  double-check this spot>" } ] }',
  'checks = spots where an edit sits next to a number, citation, link, or defined term, or where a',
  'flow change could be read as a meaning change. Use [] if there are none.',
].join('\n');

async function runChat({ env, text, source, touch }) {
  let userMsg = `touch: ${touch}\n\nTEXT TO SMOOTH:\n\n${text}`;
  if (source) {
    userMsg +=
      `\n\n---\nVERBATIM REGULATION TEXT the rewrite must stay faithful to ` +
      `(do not copy it in, just keep the rewrite consistent with it):\n\n${source}`;
  }

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
        temperature: TEMPERATURE[touch],
        max_tokens: 4096,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMsg },
        ],
      }),
    });
  } catch {
    return { error: true };
  }
  if (!res.ok) return { error: true };

  let data;
  try {
    data = await res.json();
  } catch {
    return { error: true };
  }

  let parsed;
  try {
    parsed = JSON.parse(extractText(data));
  } catch {
    return { error: true };
  }

  const rewrite = typeof parsed.rewrite === 'string' ? parsed.rewrite.trim() : '';
  if (!rewrite) return { error: true };

  const checks = Array.isArray(parsed.checks)
    ? parsed.checks
        .filter((c) => c && typeof c === 'object')
        .slice(0, MAX_CHECKS)
        .map((c) => ({
          quote: clampStr(c.quote, MAX_CHECK_CHARS),
          concern: clampStr(c.concern, MAX_CHECK_CHARS),
        }))
        .filter((c) => c.quote || c.concern)
    : [];

  return {
    rewrite,
    checks,
    truncated: data?.finish_reason === 'MAX_TOKENS',
    usage: data && data.usage ? data.usage : undefined,
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

// ---- Cohere: embed (the meaning-match score) --------------------------

async function runMatch({ env, text, rewrite, source }) {
  const texts = source ? [text, rewrite, source] : [text, rewrite];
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
        texts,
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

  const vsOriginal = band(cosine(vecs[0], vecs[1]), 'original');
  const vsSource = source && vecs.length >= 3 ? band(cosine(vecs[2], vecs[1]), 'source') : null;
  return { vsOriginal, vsSource };
}

function band(score, kind) {
  const s = Math.round(score * 1000) / 1000;
  if (kind === 'source') {
    if (s >= 0.82) return { score: s, band: 'ok', note: 'Still aligned with the regulation text.' };
    if (s >= 0.65)
      return { score: s, band: 'warn', note: 'Some divergence from the regulation — check it.' };
    return { score: s, band: 'bad', note: 'Diverges from the regulation text — review carefully.' };
  }
  if (s >= 0.9) return { score: s, band: 'ok', note: 'Wording only — meaning looks unchanged.' };
  if (s >= 0.78)
    return { score: s, band: 'warn', note: 'Some rephrasing — read it through before you use it.' };
  return { score: s, band: 'bad', note: 'Meaning may have shifted — check this carefully.' };
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

// ---- helpers ---------------------------------------------------------

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
