// Post-build: embed each content chunk with Cohere and write
// dist/search/vectors.json for the in-browser semantic search island.
//
// - Chunks are one per <h2> section of each indexed page (the [data-pagefind-body]
//   region), so they line up with what keyword search covers.
// - A content-hash cache (src/data/vectors.cache.json, committed) means only
//   changed chunks are re-embedded — a typical edit costs a few embed calls.
// - No COHERE_API_KEY -> skip silently; the site falls back to keyword search.

import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, extname } from 'node:path';
import { createHash } from 'node:crypto';

const KEY = process.env.COHERE_API_KEY;
if (!KEY) {
  console.log('[search-vectors] COHERE_API_KEY not set — skipping semantic index (keyword only).');
  process.exit(0);
}

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist');
const MODEL = 'embed-v4.0';
const DIM = 512;
const cachePath = join(root, 'src/data/vectors.cache.json');

const stripTags = (s) =>
  s
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&[a-z]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

async function htmlFiles(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (['pagefind', '_astro', 'admin', 'uploads'].includes(e.name)) continue;
      out.push(...(await htmlFiles(p)));
    } else if (extname(e.name) === '.html') out.push(p);
  }
  return out;
}

function chunksFrom(html, url) {
  const bodyMatch = /<main[^>]*data-pagefind-body[^>]*>([\s\S]*?)<\/main>/i.exec(html);
  if (!bodyMatch) return [];
  let body = bodyMatch[1]
    .replace(/<details class="reg__fulltext"[\s\S]*?<\/details>/g, ' ') // verbatim expander
    .replace(/<astro-island[\s\S]*?<\/astro-island>/g, ' ') // calculator, flowchart, etc.
    .replace(/<p class="suggest"[\s\S]*?<\/p>/g, ' ');
  const title = stripTags((/<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(body) || [, ''])[1]) || url;

  const parts = body.split(/<h2\b/i);
  const chunks = [];
  const intro = stripTags(parts[0]);
  if (intro.length > 40) chunks.push({ heading: '', text: intro });
  for (let i = 1; i < parts.length; i++) {
    const seg = '<h2' + parts[i];
    const heading = stripTags((/<h2[^>]*>([\s\S]*?)<\/h2>/i.exec(seg) || [, ''])[1]);
    const text = stripTags(seg.replace(/<h2[^>]*>[\s\S]*?<\/h2>/i, ''));
    if (text.length > 40) chunks.push({ heading, text: `${heading}. ${text}` });
  }
  return chunks.map((c, i) => ({
    id: `${url}#${i}`,
    url: url + (c.heading ? `#${slug(c.heading)}` : ''),
    title,
    heading: c.heading,
    text: c.text.slice(0, 1200),
  }));
}

const slug = (s) =>
  s
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const hash = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16);

// ---- gather chunks -----------------------------------------------------------
const files = await htmlFiles(dist);
const chunks = [];
for (const f of files) {
  const rel = f.slice(dist.length).replace(/\\/g, '/');
  if (/\/(404|search)\.html$/.test(rel)) continue;
  const url = rel.replace(/index\.html$/, '').replace(/\.html$/, '') || '/';
  chunks.push(...chunksFrom(await readFile(f, 'utf8'), url));
}

// ---- embed (with cache) ----------------------------------------------------
const cache = existsSync(cachePath) ? JSON.parse(await readFile(cachePath, 'utf8')) : {};
const need = chunks.filter((c) => !cache[hash(c.text)]);
console.log(`[search-vectors] ${chunks.length} chunks, ${need.length} to embed`);

for (let i = 0; i < need.length; i += 96) {
  const batch = need.slice(i, i + 96);
  const res = await fetch('https://api.cohere.com/v2/embed', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      input_type: 'search_document',
      output_dimension: DIM,
      embedding_types: ['float'],
      texts: batch.map((c) => c.text),
    }),
  });
  if (!res.ok) {
    console.error(`[search-vectors] Cohere error ${res.status}: ${await res.text()}`);
    process.exit(0); // don't fail the build — fall back to keyword
  }
  const json = await res.json();
  json.embeddings.float.forEach((vec, j) => {
    cache[hash(batch[j].text)] = vec.map((n) => Math.round(n * 1e6) / 1e6);
  });
}

await writeFile(cachePath, JSON.stringify(cache), 'utf8');

// ---- write the index -------------------------------------------------------
const out = chunks.map((c) => ({
  url: c.url,
  title: c.title,
  heading: c.heading,
  text: c.text.slice(0, 240),
  vec: cache[hash(c.text)],
}));
await mkdir(join(dist, 'search'), { recursive: true });
await writeFile(join(dist, 'search/vectors.json'), JSON.stringify(out), 'utf8');
console.log(`[search-vectors] wrote dist/search/vectors.json (${out.length} chunks)`);
