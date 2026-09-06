// Weekly check (see .github/workflows/reg-watch.yml): has the CARs or
// AC 700-047 changed since the version recorded in src/data/reg-versions.json?
//
//   node ./scripts/check-reg-versions.mjs            -> report; exit 1 if changed
//   node ./scripts/check-reg-versions.mjs --update   -> write the live values back
//
// On a change the workflow fails, which emails the repo owner. After reviewing
// the affected pages, run with --update and commit.

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const path = fileURLToPath(new URL('../src/data/reg-versions.json', import.meta.url));
const state = JSON.parse(await readFile(path, 'utf8'));
const update = process.argv.includes('--update');

const get = async (url) => {
  const res = await fetch(url, { headers: { 'user-agent': 'tiredpilots-regwatch' } });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.text();
};
const first = (re, s) => (re.exec(s) || [])[1]?.trim();

const changes = [];

// ---- CARs SOR/96-433 -----------------------------------------------------
try {
  const html = await get(state.cars.url);
  const currentTo = first(/current to\s*<?[^>]*>?\s*(\d{4}-\d{2}-\d{2})/i, html);
  const lastAmended = first(/last amended[^0-9]{0,40}(\d{4}-\d{2}-\d{2})/i, html);
  if (currentTo && currentTo !== state.cars.currentTo)
    changes.push(`CARs "current to": ${state.cars.currentTo} -> ${currentTo}`);
  if (lastAmended && lastAmended !== state.cars.lastAmendedOn)
    changes.push(`CARs "last amended on": ${state.cars.lastAmendedOn} -> ${lastAmended}`);
  if (update) {
    if (currentTo) state.cars.currentTo = currentTo;
    if (lastAmended) state.cars.lastAmendedOn = lastAmended;
  }
} catch (e) {
  changes.push(`Could not check the CARs: ${e.message}`);
}

// ---- AC 700-047 --------------------------------------------------------------
try {
  const html = await get(state.ac700047.url).then((s) => s.replace(/<[^>]+>/g, '|'));
  const issue = first(/Issue No\.?:?\s*\|+\s*([0-9]+)/i, html);
  const eff = first(/Effective Date:?\s*\|+\s*(\d{4}-\d{2}-\d{2})/i, html);
  if (issue && issue !== state.ac700047.issue)
    changes.push(`AC 700-047 issue: ${state.ac700047.issue} -> ${issue}`);
  if (eff && eff !== state.ac700047.effectiveDate)
    changes.push(`AC 700-047 effective date: ${state.ac700047.effectiveDate} -> ${eff}`);
  if (update) {
    if (issue) state.ac700047.issue = issue;
    if (eff) state.ac700047.effectiveDate = eff;
  }
} catch (e) {
  changes.push(`Could not check AC 700-047: ${e.message}`);
}

if (update) {
  state.checkedOn = new Date().toISOString().slice(0, 10);
  await writeFile(path, JSON.stringify(state, null, 2) + '\n', 'utf8');
  console.log('[reg-watch] updated src/data/reg-versions.json');
  process.exit(0);
}

if (changes.length === 0) {
  console.log('[reg-watch] no change — CARs and AC 700-047 match the recorded versions.');
  process.exit(0);
}

const report = [
  '**A source this site is built from has changed:**',
  '',
  ...changes.map((c) => `- ${c}`),
].join('\n');
console.log(report);
if (process.env.GITHUB_STEP_SUMMARY) {
  await writeFile(process.env.GITHUB_STEP_SUMMARY, report + '\n', { flag: 'a' });
}
process.exit(1);
