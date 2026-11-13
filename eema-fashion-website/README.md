# Chamathkara Lankan Fashion — Website Export

A 4-page static replica of the Chamathkara Lankan Fashion Google Stitch screens, wired together into a working site.

## Pages

| File            | Screen                                 | Nav label            |
|------------------|-----------------------------------------|-----------------------|
| `index.html`     | Home showcase (hero, capsules, story)   | HOME                  |
| `lookbook.html`  | Collections / Lookbook catalog          | LOOKBOOK & CAPSULES   |
| `atelier.html`   | Custom Atelier / Made-to-Measure builder| CUSTOM ATELIER        |
| `our-story.html` | Our Story / How to Order / Inquiries    | HOW TO ORDER          |

The header and footer nav links on every page now point to the real files above (they were all placeholder `#` links in the original Stitch export). The "ARTISANAL CRAFT" link points to the heritage/batik section on the home page (`index.html#heritage-story`) since no separate screen was provided for it — swap in a dedicated page later if you build one.

## How to run it

Plain HTML pages styled with a **pre-built Tailwind stylesheet**: `css/site.css` for the public pages, `css/admin.css` for the admin. The stylesheets are generated, not hand-edited. Build them from the repository root (one folder up):

1. `npm install` (once), then `npm run build`. Or run `npm run dev` to rebuild automatically while editing.
2. Open this folder in VS Code with the **Live Server** extension, or run `npx serve eema-fashion-website` from the repo root.
3. Requires an internet connection for Google Fonts, Material Symbols, Supabase and the product photos.

Design tokens (colours, type scale, spacing) live in `tailwind.site.config.js` at the repo root, mirroring `docs/DESIGN.md`. Deployment (Vercel, domain, Supabase keep-alive) is described in `DEPLOYMENT.md` at the repo root.

## Notes on fidelity

- Layout, spacing, type scale, and the full color system come straight from the Stitch `DESIGN.md` tokens (see `docs/DESIGN.md`), defined once in `tailwind.site.config.js`.
- All copy, product cards, WhatsApp deep-links, prices, and interactive JS (capsule switcher, quick-preview modal, bespoke order builder, measurement unit toggle, accordion FAQ, scroll reveals) are unchanged from the original export.
- The only edits made were: fixing the cross-page navigation (`data-path` → real `href`), removing a stray inline `cursor: grabbing` style left over from the Stitch editor, giving each page a distinct `<title>`, and guarding one scroll-listener against a missing element so no console errors are thrown on the home page.
- WhatsApp number used throughout: `+94 77 905 2928`. Search-and-replace `94779052928` across the files (and `WHATSAPP_NUMBER` in the config) if it changes.
- There's no mobile hamburger menu markup in the original screens (nav is desktop-only, hidden below the `xl` breakpoint) — add one if you need full mobile nav; the JS already has a guarded hook (`mobile-menu-toggle` / `mobile-menu-drawer`) ready for it.

## Shared header & footer

Every public page (`index`, `lookbook`, `atelier`, `our-story`, `product`) uses the same header, the home page design, and the same footer. The header markup is written directly in each page, so it shows instantly with no layout jump; only the active link differs per page. Its behaviour (mobile menu, search panel, scroll shadow, Esc to close) is in `js/site-nav.js`. If you change a nav link or the footer, make the same change in all five pages.

## Product management (Supabase + admin panel)

Products are no longer hard-coded. The Lookbook grid (`lookbook.html`) and the home page "New Arrivals" (`index.html#collection-grid`) load from a Supabase database, and owners manage everything at **`/admin.html`**. That page isn't linked from the site, so bookmark it.

### One-time setup (about 10 minutes)

