// Creates eema-fashion-website/js/supabase-config.js from the committed template
// (supabase-config.example.js) and the SUPABASE_URL / SUPABASE_ANON_KEY environment variables.
//
// - On a deploy (Vercel, GitHub Actions) the variables are required.
// - Locally, if they aren't set, an existing supabase-config.js is left untouched.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const jsDir = join(root, 'eema-fashion-website', 'js');
const template = join(jsDir, 'supabase-config.example.js');
const target = join(jsDir, 'supabase-config.js');

const url = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
const key = (process.env.SUPABASE_ANON_KEY || '').trim();
const isDeploy = Boolean(process.env.VERCEL ||process.env.GITHUB_ACTIONS || process.env.CI);

if (!url || !key) {
  if (isDeploy) {
    console.error('✖ SUPABASE_URL and SUPABASE_ANON_KEY must be set as environment variables for this build.');
    process.exit(1);
  }
  if (existsSync(target)) {
    console.log('• SUPABASE_URL / SUPABASE_ANON_KEY not set — keeping the existing js/supabase-config.js');
    process.exit(0);
  }
  console.warn('! No Supabase settings: copy js/supabase-config.example.js to js/supabase-config.js and fill it in.');
  process.exit(0);
}

if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)) {
  console.error(`✖ SUPABASE_URL doesn't look like a Supabase project URL: ${url}`);
  process.exit(1);
}
// Guard against pasting the secret service_role key by mistake.
try {
  const payload = JSON.parse(Buffer.from(key.split('.')[1] || '', 'base64url').toString('utf8'));
  if (payload && payload.role && payload.role !== 'anon') {
    console.error(`✖ SUPABASE_ANON_KEY has role "${payload.role}". Use the anon/public key, never service_role.`);
    process.exit(1);
  }
} catch { /* publishable keys aren't JWTs — fine */ }
if (/^sb_secret_/.test(key)) {
  console.error('✖ SUPABASE_ANON_KEY is a secret key. Use the publishable/anon key.');
  process.exit(1);
}

const out = readFileSync(template, 'utf8')
  .replace('https://YOUR-PROJECT-REF.supabase.co', () => url)
  .replace('YOUR-ANON-PUBLIC-KEY', () => key);
if (out.includes('YOUR-')) {
  console.error('✖ Template placeholders were not all replaced — check supabase-config.example.js.');
  process.exit(1);
}
writeFileSync(target, out);
console.log('✔ Wrote js/supabase-config.js');
