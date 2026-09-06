# Semantic ("by meaning") search

`/search` has two tabs:

- **Keyword** — [Pagefind](https://pagefind.app), static, always on, no config.
- **By meaning** — Cohere embeddings + in-browser cosine similarity. **Off until
  a `COHERE_API_KEY` is set.** Until then the tab shows a "not enabled" message
  and keyword search is unaffected.

## How it works

1. **Build time** — `scripts/build-search-vectors.mjs` (runs in `postbuild`)
   chunks every page by `<h2>` section, embeds each chunk with Cohere
   `embed-v4.0` (`input_type: search_document`, 512-dim), and writes
   `dist/search/vectors.json`. A content-hash cache (`src/data/vectors.cache.json`,
   committed) means only changed chunks are re-embedded — a normal edit costs a
   handful of embed calls.
2. **Query time** — the browser loads `vectors.json` once, POSTs the query to
   **`/api/embed`** (a Cloudflare Pages Function, `functions/api/embed.js`) which
   embeds just the query with `input_type: search_query`, and ranks client-side.
   The API key never reaches the browser. Identical queries are cached at the
   edge for a day.

## To turn it on

1. Get a Cohere API key (<https://dashboard.cohere.com/api-keys>).
2. In the Cloudflare Pages project → **Settings → Variables and Secrets**, add
   **`COHERE_API_KEY`** for **both Production and Preview**. (Pages exposes the
   same variables to the build and to Functions.)
3. Redeploy (push any commit, or "Retry deployment").

The build log will show `[search-vectors] wrote dist/search/vectors.json (N chunks)`.

## Cost

Embedding is billed per token. Building the whole index once is well under a
cent; incremental rebuilds are a rounding error. Query embeddings are one short
call each, cached — negligible at this traffic.
