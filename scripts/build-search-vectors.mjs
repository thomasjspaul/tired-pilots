// Post-build: embeds each content chunk with Cohere and writes
// dist/search/vectors.json for the in-browser semantic search island.
//
// STATUS: stub — this is a POST-LAUNCH fast-follow (see the plan). It is wired
// into `postbuild` with `|| true`, so a missing COHERE_API_KEY (e.g. on fork PR
// previews) is a no-op and the site falls back to Pagefind keyword search.

if (!process.env.COHERE_API_KEY) {
  console.log('[search-vectors] COHERE_API_KEY not set — skipping semantic index (Pagefind only).');
  process.exit(0);
}

console.log('[search-vectors] stub: semantic index build not implemented yet.');
process.exit(0);
