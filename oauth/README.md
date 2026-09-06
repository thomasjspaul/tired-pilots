# CMS login (GitHub OAuth broker)

The visual editor at `/admin` signs editors in with their GitHub account. GitHub
requires a small server ("OAuth broker") to complete that sign-in. This folder
holds the configuration for that broker, which runs as its own tiny, free
Cloudflare Worker — **separate** from the website.

You set this up **once**. After that it just runs.

## What you need

- The website repo already pushed to GitHub (public is fine).
- The Cloudflare account the website is deployed on.
- `npm` installed (for the one `wrangler` command).

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

`wrangler` will open a browser to log in to Cloudflare the first time. When it
finishes it prints a URL like:

```
https://tiredpilots-cms-auth.<your-subdomain>.workers.dev
```

Copy that URL.

### 3. Register a GitHub OAuth App

Go to <https://github.com/settings/applications/new> and enter:

| Field                      | Value                                                                |
| -------------------------- | -------------------------------------------------------------------- |
| Application name           | `TiredPilots.ca CMS`                                                 |
| Homepage URL               | `https://tiredpilots.ca`                                             |
| Authorization callback URL | `https://tiredpilots-cms-auth.<your-subdomain>.workers.dev/callback` |

Create it, then **Generate a new client secret**. You now have a **Client ID**
and a **Client secret**.

### 4. Give the Worker the GitHub credentials

```sh
npx wrangler secret put GITHUB_CLIENT_ID
# paste the Client ID

npx wrangler secret put GITHUB_CLIENT_SECRET
# paste the Client secret
```

These are stored encrypted by Cloudflare. They are **never** committed to git.

### 5. Point the CMS at the broker

In `public/admin/config.yml` set:

```yaml
backend:
  name: github
  repo: <your-github-user>/tired-pilots
  branch: main
  base_url: https://tiredpilots-cms-auth.<your-subdomain>.workers.dev
```

Commit that change. Done — open `https://<your-site>/admin/` and click
**Sign in with GitHub**.

## Rotating the secret later

Re-run step 3's "Generate a new client secret", then step 4's
`wrangler secret put GITHUB_CLIENT_SECRET` with the new value. No redeploy needed.

## Health check

`https://tiredpilots-cms-auth.<your-subdomain>.workers.dev/` should return a
short JSON status, not an error page.
