import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// The Pages Function needs the Cloudflare runtime + a live Cohere key, so this
// asserts on its source, the same way security.test.ts does for embed.js —
// guarding the abuse controls and the prompt guarantees against regression.
const fn = readFileSync(resolve(process.cwd(), 'functions/api/rewrite.js'), 'utf8');

describe('functions/api/rewrite.js', () => {
  it('is same-origin guarded, like /api/embed', () => {
    expect(fn).toMatch(/function originAllowed\(/);
    expect(fn).toMatch(/host === 'tiredpilots\.ca'/);
    expect(fn).toMatch(/return json\(\{ error: 'forbidden' \}, 403\)/);
  });

  it('caps the request body and rejects text that is too short', () => {
    expect(fn).toMatch(/content-length/i);
    expect(fn).toMatch(/\b413\b/);
    expect(fn).toMatch(/text too short to rewrite/);
  });

  it('keeps the Cohere key server-side', () => {
    expect(fn).toContain('env.COHERE_API_KEY');
    expect(fn).toMatch(/if \(!env\.COHERE_API_KEY\)/);
    expect(fn).not.toMatch(/COHERE_API_KEY\s*=\s*['"][A-Za-z0-9]/);
  });

  it('calls Cohere chat with structured output and never caches the result', () => {
    expect(fn).toContain('https://api.cohere.com/v2/chat');
    expect(fn).toMatch(/response_format:\s*\{\s*type:\s*'json_object'\s*\}/);
    expect(fn).toMatch(/'cache-control':\s*'no-store'/);
  });

  it('scores the rewrite with an embedding and tolerates an embed failure', () => {
    expect(fn).toContain('https://api.cohere.com/v2/embed');
    expect(fn).toMatch(/function cosine\(/);
    // runMatch returns null on failure; the request still succeeds
    expect(fn).toMatch(/return null;/);
  });

  it('the prompt smooths wording only and protects meaning', () => {
    expect(fn).toMatch(/Do NOT change meaning/i);
    expect(fn).toMatch(/Keep every defined term exactly/i);
    expect(fn).toMatch(/Keep every Markdown link/i);
    expect(fn).not.toMatch(/rewrite the (rule|regulation)/i);
  });
});
