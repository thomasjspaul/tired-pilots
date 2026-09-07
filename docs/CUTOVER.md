# DNS cutover — `tiredpilots.ca` → Cloudflare Pages

**Not done yet.** Notes for when we're ready.

> Before starting, clear the **[cutover blocker]** items in
> [`PRE-LAUNCH-SECURITY.md`](./PRE-LAUNCH-SECURITY.md): the Cohere spend cap
> (B1), the WAF rate‑limit rule on `/api/embed` (B2), and disabling the
> "Redirect root to www" rule (B3, same as the section below).

## The existing redirect that has to change

There is currently a Cloudflare **Redirect Rule** on the `tiredpilots.ca` zone that
sends the apex to `www` on the old Google Site:

- **Name:** Redirect root to www
- **When:** `http.request.full_uri` wildcard `tiredpilots.ca/*`
- **Then:** `301` → `wildcard_replace(http.request.full_uri, "tiredpilots.ca/*", "https://www.tiredpilots.ca/${1}")`

While that rule is active, **every request to the apex is forwarded to the Google
Site**, so pointing DNS at Pages alone won't switch the site over. At cutover:

1. **Disable / delete** the "Redirect root to www" rule.
2. Decide the canonical host for the new site — the build uses **apex**
   (`https://tiredpilots.ca`, set in `astro.config.mjs` `site`, and in every
   canonical / OG tag / sitemap / robots.txt). So we want **www → apex**, the
   opposite of the current rule.
3. Add a Redirect Rule: `www.tiredpilots.ca/*` → `301`
   `https://tiredpilots.ca/${1}` (or use Cloudflare's "Redirect from WWW to
   Root" bulk rule).

## DNS / Pages steps

1. In the Pages project → **Custom domains** → add `tiredpilots.ca` **and**
   `www.tiredpilots.ca`.
2. Cloudflare will create/adjust the `CNAME`/`A` records to the Pages project.
   The old records that point at Google Sites (`ghs.googlehosted.com` or the
   Google A records) get replaced.
3. Wait for SSL to show **Active** for both hostnames.

## Right after cutover

- [ ] `curl -I https://tiredpilots.ca` → 200, not a redirect to www or Google.
- [ ] `curl -I https://www.tiredpilots.ca` → 301 to `https://tiredpilots.ca`.
- [ ] `node ./scripts/check-redirects.mjs https://tiredpilots.ca` → 0 failed
      (the 46 legacy Google Sites paths).
- [ ] Spot-check a few `#h.` deep links from old forum posts if any are known.
- [ ] Cloudflare Web Analytics beacon firing on the real domain.
- [ ] Submit `https://tiredpilots.ca/sitemap-index.xml` in Google Search Console;
      watch for crawl errors for ~1 week.
- [ ] Leave the Google Site published for ~7 days as a rollback path (flip DNS
      back if something is badly wrong).

## Rollback

Re-enable the "Redirect root to www" rule (or point the DNS records back at
Google). The Pages deployment stays intact at `tired-pilots.pages.dev`.
