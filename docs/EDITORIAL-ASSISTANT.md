# Rewrite helper (`/rewrite`)

An editor tool for smoothing choppy page prose. It lives at **`tiredpilots.ca/rewrite`** — a
standalone page, `noindex`, not linked from the site, and gated by Cloudflare Access. It has
**nothing to do with `/admin`**.

## What it does

You paste a chunk of a page's Markdown; it returns a **smoother version** — choppy sentences joined,
plainer wording, active voice, better flow — and:

- a **meaning-match score** (cosine similarity of the rewrite vs your original, and vs the verbatim
  CARs text if you paste it), so you can see at a glance whether anything drifted;
- a **"verify these"** list — spots where an edit sits next to a number, citation, link, or defined
  term;
- a **"show changes"** diff.

## The guarantee

The prompt (`SYSTEM_PROMPT` in `functions/api/rewrite.js`) tells the model its **only** job is
readability. It must not change meaning, facts, numbers, times, dates, or any CARs section
reference; must keep every defined term verbatim (`flight time`, `flight duty period`, `rest
period`, `aerodrome`, `acclimatized`, …); and must keep every Markdown link, heading, list, table
and `<Component/>` exactly in place.

It still gets things wrong sometimes. The meaning-match score, the verify list, and the diff are
there to catch that — but **you review the result and paste it into the CMS yourself**. Nothing is
saved automatically; the tool never touches the site or the CMS.

## How to use it

1. Open `https://tiredpilots.ca/rewrite` in a second tab (you'll pass the Access login).
2. Copy **one `##` section** of the page body you're editing in the CMS. Section-sized chunks give
   better rewrites and can't be truncated.
3. Paste it in. For a regulation page, open the "Regulation page?" panel and paste the verbatim CARs
   text too — you'll get the extra "vs regulation" score.
4. Pick a touch (Light / Standard / Firm) and click **Smooth the writing**.
5. Read the result. Use **Show changes** to see exactly what moved. Check the "verify these" items.
6. **Copy the smoothed text** and paste it back into the CMS body. Review the CMS preview, then
   publish as normal.

## Architecture

- **`functions/api/rewrite.js`** — a Cloudflare Pages Function, same shape as `functions/api/embed.js`.
  Holds the Cohere key server-side; same-origin guarded (`403`); 40 KB body cap (`413`); text under
  40 chars → `400`; `cache-control: no-store`; `503` when `COHERE_API_KEY` is absent. Calls
  `/v2/chat` (`command-a-03-2025`, `response_format: json_object`) for the rewrite, then `/v2/embed`
  (`embed-v4.0`, 512-dim) for the score. A chat failure → `502` ("try a smaller chunk"); an embed
  failure → the rewrite is still returned, just without a score.
- **`src/islands/Rewriter.tsx`** — the Preact island (modelled on `SemanticSearch.tsx`).
- **`src/pages/rewrite.astro`** — the page; all `.rw*` styling is a page-level `<style is:global>`.
- **`src/lib/diff.ts`** — the word-level diff for "show changes".
- No `public/_headers` change — `/api/rewrite` is same-origin, covered by `connect-src 'self'`.

## Activation

Needs `COHERE_API_KEY` in Cloudflare Pages (Production **and** Preview) — the same key semantic
search uses. Plus the **Cloudflare Access** application on `/rewrite` + `/api/rewrite` (see
`docs/PRE-LAUNCH-SECURITY.md` §F). Access here is safe: it's a plain page with no popup and no
background fetch, so the problems that hit `/admin` don't apply — **do not add `/admin` to the same
Access app.**

## Data flow

The text you paste (and any verbatim CARs text) goes to Cohere's API for the rewrite and the score.
Nothing else. This is **operator tooling** — it only runs behind the Access-gated `/rewrite`, never
for site visitors, so the visitor privacy statement is unchanged. The content is already public
(public repo + site); Cohere's API terms state API inputs are not used to train its models.

## Tuning

- **Model** — `MODEL_CHAT` in `functions/api/rewrite.js`. `command-a-03-2025` is the current
  recommended model; `command-r7b-12-2024` is much cheaper/faster if cost becomes a concern.
- **Match bands** — `band()` in the same file: `original` uses ≥ 0.90 / 0.78–0.90 / < 0.78;
  `source` uses ≥ 0.82 / 0.65–0.82 / < 0.65. Adjust after seeing real scores on pages you know are
  good.
- **Temperature** by touch — `TEMPERATURE` map (`0.15` / `0.25` / `0.35`).

## Cost

A full-section rewrite is the priciest call in the project — a few thousand tokens in, ~1 k out,
roughly a cent or two. Reviewing every page several times over still stays inside the ~$5/month
Cohere cap, which is **shared with semantic search** (hitting it pauses search too). Guards: the
40 KB cap, button-only (no auto-run), and the WAF rate-limit rule.
