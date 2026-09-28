// Compiles the Tailwind stylesheets with PostCSS and minifies them with cssnano.
// cssnano's colour rewriting ("colormin") is turned off: it converts colours to rounded hsla()
// values, which shifts some translucent colours by a shade. Everything else is minified normally.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import cssnano from 'cssnano';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const targets = [
  { config: 'tailwind.site.config.js', input: 'styles/site.css', output: 'eema-fashion-website/css/site.css' },
  { config: 'tailwind.admin.config.js', input: 'styles/admin.css', output: 'eema-fashion-website/css/admin.css' }
];

for (const t of targets) {
  const from = join(root, t.input);
  const to = join(root, t.output);
  const result = await postcss([
    tailwindcss(join(root, t.config)),
    cssnano({ preset: ['default', { colormin: false }] })
  ]).process(await readFile(from, 'utf8'), { from, to });
  result.warnings().forEach((w) => console.warn('!', w.toString()));
  await mkdir(dirname(to), { recursive: true });
  await writeFile(to, result.css);
  console.log(`✔ ${relative(root, to)}  ${(Buffer.byteLength(result.css) / 1024).toFixed(1)} KB`);
}
