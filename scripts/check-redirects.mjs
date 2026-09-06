// Verifies every legacy path 301s to its new location on a deployed preview.
// Usage: node ./scripts/check-redirects.mjs https://<preview>.pages.dev
//
// STATUS: stub. Implemented in Stage 4 alongside gen-redirects.mjs.

const base = process.argv[2];
if (!base) {
  console.error('Usage: node ./scripts/check-redirects.mjs <base-url>');
  process.exit(2);
}
console.log(`[check-redirects] stub — nothing to verify yet against ${base}`);
