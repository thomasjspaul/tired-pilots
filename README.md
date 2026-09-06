# tiredpilots.ca

A plain-language guide to Canada's flight-crew fatigue rules (CARs Subpart 700),
with a Maximum Flight Duty Period calculator for 703/704/705 operations.

Rebuilt from the long-running Google Site onto a fast, mobile-friendly, static
site that anyone can read and that the maintainer can edit from a browser.

## For editors

**You do not need to use any of the commands below.** To change the site's
content, go to `https://<the-site>/admin/`, sign in with GitHub, edit, and click
Publish. See [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## Stack

| Piece                                                 | What it is                                                |
| ----------------------------------------------------- | --------------------------------------------------------- |
| [Astro](https://astro.build)                          | Builds the static site from Markdown/MDX content          |
| Cloudflare Pages                                      | Hosts the site; rebuilds automatically on every change    |
| [Sveltia CMS](https://github.com/sveltia/sveltia-cms) | The `/admin` visual editor (writes Markdown to this repo) |
| [Pagefind](https://pagefind.app)                      | Static, client-side full-text search                      |
| [Vitest](https://vitest.dev)                          | Tests the FDP calculator and the regulation lookup tables |
| Cloudflare Web Analytics                              | Cookieless traffic stats (no consent banner)              |

## Local development

```sh
npm install
npm run dev        # http://localhost:4321
npm test           # calculator + table-integrity tests
npm run check      # type-check
npm run build      # full static build + search index -> dist/
```

Requires Node 20+ (`.nvmrc` pins 22).

## Layout

```
src/
  content/        Markdown/MDX content (regulations, explainers, pages, settings)
  data/           Typed CARs lookup tables — single source of truth for the
                  rendered tables AND the calculator
  lib/fdp/        The FDP calculation engine + its tests
  components/     Astro UI components
  islands/        Interactive Preact components (calculator, flowchart)
  layouts/        Page shells
  pages/          Routes
scripts/          Build helpers (redirects, changelog, search vectors)
public/admin/     Sveltia CMS shell + config
oauth/            One-time GitHub OAuth broker for the CMS (separate Worker)
```

## Deployment

Push to `main` → Cloudflare Pages builds and deploys. Every pull request gets its
own preview URL. Build command `npm run build`, output directory `dist`.

The site is developed on a temporary `*.pages.dev` address; the live domain
`tiredpilots.ca` is cut over only at the end.

## License

Content and source: [CC BY-NC-SA 4.0](./LICENSE). Not affiliated with Transport
Canada or any air operator. Educational aid only — not legal advice.
