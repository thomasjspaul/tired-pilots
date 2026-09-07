# Pre‑launch security & abuse review

_Reviewed: 2026‑09‑06 · against commit `8cbbd1a` + the fixes in this change._
_Addendum 2026‑09‑07: §E — Dependabot advisory triage._

## TL;DR

The site is low‑risk by design: static HTML, no visitor accounts, no database, no
visitor data kept beyond one `localStorage` flag. There were **no secrets in the
repo or its history**. The real exposure is in three places — the CMS admin
shell, the paid `/api/embed` call, and the missing Content‑Security‑Policy — and
all three are addressed in code here. What remains is a short list of **Cloudflare
and GitHub dashboard settings only you can apply.**

Nothing below blocks the cutover except items marked **[cutover blocker]**.

---

## A. Fixed in this change (code)

| #   | Was                                                                                                                                                                                  | Now                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | `/admin` loaded `@sveltia/cms` from unpkg with **no version pin and no integrity check** — a bad publish or a compromised CDN would run arbitrary code with your GitHub push access. | Pinned to `@0.206.1`, locked with a SHA‑384 Subresource Integrity hash + `crossorigin`, and `unpkg.com` is the only remote script origin in the CSP. Upgrade helper: `node scripts/sri.mjs <url>`.                                                                                                                                                                                                                                                                                                                                                |
| A2  | No **Content‑Security‑Policy**.                                                                                                                                                      | One site‑wide CSP in `public/_headers`: `default-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`, `form-action 'self'`, `upgrade-insecure-requests`. `script-src` allows self + the Cloudflare beacon + `unpkg.com` (the pinned/SRI'd CMS bundle); `connect-src` also allows the GitHub API and the OAuth broker Worker for the CMS. A single CSP, because Cloudflare Pages **combines** a header set by multiple `_headers` rules and the browser enforces the intersection — a per‑path override is not possible. |
| A3  | `/api/embed` accepted a POST from **any origin** — any other website or a one‑line script could bill your Cohere key.                                                                | Same‑origin guard: the `Origin` (or `Referer`) host must be `tiredpilots.ca`, `www.tiredpilots.ca`, or a `*.tired-pilots.pages.dev` deployment, else `403`. Plus a 2 KB request‑body cap and `nosniff`/`noindex` on the JSON response.                                                                                                                                                                                                                                                                                                            |
| A4  | `_headers` baseline was good but missing a couple of items.                                                                                                                          | Added `Cross-Origin-Opener-Policy: same-origin`, `interest-cohort=()` in `Permissions-Policy`, and `X-Robots-Tag: noindex` on `/admin/*`.                                                                                                                                                                                                                                                                                                                                                                                                         |
| A5  | `FdpTables` note linked to `#acclimatization`, a dead anchor on every page except `/rules/700-28`.                                                                                   | Now links to `/rules/700-28#acclimatization`. (Not a security issue — found by the internal link scan run for this review.)                                                                                                                                                                                                                                                                                                                                                                                                                       |
| A6  | —                                                                                                                                                                                    | Added `SECURITY.md` (private disclosure policy) and `public/.well-known/security.txt`.                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

Verification run for this review:

- Secret scan of tracked files **and full git history** — clean; only
  `.env.example` (empty template) is tracked.
- Internal link check across all 47 built pages — clean after A5.
- `npm run build` + `npm test` green with the changes.
- No external scripts, styles, fonts, images, or iframes anywhere in the built
  site except the Sveltia bundle on `/admin` — so the strict CSP does not break
  anything.

---

## B. You must do these (dashboards) — before cutover

### B1. Cohere spend cap **[cutover blocker]**

`/api/embed` calls a paid API. The same‑origin guard and edge cache make abuse
hard, but a forged `Origin` header from a script is still possible.

- In the Cohere dashboard → **Billing / Usage limits**, set a hard monthly spend
  limit (e.g. **$5**) and a usage alert at 50 %.
- `embed-v4.0` search queries are ~$0.0001 each and identical queries are cached
  at the edge for 24 h, so a $5 cap is thousands of unique searches a month.

### B2. Cloudflare WAF rate‑limiting rule on `/api/embed` **[cutover blocker]**

Dashboard → **Security → WAF → Rate limiting rules → Create**:

- **If** URI Path equals `/api/embed`
- **Then** Block, for **1 minute**
- **When** it exceeds **20 requests per 1 minute** per client IP

That is far above any real user (a search is one call, then cached) and caps a
scripted caller at ~28 k/day instead of unlimited. Tighten later if needed.

### B3. Confirm the DNS‑cutover prerequisite **[cutover blocker]**

Per `docs/CUTOVER.md`: the existing **"Redirect root to www"** rule
(`tiredpilots.ca/*` → `https://www.tiredpilots.ca/${1}`, 301) must be **disabled**
before the apex points at Pages, or every request loops to the dead Google Site.
Do not start the cutover until that rule is off and the `www → apex` rule is in.

### B4. GitHub account hardening

- **Two‑factor authentication** on `github.com/thomasjspaul` — this account can
  push to `main` and therefore deploy. Use an authenticator app or passkey, not
  SMS. Save the recovery codes offline.
- Repo → **Settings → Branches → Add branch ruleset** for `main`: require a pull
  request, require status checks (`ci`), block force‑pushes. Sveltia already
  works PR‑by‑PR; this stops an accident or a stray token from writing straight
  to `main`.
- Repo → **Settings → Code security**: enable **Secret scanning** + **Push
  protection**, **Dependabot alerts**, and **Dependabot security updates** (so
  fixes arrive as PRs — now gated by the `CI` check). Advisory triage is in
  **§E**.
- Review **Settings → Developer settings → OAuth apps**: the CMS OAuth app should
  be the only one, with callback URL = the broker Worker only.

### B5. Cloudflare account hardening

- **2FA** on the Cloudflare account.
- Pages project → **Settings → Environment variables**: `COHERE_API_KEY` set for
  **Production and Preview**, marked **encrypted / secret**. It must never appear
  in `wrangler.toml`, `_headers`, or any committed file.
- **Scrape Shield → Email Address Obfuscation: On** (the `mailto:` correction and
  privacy links are in the page source).
- After the custom domains are added: **SSL/TLS → Overview → Full (strict)**, and
  **Edge Certificates → Always Use HTTPS: On** and **Automatic HTTPS Rewrites:
  On**.
- Leave **Bot Fight Mode** on (free tier) for baseline scraper/bot pressure.

### B6. CMS OAuth broker Worker

- Deploy from `oauth/` with `wrangler deploy`; set `GITHUB_CLIENT_ID` and
  `GITHUB_CLIENT_SECRET` with `wrangler secret put` (never in `wrangler.toml`).
- Confirm the deployed URL matches `base_url` in `public/admin/config.yml`
  (`https://tiredpilots-cms-auth.thomasjspaul.workers.dev`).
- Confirm `ALLOWED_DOMAINS` in `oauth/wrangler.toml` lists only your hosts
  (it currently does).
- The GitHub OAuth app's **Authorization callback URL** must be the Worker's
  `/callback`, nothing else.

---

## C. Known and accepted (no action needed now)

| #   | Item                                                                                                                                           | Why it's acceptable                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | `script-src` uses `'unsafe-inline'` rather than per‑script hashes.                                                                             | The site renders no visitor input into HTML and has no auth/cookies, so the XSS vector `'unsafe-inline'` would mitigate does not exist here. Hash‑based CSP across Astro's per‑page hydration snippets is fragile for a non‑developer maintainer. `object-src`, `base-uri`, `frame-ancestors`, `form-action` — the directives that matter here — are strict. Revisit with Astro's `experimental.csp` once the site is stable.                                                      |
| C2  | 15 Dependabot advisories in dev/build dependencies and Astro core.                                                                             | None are reachable against the deployed static site. Full per‑advisory analysis and the post‑cutover Astro‑major upgrade plan are in **§E**.                                                                                                                                                                                                                                                                                                                                       |
| C3  | HSTS has no `preload`.                                                                                                                         | `preload` is a long, hard‑to‑reverse commitment. Add it a few weeks after cutover once HTTPS is confirmed stable on the apex and all subdomains.                                                                                                                                                                                                                                                                                                                                   |
| C4  | A visitor who strips both `Origin` and `Referer` gets `403` from `/api/embed`.                                                                 | Very rare (aggressive privacy extensions). Keyword search still works for them; the page degrades cleanly.                                                                                                                                                                                                                                                                                                                                                                         |
| C5  | The single CSP carries the CMS's needs site‑wide: `'unsafe-eval'`, `unpkg.com` in `script-src`, GitHub API in `connect-src`, `img-src https:`. | Pages combines `_headers` CSPs as an intersection, so `/admin` cannot have its own looser policy — the site‑wide one must satisfy the CMS. On a static site with no visitor input rendered into HTML and no auth/cookies there is no XSS sink for `'unsafe-eval'` to exploit; `unpkg.com` serves the version‑pinned + SRI‑locked bundle only. Revisit with per‑path delivery (a `<meta>` CSP in `/admin/index.html` plus a stricter header CSP elsewhere) when the site is stable. |
| C6  | Sveltia is a young project (small team).                                                                                                       | `config.yml` is Decap‑compatible, so you can switch forks with no content change; MDX + Git is always a fallback authoring path; the bundle is version‑pinned and integrity‑checked.                                                                                                                                                                                                                                                                                               |

---

## D. Post‑cutover checklist

- [ ] `curl -sI https://tiredpilots.ca | grep -i -E 'content-security-policy|strict-transport|x-frame'` — headers present on the live apex.
- [ ] `curl -s -X POST https://tiredpilots.ca/api/embed -H 'content-type: application/json' -d '{"q":"test"}'` **without** an `Origin` header → `403`.
- [ ] Same call **with** `-H 'origin: https://tiredpilots.ca'` → `200` and a `vec`.
- [ ] Load `/admin`, confirm it renders (SRI hash still valid) and you can sign in.
- [ ] `npm run verify:redirects -- https://tiredpilots.ca` — all 301s correct.
- [ ] <https://securityheaders.com/?q=tiredpilots.ca> — A or better.
- [ ] Cohere dashboard shows the spend cap and alert are active.
- [ ] Watch the Pages Functions "Invocations" graph and the WAF rate‑limit
      counter for the first week.
- [ ] Keep the Google Site live ~7 days as rollback.

---

## E. Dependency advisories (Dependabot) — reviewed 2026‑09‑07

Dependabot opened **15 alerts** against `package-lock.json`. **None are reachable
against the deployed site.** The site ships as static HTML/CSS/JS on Cloudflare's
CDN: no server, no SSR, `output` defaults to `'static'`, no adapter. A grep of
`src/` confirms none of `define:vars`, `transition:*` / `<ClientRouter>`,
`server:defer`, spread props, or `Astro.request` / Host‑header access are used
anywhere.

| Alerts                                                                                                                                                                                                  | Package(s)                                   | Class                    | Why it is not reachable here                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vitest UI arbitrary file read/exec; esbuild dev‑server request forgery + Windows file read; vite `server.fs.deny` bypass + optimized‑deps `.map` path traversal; launch‑editor NTLMv2 hash disclosure   | `vitest`, `esbuild`, `vite`, `launch-editor` | **Dev‑server only**      | Exploitable only while `npm run dev` / `vitest --ui` runs on a maintainer's machine **and** that same browser opens a hostile page. Never deployed; CI runs `vitest run` (no UI). |
| sharp / libvips — CVE‑2026‑33327, ‑33328, ‑35590, ‑35591                                                                                                                                                | `sharp`                                      | **Build‑time only**      | `sharp` optimises the repo's own images during `astro build`. Not in the shipped output; there is no attacker‑supplied image input.                                               |
| Host‑header SSRF in prerendered error page; reflected XSS via slot name; `define:vars` `</script>` XSS; View‑Transition / `transition:*` XSS (×2); spread‑attribute‑name XSS (×2); Server‑Island replay | `astro`                                      | **SSR / unused feature** | Each needs on‑demand rendering or a feature this codebase does not contain. Static build, no server for the SSRF/reflected cases to apply to.                                     |

### Upgrade plan (post‑cutover)

The Astro advisories are patched **only in 6.x / 7.x** — there is no 5.x
backport — so clearing every alert requires an Astro major upgrade.
`npm audit fix --force` targets **`astro` 7.3.1** (from 5.18.2), which also pulls
patched `sharp`, `esbuild`, and `vite`.

Do this on one dedicated branch **after** the DNS cutover, never beside it:

1. `astro` 5 → 7, plus matching majors for `@astrojs/mdx`, `@astrojs/preact`,
   `@astrojs/sitemap`, `@astrojs/check`.
2. `vitest` 2 → 4 (dev‑only; clears the whole vite/esbuild/launch‑editor chain).
3. Let `sharp` / `esbuild` resolve to what the new Astro requires; add
   `package.json` `overrides` only if a stale copy is left behind. Note: adding
   `overrides` to the **current** tree trips an npm 10.9 bug
   (`Cannot read properties of null (reading 'edgesOut')`), so the overrides
   route only works once Astro is bumped first.
4. Full `npm run build` + `npm run check` + `npm test`, then a manual
   click‑through of the calculator, the increased‑rest flowchart, search, and a
   regulation page. Migration risk sits in Content Layer collections, the custom
   `rehypeWrapTables` plugin in `astro.config.mjs`, and MDX island embedding.
5. Merge via PR — the required `CI` check gates it.

Until then, enable **Dependabot security updates** (§B4) so fixes land as PRs,
and keep triaging here rather than leaving alerts unread.
