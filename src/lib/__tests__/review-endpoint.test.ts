import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// The Pages Function is not executed here (it needs the Cloudflare runtime + a
// live Cohere key). We assert on its source, the same way security.test.ts does
// for functions/api/embed.js — this guards the abuse controls against
// regression.
const fn = readFileSync(resolve(process.cwd(), 'functions/api/review.js'), 'utf8');

describe('functions/api/review.js', () => {
  it('is same-origin guarded, like /api/embed', () => {
    expect(fn).toMatch(/function originAllowed\(/);
    expect(fn).toMatch(/host === 'tiredpilots\.ca'/);
    expect(fn).toMatch(/return json\(\{ error: 'forbidden' \}, 403\)/);
  });

  it('caps the request body and rejects a too-short draft', () => {
    expect(fn).toMatch(/content-length/i);
    expect(fn).toMatch(/\b413\b/);
    expect(fn).toMatch(/draft too short to review/);
  });

  it('keeps the Cohere key server-side', () => {
    expect(fn).toContain('env.COHERE_API_KEY');
    expect(fn).not.toMatch(/COHERE_API_KEY\s*=\s*['"][A-Za-z0-9]/);
    expect(fn).toMatch(/if \(!env\.COHERE_API_KEY\)/);
  });

  it('calls Cohere chat with structured output and never caches the result', () => {
    expect(fn).toContain('https://api.cohere.com/v2/chat');
    expect(fn).toMatch(/response_format:\s*\{\s*type:\s*'json_object'\s*\}/);
    expect(fn).toMatch(/'cache-control':\s*'no-store'/);
  });

  it('adds the drift score only from a verbatim source, and degrades on failure', () => {
    expect(fn).toContain('https://api.cohere.com/v2/embed');
    expect(fn).toMatch(/hasSource/);
    // a Cohere failure surfaces as chatError, not a 5xx
    expect(fn).toMatch(/error:\s*true/);
    expect(fn).toMatch(/chatError/);
  });

  it('does not rewrite or approve — the prompt forbids it', () => {
    expect(fn).toMatch(/do NOT rewrite/i);
    expect(fn).toMatch(/do NOT certify or approve/i);
  });
});
