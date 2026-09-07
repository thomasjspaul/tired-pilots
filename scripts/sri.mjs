// Print the Subresource Integrity attribute for a remote script.
//
//   node scripts/sri.mjs https://unpkg.com/@sveltia/cms@0.206.1/dist/sveltia-cms.js
//
// Paste the output into the matching <script> tag (integrity="..." crossorigin="anonymous").

import { createHash } from 'node:crypto';

const url = process.argv[2];
if (!url) {
  console.error('usage: node scripts/sri.mjs <url>');
  process.exit(1);
}

const res = await fetch(url, { redirect: 'follow' });
if (!res.ok) {
  console.error(`fetch failed: ${res.status} ${res.statusText}`);
  process.exit(1);
}
const buf = Buffer.from(await res.arrayBuffer());
const sha384 = createHash('sha384').update(buf).digest('base64');
console.log(`resolved: ${res.url}`);
console.log(`bytes:    ${buf.length}`);
console.log(`integrity="sha384-${sha384}" crossorigin="anonymous"`);
