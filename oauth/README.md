# CMS login (GitHub OAuth broker)

The visual editor at `/admin` signs editors in with their GitHub account. GitHub
requires a small server ("OAuth broker") to complete that sign-in. This folder
holds the configuration for that broker, which runs as its own tiny, free
Cloudflare Worker — **separate** from the website.

It is served from **`https://auth.tiredpilots.ca`** (a custom domain on the
`tiredpilots.ca` zone). The `*.workers.dev` subdomain is **not** used for the
CMS, because this account has a Cloudflare Access rule over
`*.thomasjspaul.workers.dev` that would block GitHub's callback and the login
popup.

You set this up **once**. After that it just runs.

## What you need

- The website repo already pushed to GitHub (public is fine).
- The Cloudflare account the `tiredpilots.ca` zone is on.
- `npm` installed (for the `wrangler` commands).

## Steps

### 1. Get the broker source

The broker is a maintained open-source project. Fetch it into `oauth/src/`:

```sh
cd oauth
npx degit sveltia/sveltia-cms-auth/src src
```

(That copies `index.js` — the only file — next to this README's `wrangler.toml`.)

### 2. Deploy the Worker

```sh
npx wrangler deploy
```

`wrangler` logs in to Cloudflare in a browser the first time. `wrangler.toml`
already declares the custom domain, so this deploy also creates the
`auth.tiredpilots.ca` DNS record and its certificate. Give the certificate a few
minutes to go **Active** (Workers & Pages → `tiredpilots-cms-auth` → Settings →
Domains & Routes).

### 3. Register a GitHub OAuth App

Go to <https://github.com/settings/applications/new> and enter:

| Field                      | Value                                  |
| -------------------------- | -------------------------------------- |
| Application name           | `tiredpilots.ca CMS`                   |
| Homepage URL               | `https://tiredpilots.ca`               |
| Authorization callback URL | `https://auth.tiredpilots.ca/callback` |

Create it, then **Generate a new client secret**. You now have a **Client ID**
and a **Client secret**. (A classic OAuth App allows only one callback URL — if
you are migrating from the old `*.workers.dev` URL, just change it here.)

### 4. Give the Worker the GitHub credentials

```sh
npx wrangler secret put GITHUB_CLIENT_ID
# paste the Client ID

npx wrangler secret put GITHUB_CLIENT_SECRET
# paste the Client secret
```

These are stored encrypted by Cloudflare. They are **never** committed to git.
Check them with `npx wrangler secret list`.

### 5. Point the CMS at the broker

`public/admin/config.yml` is already set:

```yaml
backend:
  name: github
  repo: thomasjspaul/tired-pilots
  branch: main
  base_url: https://auth.tiredpilots.ca
```

Done — open `https://tiredpilots.ca/admin/` and click **Sign in with GitHub**.

## Rotating the secret later

Re-run step 3's "Generate a new client secret", then step 4's
`wrangler secret put GITHUB_CLIENT_SECRET` with the new value. No redeploy needed.

## Health check

`https://auth.tiredpilots.ca/` should return a short JSON status — **not** a
redirect to `*.cloudflareaccess.com` and not an error page. If you see the
Access redirect, the custom domain is not in place yet, or an Access application
still covers `auth.tiredpilots.ca`.
