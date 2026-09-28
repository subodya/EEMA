# Deploying EEMA Fashion on Cloudflare Pages

The site is static HTML/CSS/JS. Supabase (database, admin logins, product photos) stays on Supabase.
Cloudflare builds the site from this GitHub repo on every push to `main`.

## What the build does (`npm run build:ci`)

| Step | Script | Result |
|---|---|---|
| Supabase config | `scripts/write-config.mjs` | Writes `eema-fashion-website/js/supabase-config.js` from the `SUPABASE_URL` / `SUPABASE_ANON_KEY` environment variables. Refuses a `service_role` / secret key. |
| Tailwind CSS | `scripts/build-css.mjs` | Compiles `css/site.css` (public pages) and `css/admin.css` (admin) from the class names actually used, then minifies them. |
| Cache busting | `scripts/version-assets.mjs` | Adds `?v=<content hash>` to every `css/` and `js/` link in the HTML, so those files can be cached for a year and still update instantly. |

`eema-fashion-website/_headers` sets the caching and security headers on Cloudflare.

## 1. Create the Pages project

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**, and pick the `Project-1` repository.
2. Build settings:
   - **Production branch:** `main`
   - **Framework preset:** None
   - **Build command:** `npm ci && npm run build:ci`
   - **Build output directory:** `eema-fashion-website`
   - **Root directory:** *(leave empty)*
3. **Environment variables** (Production *and* Preview):
   - `SUPABASE_URL`: e.g. `https://xxxxxxxxxxxxxxxxxxxx.supabase.co`
   - `SUPABASE_ANON_KEY`: the **anon / public** key from Supabase → Project Settings → API
   - `NODE_VERSION`: `20`
4. **Save and Deploy.** The site goes live at `https://<project>.pages.dev`.

## 2. Connect your domain

1. Cloudflare → **Add a domain** → enter e.g. `eemafashion.lk` → Free plan. Cloudflare imports the existing DNS records.
   **Check the list.** If you use email on the domain, make sure the MX and TXT (SPF/DKIM) records are there.
2. At your domain registrar, replace the nameservers with the two Cloudflare gives you. This usually takes minutes to a few hours.
3. Pages project → **Custom domains** → add `eemafashion.lk` and `www.eemafashion.lk`. HTTPS certificates are automatic.
4. Recommended: **SSL/TLS → Edge Certificates** → turn on **Always Use HTTPS**, and enable **HSTS** once everything works.

## 3. Point Supabase at the new address

Supabase → **Authentication → URL Configuration**:
- **Site URL:** `https://eemafashion.lk`
- **Redirect URLs:** add `https://eemafashion.lk/**` and `https://<project>.pages.dev/**`

## 4. Retire GitHub Pages (once Cloudflare is live)

The GitHub Pages workflow (`.github/workflows/pages.yml`) runs the same build and keeps the old address working during the move.
When you no longer need it: GitHub → Settings → Pages → **Source: None**, and delete that workflow file.

## Keeping Supabase awake

Supabase's free tier pauses a project after about 7 days without database activity.
`.github/workflows/supabase-keepalive.yml` reads one row every 3 days using the `SUPABASE_URL` / `SUPABASE_ANON_KEY` **GitHub repository secrets** (already set for the current deploy).
- Run it manually any time: GitHub → **Actions → Keep Supabase active → Run workflow**.
- If a run fails, GitHub emails you. Restore a paused project from the Supabase dashboard.
- For a **public** repository, GitHub switches off scheduled workflows after 60 days without any commits. Re-enable it from the Actions tab if that happens. Private repositories aren't affected.

## Working locally

```bash
npm install          # once (installs Tailwind, PostCSS, cssnano)
npm run build        # writes css/ (and the Supabase config, if the env variables are set)
npm run dev          # rebuilds css/site.css automatically while you edit
```
Then open `eema-fashion-website/` with VS Code Live Server (or `npx serve eema-fashion-website`).
If you add new Tailwind classes, rebuild, or keep `npm run dev` running, or they won't have styles locally. The deploy always rebuilds.
