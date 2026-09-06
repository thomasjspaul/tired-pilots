# Editing TiredPilots.ca

This guide is for **editing the site's content**. You never need the command
line, and you never edit files directly.

---

## The short version

1. Go to **`https://<the-site>/admin/`**
2. Click **Sign in with GitHub**
3. Edit a page using the forms
4. Click **Save** (keeps it as a draft), then **Publish** when you're ready
5. A preview link appears. Look it over.
6. Click **Merge** (in the editor or on GitHub). The live site updates in a
   minute or two.

That's it.

---

## How the site is organised

| Section in `/admin` | What's in it                                                                                                                                                            |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Regulations**     | One entry per CARs section (700.28, 700.40, …). Each has a plain-language explanation, the current wording, an optional "pre-2018 version", and a "last reviewed" date. |
| **Q&A explainers**  | The plain-English answers (splits, disruptive schedules, acclimatization, …).                                                                                           |
| **Editorial pages** | Home, About, Cheat Sheet, Coming Into Force, Changelog.                                                                                                                 |
| **Site settings**   | The disclaimer text, the "suggest a correction" email, and the header menu.                                                                                             |

## Fields worth understanding

- **Draft** — while this is on, the page is **not** on the live site. Turn it off
  when the page is ready.
- **Last reviewed** — the date you last checked this page against the actual
  CARs. Bump it every time you verify a page, even if nothing changed. Readers
  see this date.
- **Regulation text retrieved on** — the date the quoted regulation wording was
  copied from laws-lois.justice.gc.ca.
- **Old Google Sites paths** — if a page existed on the old site at a different
  address, add the old address here so old links keep working.
- **Worked examples** (on Q&A explainers) — these double as automatic tests for
  the calculator, so keep the numbers correct.

## Adding a picture

Use the image button in the editor. Images are stored in the repo under
`public/uploads/`. Always fill in the **alt text** (a short description) — the
site requires it.

---

## What "public repository" means

The code and content of this site live in a **public** GitHub repository. That
means:

- Anyone on the internet can **read** every file, including older versions and
  the full edit history.
- Only people you invite can **change** anything.
- This is on purpose — it makes the site transparent and lets others suggest
  corrections.

### The one rule: never put a secret in the repo

A "secret" is a password, an API key, or a token. Examples for this project:

- the **Cohere API key** (for search, added later)
- the **GitHub OAuth client secret** (for the `/admin` login)
- any Cloudflare API token

These belong **only** in the Cloudflare dashboard (Settings → Variables, marked
as encrypted) or set via `wrangler secret put`. They must never appear in a file,
a commit, or a pull request.

If you ever paste one into the editor or a file by mistake:

1. Don't panic, but treat it as compromised.
2. Rotate it (generate a new one) at the service it came from.
3. Tell whoever maintains the deployment.

Files that are safe and expected in the repo: all the content, the config in
`public/admin/config.yml` (it has no secrets — the login secret lives in the
separate OAuth Worker), and `.env.example` (a template with **no real values**).

---

## If something looks broken

- The live site didn't update → check that the pull request was **merged**, then
  wait ~2 minutes for the rebuild.
- The `/admin` page won't load or won't sign you in → the OAuth Worker may need
  attention; see [`oauth/README.md`](./oauth/README.md).
- A build failed → open the repo on GitHub, click the red ✗ next to the latest
  change, and read the log (or ask for help).
