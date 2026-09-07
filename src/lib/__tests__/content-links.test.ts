import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Internal links on this site are relative (`/rules/700-28`). When content is
// drafted in a chat tool and pasted in, those links sometimes come out pointing
// at the tool's own domain (e.g. `https://chatgpt.com/rules/700-28`) or a
// leftover placeholder host. This test fails the build if any such link lands in
// src/content/, since Prettier/`astro check` won't catch it.

const CONTENT_DIR = resolve(process.cwd(), 'src/content');
const BAD_HOSTS = [
  'chatgpt.com',
  'chat.openai.com',
  'claude.ai',
  'gemini.google.com',
  'localhost',
  '127.0.0.1',
  'example.com',
  'example.org',
];

function mdxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...mdxFiles(p));
    else if (/\.mdx?$/.test(entry.name)) out.push(p);
  }
  return out;
}

describe('content links', () => {
  const files = mdxFiles(CONTENT_DIR);

  it('finds content to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('has no Markdown links pointing at a chat tool or placeholder host', () => {
    const linkRe = /\]\(\s*(https?:\/\/[^)\s]+)/gi;
    const offenders: string[] = [];

    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(linkRe)) {
        let host: string;
        try {
          host = new URL(m[1]).host.toLowerCase();
        } catch {
          continue;
        }
        if (BAD_HOSTS.some((b) => host === b || host.endsWith(`.${b}`))) {
          const rel = file.slice(process.cwd().length + 1).replace(/\\/g, '/');
          offenders.push(`${rel} -> ${m[1]}`);
        }
      }
    }

    expect(offenders, `internal links must be relative, not:\n${offenders.join('\n')}`).toEqual([]);
  });
});
