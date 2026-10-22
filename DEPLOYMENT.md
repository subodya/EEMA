# Deploying EEMA Fashion on Vercel

The site is static HTML/CSS/JS. Supabase (database, admin logins, product photos) stays on Supabase.
Vercel builds the site from this GitHub repo on every push to `main`, and builds a preview for every other branch and pull request.

## What the build does (`npm run build:ci`)

| Step | Script | Result |
|---|---|---|
| Supabase config | `scripts/write-config.mjs` | Writes `eema-fashion-website/js/supabase-config.js` from the `SUPABASE_URL` / `SUPABASE_ANON_KEY` environment variables. Refuses a `service_role` / secret key. |
| Tailwind CSS | `scripts/build-css.mjs` | Compiles `css/site.css` (public pages) and `css/admin.css` (admin) from the class names actually used, then minifies them. |
| Cache busting | `scripts/version-assets.mjs` | Adds `?v=<content hash>` to every `css/` and `js/` link in the HTML, so those files can be cached for a year and still update instantly. |

`vercel.json` at the repo root holds the build settings, the caching and security headers, and `cleanUrls` (so `/admin` serves `admin.html`).

## 1. Create the Vercel project

This has to be done by the GitHub account that owns the repository (`subodya/EEMA`), because only the owner can give Vercel access to it.

1. Sign in at [vercel.com](https://vercel.com) with the repo owner's GitHub account.
2. **Add New… → Project.** Under **Import Git Repository**, click **Install** / **Adjust GitHub App Permissions**, allow access to `EEMA`, then click **Import** next to it.
3. Build settings: `vercel.json` already sets these, so leave them as they are:
   - **Framework Preset:** Other
   - **Root Directory:** `./` *(leave as is)*
   - **Build / Output / Install:** taken from `vercel.json` (`npm run build:ci`, `eema-fashion-website`, `npm ci`)
4. **Environment Variables:** add both, for Production *and* Preview:
   - `SUPABASE_URL`: e.g. `https://xxxxxxxxxxxxxxxxxxxx.supabase.co`
   - `SUPABASE_ANON_KEY`: the **anon / public** key from Supabase → Project Settings → API
5. **Deploy.** The site goes live at `https://<project>.vercel.app`.

Project → **Settings → General → Node.js Version:** pick `20.x` (or newer).
If you change an environment variable later, redeploy (**Deployments → ⋯ → Redeploy**) for it to take effect.

## 2. Connect your domain

1. Vercel project → **Settings → Domains** → add `eemafashion.lk` and `www.eemafashion.lk` (Vercel suggests redirecting one to the other).
2. Vercel shows the DNS records to create. At your domain's DNS provider, add them:
   - apex `eemafashion.lk`: an **A** record to the IP Vercel shows
   - `www`: a **CNAME** to the target Vercel shows
   Leave your existing MX and TXT (SPF/DKIM) records alone so email keeps working.
3. Wait for the domains to show **Valid Configuration**. HTTPS certificates are automatic.

## 3. Point Supabase at the new address

Supabase → **Authentication → URL Configuration**:
- **Site URL:** `https://eemafashion.lk`
- **Redirect URLs:** add `https://eemafashion.lk/**` and `https://<project>.vercel.app/**`

## Keeping Supabase awake

Supabase's free tier pauses a project after about 7 days without database activity.
`.github/workflows/supabase-keepalive.yml` reads one row every 3 days using the `SUPABASE_URL` / `SUPABASE_ANON_KEY` **GitHub repository secrets** (GitHub → repo → Settings → Secrets and variables → Actions → **New repository secret**; same values as in Vercel).
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
