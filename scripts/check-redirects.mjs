// Verifies every rule in public/_redirects returns a 301 to the right target.
// Usage: node ./scripts/check-redirects.mjs https://<preview>.pages.dev

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const base = process.argv[2];
if (!base) {
  console.error('Usage: node ./scripts/check-redirects.mjs <base-url>');
  process.exit(2);
}

const text = await readFile(
  fileURLToPath(new URL('../public/_redirects', import.meta.url)),
  'utf8',
);
const rules = text
  .split('\n')
  .filter((l) => l && !l.startsWith('#'))
  .map((l) => {
    const [from, to] = l.trim().split(/\s+/);
    return { from, to };
  });

let fail = 0;
for (const { from, to } of rules) {
  const res = await fetch(base.replace(/\/$/, '') + from, { redirect: 'manual' });
  const loc = res.headers.get('location') ?? '';
  const wantPath = to.split('#')[0];
  const ok =
    (res.status === 301 || res.status === 308) && loc.replace(/#.*$/, '').endsWith(wantPath);
  if (!ok) {
    fail++;
    console.log(`FAIL ${from} -> ${res.status} ${loc || '(no Location)'}  (want 301 -> ${to})`);
  }
}
console.log(`${rules.length} redirects checked, ${fail} failed`);
process.exit(fail ? 1 : 0);
