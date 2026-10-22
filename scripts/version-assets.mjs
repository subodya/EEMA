// Deploy-time cache busting. Adds ?v=<content hash> to every local css/ and js/ reference in the
// site's HTML files, so browsers can cache those files for a year (see vercel.json)
// and still pick up a new version the moment it changes. Run only on the deploy build (npm run build:ci),
// never on your working copy, so the source HTML stays clean.
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const site = join(dirname(fileURLToPath(import.meta.url)), '..', 'eema-fashion-website');
const hashes = new Map();
const hashOf = (rel) => {
  if (!hashes.has(rel)) {
    const file = join(site, rel);
    if (!existsSync(file)) throw new Error(`Referenced file is missing: ${rel}`);
    hashes.set(rel, createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 10));
  }
  return hashes.get(rel);
};

let count = 0;
for (const name of readdirSync(site).filter((f) => f.endsWith('.html'))) {
  const path = join(site, name);
  const html = readFileSync(path, 'utf8');
  const out = html.replace(/\b(href|src)="((?:css|js)\/[\w.-]+\.(?:css|js))"/g, (_, attr, rel) => {
    count++;
    return `${attr}="${rel}?v=${hashOf(rel)}"`;
  });
  writeFileSync(path, out);
}
console.log(`✔ Versioned ${count} asset references across ${hashes.size} files`);
