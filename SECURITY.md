# Security policy

`tiredpilots.ca` is a static, informational website. It has no user accounts, no
login for visitors, no database, and no visitor data storage beyond a single
`localStorage` flag that records the one‑time disclaimer acknowledgement. Even so,
the source is public and reports are welcome.

## Reporting a vulnerability

**Please do not open a public GitHub issue for a security problem.**

Report it privately, by either route:

- **GitHub** — open a private advisory at
  <https://github.com/thomasjspaul/tired-pilots/security/advisories/new>
  (Security → Report a vulnerability).
- **Email** — <security@tiredpilots.ca>. If you want to encrypt, ask in a first
  message with no details and a key will be provided.

Please include:

- what you found and where (URL, file, or request),
- the steps to reproduce or a proof of concept,
- what an attacker could do with it,
- any suggested fix.

## What to expect

This is a personal project run by one person, so response times are best‑effort:

| Stage                                   | Target                                         |
| --------------------------------------- | ---------------------------------------------- |
| Acknowledge your report                 | within 5 days                                  |
| Initial assessment                      | within 14 days                                 |
| Fix or mitigation for a confirmed issue | as fast as practical; typically within 30 days |

You will be credited in the fix commit or advisory unless you ask not to be.
There is no paid bounty.

## Scope

In scope:

- `tiredpilots.ca` and `www.tiredpilots.ca`
- `tired-pilots.pages.dev` and its preview deployments
- the `/api/embed` Pages Function
- the `/admin` content manager and the CMS OAuth broker Worker
  (`tiredpilots-cms-auth.thomasjspaul.workers.dev`)
- this repository (build scripts, workflows, dependencies)

Out of scope:

- findings that require a compromised editor GitHub account or a compromised
  Cloudflare/GitHub account
- missing hardening with no demonstrated impact (e.g. "header X could also be
  set") — still welcome, but triaged as low
- denial of service through sheer request volume
- reports from automated scanners with no analysis
- social engineering, physical attacks, or third‑party services
  (Cloudflare, GitHub, Cohere, unpkg) — report those to the vendor

## Handling of the content itself

The regulatory content is an educational aid, not legal advice, and can contain
errors. Content mistakes are **not** security issues — use the
"Suggest a correction" link on any page, or email <corrections@tiredpilots.ca>.

## Good‑faith safe harbour

Testing that stays within this scope, does not degrade the service for others,
does not access or modify data that is not yours, and is reported privately and
promptly will not be pursued. Automated high‑volume scanning is not authorised.
