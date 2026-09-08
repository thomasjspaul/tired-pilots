import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import GithubSlugger from 'github-slugger';

/**
 * Guards every internal link and `#anchor` in the site content (and in the
 * hardcoded links in the page/component `.astro` files) against the real set of
 * routes and heading anchors. Nothing else in CI catches a `](/rules/700-99)` or
 * a `#bad-anchor` — `astro check` only validates `reference()` ids, and
 * `content-links.test.ts` only bans chat-tool hosts.
 *
 * `github-slugger` is the same slugger `rehype-slug` uses (via astro.config.mjs),
 * so the anchors computed here match the `id=`s Astro emits for Markdown headings.
 */

const root = process.cwd();
const CONTENT = join(root, 'src', 'content');
const PAGES = join(root, 'src', 'pages');
const COMPONENTS = join(root, 'src', 'components');

// ---------------------------------------------------------------- helpers

function walk(dir: string, ext: RegExp): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p, ext));
    else if (ext.test(e.name)) out.push(p);
  }
  return out;
}

function splitFrontmatter(text: string): { fm: string; body: string } {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(text);
  return m ? { fm: m[1], body: text.slice(m[0].length) } : { fm: '', body: text };
}

/** Minimal top-level scalar reader for a YAML frontmatter block. */
function fmScalar(fm: string, key: string): string | undefined {
  const m = new RegExp(`^${key}:[ \\t]*(.+)$`, 'm').exec(fm);
  if (!m) return undefined;
  return m[1].trim().replace(/^['"]|['"]$/g, '');
}

/** Strip inline Markdown so heading text matches what rehype-slug slugs. */
function headingText(raw: string): string {
  return raw
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_]{1,3}/g, '')
    .replace(/<[^>]+>/g, '')
    .trim();
}

function headingAnchors(body: string): Set<string> {
  const slugger = new GithubSlugger();
  const out = new Set<string>();
  for (const line of body.split('\n')) {
    const m = /^#{1,6}[ \t]+(.+?)[ \t]*#*\s*$/.exec(line);
    if (m) out.add(slugger.slug(headingText(m[1])));
  }
  return out;
}

/** The slug fn from src/pages/glossary.astro. */
const glossaryAnchor = (t: string) =>
  t
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

function idAttrs(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(/\sid=["']([^"']+)["']/g)) out.add(m[1]);
  return out;
}

// ---------------------------------------------------------------- route + anchor maps

/** collection dir -> URL prefix */
const COLLECTIONS: Record<string, string> = {
  regulations: '/rules/',
  explainers: '/qa/',
  pages: '/',
};

const routes = new Set<string>(['/']);
/** route -> set of valid `#anchor` values on that page */
const anchors = new Map<string, Set<string>>();

// content-collection routes + their heading anchors
for (const [dir, prefix] of Object.entries(COLLECTIONS)) {
  const base = join(CONTENT, dir, 'en');
  if (!existsSync(base)) continue;
  for (const file of walk(base, /\.mdx?$/)) {
    const text = readFileSync(file, 'utf8');
    const { fm, body } = splitFrontmatter(text);
    const slug =
      fmScalar(fm, 'slug') ??
      relative(base, file)
        .replace(/\.mdx?$/, '')
        .split(sep)
        .join('/');
    const route = (prefix === '/' ? '/' + slug : prefix + slug).replace(/\/$/, '') || '/';
    routes.add(route);
    anchors.set(route, headingAnchors(body));
  }
}

// static .astro routes (skip dynamic [...] segments) + their explicit id= anchors
for (const file of walk(PAGES, /\.astro$/)) {
  const rel = relative(PAGES, file)
    .replace(/\.astro$/, '')
    .split(sep)
    .join('/');
  if (rel.includes('[')) continue;
  const route = rel === 'index' ? '/' : '/' + rel;
  routes.add(route);
  anchors.set(
    route,
    new Set([...(anchors.get(route) ?? []), ...idAttrs(readFileSync(file, 'utf8'))]),
  );
}

// /glossary anchors come from the definitions data, not headings
{
  const defs = readFileSync(join(root, 'src', 'data', 'definitions.ts'), 'utf8');
  const set = anchors.get('/glossary') ?? new Set<string>();
  for (const m of defs.matchAll(/term:\s*'([^']+)'/g)) set.add(glossaryAnchor(m[1]));
  anchors.set('/glossary', set);
}

// ---------------------------------------------------------------- link scan

type Bad = { file: string; link: string; why: string };
const LINK_RE = /\]\(\s*(\/[^)\s]*|#[^)\s]*)\s*\)/g; // markdown: ](/path) or ](#frag)
const HREF_RE = /href=["'](\/[^"'#\s]*(?:#[^"'\s]*)?)["']/g; // .astro: href="/path#frag"

function checkTarget(target: string, ownRoute: string | null, file: string, bad: Bad[]) {
  let path: string;
  let hash: string | undefined;
  if (target.startsWith('#')) {
    if (!ownRoute) return; // a `#frag` link in a component with no single route — skip
    path = ownRoute;
    hash = target.slice(1);
  } else {
    const h = target.indexOf('#');
    path = (h === -1 ? target : target.slice(0, h)).replace(/\/$/, '') || '/';
    hash = h === -1 ? undefined : target.slice(h + 1);
  }
  if (!routes.has(path)) {
    bad.push({ file, link: target, why: `no route "${path}"` });
    return;
  }
  if (hash) {
    const set = anchors.get(path);
    if (!set || !set.has(hash))
      bad.push({ file, link: target, why: `no anchor "#${hash}" on ${path}` });
  }
}

describe('internal links and anchors resolve', () => {
  it('every ](/…) and #… link in src/content points at a real route + anchor', () => {
    const bad: Bad[] = [];
    for (const [dir, prefix] of Object.entries(COLLECTIONS)) {
      const base = join(CONTENT, dir, 'en');
      if (!existsSync(base)) continue;
      for (const file of walk(base, /\.mdx?$/)) {
        const text = readFileSync(file, 'utf8');
        const { fm, body } = splitFrontmatter(text);
        const slug =
          fmScalar(fm, 'slug') ??
          relative(base, file)
            .replace(/\.mdx?$/, '')
            .split(sep)
            .join('/');
        const ownRoute = (prefix === '/' ? '/' + slug : prefix + slug).replace(/\/$/, '') || '/';
        for (const m of body.matchAll(LINK_RE)) {
          checkTarget(m[1], ownRoute, relative(root, file), bad);
        }
      }
    }
    // also the regulation-text collection (rendered inside /rules/<slug>)
    const rtBase = join(CONTENT, 'regulation-text', 'en');
    if (existsSync(rtBase)) {
      for (const file of walk(rtBase, /\.mdx?$/)) {
        const { body } = splitFrontmatter(readFileSync(file, 'utf8'));
        for (const m of body.matchAll(LINK_RE)) checkTarget(m[1], null, relative(root, file), bad);
      }
    }
    expect(bad, bad.map((b) => `${b.file}: ${b.link} — ${b.why}`).join('\n')).toEqual([]);
  });

  it('every literal href="/…" in src/pages and src/components points at a real route + anchor', () => {
    const bad: Bad[] = [];
    for (const file of [...walk(PAGES, /\.astro$/), ...walk(COMPONENTS, /\.astro$/)]) {
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(HREF_RE)) {
        checkTarget(m[1], null, relative(root, file), bad);
      }
    }
    expect(bad, bad.map((b) => `${b.file}: ${b.link} — ${b.why}`).join('\n')).toEqual([]);
  });
});
