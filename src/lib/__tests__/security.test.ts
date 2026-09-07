import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');

describe('public/_headers', () => {
  const headers = read('public/_headers');
  // [0] = the site-wide `/*` block, [1] = the `/admin/*` override.
  const cspLines = headers.match(/Content-Security-Policy:.*/g) ?? [];

  /** The remote (http/https) origins listed in a CSP line's `script-src`. */
  const scriptSrcOrigins = (cspLine: string): string[] =>
    (cspLine.match(/script-src ([^;]+)/)?.[1] ?? '')
      .split(/\s+/)
      .filter((token) => token.startsWith('https://') || token.startsWith('http://'));

  it('sets a site-wide Content-Security-Policy with the hardening directives', () => {
    expect(cspLines.length).toBeGreaterThanOrEqual(2);
    const siteWide = cspLines[0];
    for (const directive of [
      "default-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      'upgrade-insecure-requests',
    ]) {
      expect(siteWide).toContain(directive);
    }
  });

  it('keeps the transport and framing headers', () => {
    expect(headers).toMatch(/Strict-Transport-Security: max-age=\d+/);
    expect(headers).toContain('X-Frame-Options: DENY');
    expect(headers).toContain('X-Content-Type-Options: nosniff');
    expect(headers).toContain('Cross-Origin-Opener-Policy: same-origin');
  });

  it('site-wide CSP loads remote scripts only from the analytics beacon', () => {
    expect(scriptSrcOrigins(cspLines[0])).toEqual(['https://static.cloudflareinsights.com']);
  });

  it('the /admin CSP loads remote scripts only from the pinned CMS CDN', () => {
    expect(cspLines.length).toBeGreaterThanOrEqual(2);
    expect(scriptSrcOrigins(cspLines[1])).toEqual(['https://unpkg.com']);
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
