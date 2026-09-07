import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');

describe('public/_headers', () => {
  const headers = read('public/_headers');
  const cspLines = headers.match(/Content-Security-Policy:.*/g) ?? [];

  /** The remote (http/https) origins listed in a CSP line's `script-src`. */
  const scriptSrcOrigins = (cspLine: string): string[] =>
    (cspLine.match(/script-src ([^;]+)/)?.[1] ?? '')
      .split(/\s+/)
      .filter((token) => token.startsWith('https://') || token.startsWith('http://'))
      .sort();

  it('has exactly one CSP (Pages combines duplicates as an intersection)', () => {
    expect(cspLines.length).toBe(1);
  });

  it('keeps the hardening directives', () => {
    const csp = cspLines[0] ?? '';
    for (const directive of [
      "default-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      'upgrade-insecure-requests',
    ]) {
      expect(csp).toContain(directive);
    }
  });

  it('keeps the transport and framing headers', () => {
    expect(headers).toMatch(/Strict-Transport-Security: max-age=\d+/);
    expect(headers).toContain('X-Frame-Options: DENY');
    expect(headers).toContain('X-Content-Type-Options: nosniff');
    // allow-popups, not bare same-origin: the CMS OAuth popup needs window.opener
    expect(headers).toMatch(/Cross-Origin-Opener-Policy: same-origin-allow-popups/);
  });

  it('allows remote scripts only from the analytics beacon and the pinned CMS CDN', () => {
    expect(scriptSrcOrigins(cspLines[0] ?? '')).toEqual([
      'https://static.cloudflareinsights.com',
      'https://unpkg.com',
    ]);
  });

  it('does not set a second CSP on /admin', () => {
    const adminBlock = headers.slice(headers.indexOf('/admin/*'));
    expect(adminBlock).not.toContain('Content-Security-Policy');
  });
});

describe('public/admin/index.html', () => {
  const html = read('public/admin/index.html');

  it('pins the Sveltia CMS bundle to an exact version', () => {
    expect(html).toMatch(/@sveltia\/cms@\d+\.\d+\.\d+\/dist\/sveltia-cms\.js/);
    expect(html).not.toMatch(/@sveltia\/cms\/dist/); // no floating "latest"
  });

  it('locks the bundle with Subresource Integrity', () => {
    expect(html).toMatch(/integrity="sha(256|384|512)-[A-Za-z0-9+/=]+"/);
    expect(html).toContain('crossorigin="anonymous"');
  });
});

describe('functions/api/embed.js', () => {
  const fn = read('functions/api/embed.js');

  it('rejects requests that are not from an allowed origin', () => {
    expect(fn).toMatch(/function originAllowed\(/);
    // the guard compares the parsed host by exact equality, not substring
    expect(fn).toMatch(/host === 'tiredpilots\.ca'/);
    expect(fn).toMatch(/return json\(\{ error: 'forbidden' \}, 403\)/);
  });

  it('caps the request body size', () => {
    expect(fn).toMatch(/content-length/i);
    expect(fn).toMatch(/413/);
  });

  it('never inlines the API key', () => {
    expect(fn).toContain('env.COHERE_API_KEY');
    expect(fn).not.toMatch(/COHERE_API_KEY\s*=\s*['"][A-Za-z0-9]/);
  });
});
