# Editorial assistant (CMS)

A "Run editorial review" panel in the Sveltia CMS preview pane. It uses **Cohere**
to _flag_ issues in the page you are editing — it never rewrites your text and it
never "approves" it. You stay the editor.

## What it checks

| Group                           | What it looks for                                                                                                                                                     |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Meaning match**               | _(regulation pages only)_ a cosine similarity score between your draft and the verbatim CARs text it paraphrases — a quick "does this still say the same thing" gauge |
| **Faithful to the regulation?** | _(regulation pages only)_ statements in the draft the verbatim text doesn't support, contradicts, or that drop a condition/exception                                  |
| **Clarity**                     | wordy, buried, ambiguous, or assumption-laden sentences                                                                                                               |
| **Consistency**                 | terms / phrasing / formatting used inconsistently within the page                                                                                                     |
| **Grammar & typos**             | grammar, spelling, punctuation                                                                                                                                        |
| **Defined terms**               | a CARs-defined term used loosely or swapped for a near-synonym, or where naming the defined term would be clearer                                                     |

The **meaning-match score is the most trustworthy signal** — it's a measurement.
The written flags come from a language model and can be wrong in either
direction (miss a real problem, or object to something correct). Treat every
flag as "worth a look," never as instruction.

## How to use it

1. Open an entry in the CMS (`regulations`, `explainers`, or `pages`).
2. Show the **preview pane** (toggle it on if it's hidden).
3. Edit the body, then click **Run editorial review**.
4. Read the flags. Nothing is applied automatically — you make the edits.
5. Re-run after changes.

Explainer and page entries have no verbatim source, so they get clarity /
consistency / grammar / defined-term flags only.

## Data flow

Clicking the button sends **your draft body** (plus the title and one-line
summary), and — for regulation pages — the paired `regulation-text` entry's body,
to Cohere's API (`/v2/chat` and `/v2/embed`). Nothing else is sent. This is
**operator tooling**: it runs only inside the sign-in-gated `/admin`, never for
site visitors, so the visitor privacy statement is unchanged. The site's content
is already public (public repo + site), and Cohere's API terms state API inputs
are not used to train its models.

## Architecture

- **`functions/api/review.js`** — a Cloudflare Pages Function, same shape as
  `functions/api/embed.js`. Holds the Cohere key server-side; same-origin
  guarded; 32 KB body cap; `cache-control: no-store`. Two upstream calls in
  parallel: `/v2/chat` (`command-a-03-2025`, `response_format: json_object`) for
  the flags, `/v2/embed` (`embed-v4.0`, 512-dim) for the meaning-match score. A
  Cohere failure returns partial results (`chatError: true`) rather than an
  error.
- **`public/admin/assistant.js`** — loaded after the Sveltia bundle in
  `public/admin/index.html`. Registers a preview template for the three
  collections. A small `postMessage` bridge in the top `/admin` document performs
  the `fetch` (so it is always same-origin and carries the Cloudflare Access
  cookie, whatever the preview iframe's origin). If the Sveltia preview API is
  unavailable, the file no-ops and editing is unaffected.
- No `public/_headers` change: the panel calls the same-origin `/api/review`,
  already covered by `connect-src 'self'`.

## Activation

Needs `COHERE_API_KEY` in Cloudflare Pages (Production **and** Preview) — the same
key semantic search already uses. Without it, `/api/review` returns `503` and the
panel says the review isn't enabled on that deployment.

**Cloudflare Access** must gate `/admin` and `/api/review` (identity policy,
your email — _not_ a Managed Challenge). See `docs/PRE-LAUNCH-SECURITY.md` §F for
the exact dashboard steps and the WAF rate-limit rule.

## Tuning

- **Model** — `MODEL_CHAT` in `functions/api/review.js`. `command-a-03-2025` is
  the current recommended model; `command-r7b-12-2024` is cheaper/faster if cost
  becomes a concern.
- **Meaning-match bands** — `driftBand()` in the same file: `aligned` ≥ 0.82,
  `review` 0.65–0.82, `divergent` < 0.65. Adjust after seeing real scores on
  pages you know are good vs. drifting.
- **Prompt** — `systemPrompt()` / `userPrompt()`. Keep the "do not rewrite / do
  not approve" instructions.

## Cost

`/v2/chat` is priced per token and is pricier than the search embeddings. A page
review is a few thousand tokens in, ~1 k out — roughly a cent or two per run.
Reviewing every page several times over stays within the ~$5/month Cohere cap,
which is shared with semantic search. Guards: 32 KB input cap, button-only (no
auto-run), an in-flight lock, and the WAF rate-limit rule.
