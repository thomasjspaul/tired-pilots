import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');

describe('public/_headers', () => {
  const headers = read('public/_headers');

  it('sets a site-wide Content-Security-Policy with the hardening directives', () => {
    const csp = headers.match(/Content-Security-Policy:.*/g) ?? [];
    expect(csp.length).toBeGreaterThanOrEqual(2); // site-wide + /admin
    const siteWide = csp[0];
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

  it('only allows the CMS script host inside the /admin CSP', () => {
    const adminCsp = (headers.match(/Content-Security-Policy:.*/g) ?? []).find((l) =>
      l.includes('unpkg.com'),
    );
    expect(adminCsp, 'an /admin CSP block should exist').toBeTruthy();
    // no unexpected script origins snuck in
    expect(adminCsp).not.toMatch(/script-src[^;]*https?:\/\/(?!unpkg\.com)/);
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
    expect(fn).toMatch(/originAllowed/);
    expect(fn).toContain("'tiredpilots.ca'");
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