1. Create a free project at [supabase.com](https://supabase.com). Pick the **Singapore** region, which is closest to Sri Lanka.
2. In **SQL Editor**, run `supabase/schema.sql`, then `supabase/seed.sql`. That creates the tables, security rules and the `product-images` storage bucket, and loads the 10 original products under *Ladies*.
3. Go to **Authentication → Users → Add user**. Create the owner login (email + password, tick *Auto Confirm User*). Then under **Authentication → Providers → Email**, turn **off** "Allow new users to sign up".
4. Back in **SQL Editor**, make that user an admin:
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'owner@example.com';
   ```
   Repeat this for every extra person who should have access.
5. Go to **Project Settings → API** and copy the *Project URL* and the *anon public* key:
   - **Local development:** copy `js/supabase-config.example.js` to `js/supabase-config.js` and paste the values in. That file is git-ignored, so it's never committed.
   - **Live site (Vercel):** in the Vercel project go to **Settings → Environment Variables** and add `SUPABASE_URL` and `SUPABASE_ANON_KEY`. Vercel builds the config from them on every push to `main`. Add the same two as GitHub repository secrets for the Supabase keep-alive workflow (see `DEPLOYMENT.md`).

   The anon key is meant to be public, because Row Level Security blocks visitors from writing. **Never** put the `service_role` key in this project.

### Using the admin panel

- **Products tab**
  - **Add product** opens a form: photos (drag & drop; the first one is the cover), name, price, category, short line, description, fabric, style tags, colours, and *Published* / *Featured* switches.
  - Photos are resized to 1600px WebP in the browser before upload.
  - Each row has a *Live* switch (show/hide on the site), a ★ (feature on the home page), edit, and delete. Delete also removes the product's photos.
- **Categories tab**
  - Add, rename, or reorder categories (Ladies / Gents / Kids to start). New categories appear as Lookbook tabs automatically.
  - A category can only be deleted once it's empty.

> **Already set up Supabase before the product page was added?** Run `supabase/migrations/002_product_sizes.sql` once in the SQL Editor. It adds the `sizes` column and gives existing Ladies products XS–XL. Until you run it, the site keeps working, but no size picker appears.

> **Stock status:** run `supabase/migrations/003_product_stock.sql` once in the SQL Editor to enable the **In stock / Out of stock** switch.

### Product cards, sliders & sorting
- **Cards:** product cards are editorial and minimal: photo, name, price and colour dots.
  - **On a computer:** moving the mouse across a photo steps through that product's photos (up to 6), and a Quick view / Inquire bar slides up.
  - **On phones:** swipe the photo to browse; a small WhatsApp button sits on it. Dots show which photo is showing.
- **Home page:** after *New Arrivals*, there's one sliding row per category ("The Ladies Edit", …), built from the categories in the admin. New categories get a row automatically.
- **Phone rows:** *New Arrivals* and *You may also like* slide sideways on phones and tablets, and become a 4-column grid on desktop.
- **Lookbook:** 2 columns on phones, 3 on tablets, 4 on desktop, plus a **Sort** menu (Featured, Newest, price low→high, high→low). The sort is kept in the link (`?sort=price-asc`). Out-of-stock pieces always stay last.
- **Styles:** card and slider styles live in `js/catalog.js` (injected once per page).

### Out of stock
- **Where to set it:** each product in the admin list has an **In stock / Out of stock** switch. The same switch is in the product form under *Availability & visibility*.
- **Card treatment:** out-of-stock products stay on the website but are clearly marked. The photo is muted, an "Out of stock" label sits over it, and a note appears under the name.
- **Button:** "Inquire on WhatsApp" becomes **"Ask about restock"**, which sends a "let me know when it's back" message.
- **Product page:** shows an "Out of stock" badge and an explanation. Customers can still pick the colour and size they'd like, and a size is optional.
- **Ordering:** sold-out pieces move to the end of the Lookbook and are never shown in the home page's New Arrivals.
- **Hiding completely:** to remove a product from the website entirely, turn off **Published** in the product form instead.

### Admin sign-in & sessions

- **Tab-only login:** the admin login is kept only for the open tab (sessionStorage). Closing the tab or browser signs you out.
- **Inactivity sign-out:** after **20 minutes** with no taps or typing, a "Still there?" warning appears with a 60-second countdown. If nobody taps "Stay signed in", the panel signs out and discards any unsaved photo uploads.
- **Maximum session:** you're signed out **8 hours** after signing in, even if active.
- **Tablets:** the limits are checked again the moment the screen wakes, so a tablet left asleep overnight opens at the login screen.
- **Changing the limits:** edit `ADMIN_IDLE_MINUTES` and `ADMIN_MAX_SESSION_HOURS` in `js/supabase-config.js`.
- **Sign-out scope:** signing out on one device doesn't sign out your other devices.

**Recommended Supabase dashboard settings** (Authentication section):
- *Sign In / Providers → Email:* keep **Allow new users to sign up** off.
- *Password security:* set a minimum length of 12+, require mixed characters, and enable leaked-password protection if your plan has it.
- *Sessions:* set a time-box and an inactivity timeout here too. Requires a paid plan; it enforces the limits on the server, not just in the browser.
- *Attack protection:* enable CAPTCHA (Cloudflare Turnstile or hCaptcha) for sign-in.
- *Multi-factor:* enable TOTP (authenticator app) MFA. The admin panel needs a small addition to use it; see the notes on strengthening authentication.

### Product detail page (`product.html?p=<slug>`)

Clicking a product image or name (or "View full details" in quick view) opens its detail page:
- Image gallery with thumbnails, swipe on mobile, and a full-screen viewer (arrow keys / Esc).
- Colour swatches and size buttons (plus "Custom fit"), with a size-guide pop-up.
- An "Inquire on WhatsApp" message that includes the chosen colour, size, price and the page link.
- Sections for Description, Fabric & Care, Fit & Tailoring, and Delivery & Exchanges.
- "You may also like" (same category first), a sticky inquiry bar on mobile, and share/SEO tags.

Sizes are set per product in the admin form (Adult / Kids presets or your own). Each product row in the admin also has a ↗ link to its live page.

### How the public pages use it

- Lookbook category tabs, the *Style* chips (from product tags) and the *Tone* chips (the most common colours) are all built from the data.
- Deep links work: `lookbook.html?category=gents`, and the header search goes to `lookbook.html?search=linen`.
- WhatsApp inquiry links and the quick-view modal are generated per product. The made-to-measure garment list is filled from the catalog.
- Only *Published* products are visible to visitors (enforced in the database, not only in the page).

## Structure

```
eema-fashion-website/
├── index.html
├── lookbook.html
├── atelier.html
├── our-story.html
├── product.html            ← product detail page (product.html?p=slug)
├── returns.html            ← returns & exchanges policy (linked in every footer)
├── favicon.ico, favicon-96x96.png, apple-touch-icon.png,
│   web-app-manifest-*.png, site.webmanifest ← site icons (tabs, iPhone/Android home screen)
├── admin.html              ← product admin panel (login required)
├── js/
│   ├── site-nav.js         ← shared header: mobile menu, search, scroll shadow
│   ├── supabase-config.example.js ← template; copy to supabase-config.js (git-ignored)
│   ├── supabase-client.js  ← creates the shared client (window.sb)
│   ├── catalog.js          ← public product grid, filters, featured grid
│   ├── product.js          ← product detail page
│   └── admin.js            ← admin panel logic
├── supabase/
│   ├── schema.sql          ← tables, RLS security rules, storage bucket
│   ├── seed.sql            ← starting categories + the original 10 products
│   └── migrations/002_product_sizes.sql ← adds product sizes to an existing database
├── docs/
│   └── DESIGN.md      ← full design system reference (colors, type, spacing, components)
└── README.md
```
