# EEMA Fashion — Website Export

A 4-page static replica of the EEMA Fashion Google Stitch screens, wired together into a working site.

## Pages

| File            | Screen                                 | Nav label            |
|------------------|-----------------------------------------|-----------------------|
| `index.html`     | Home showcase (hero, capsules, story)   | HOME                  |
| `lookbook.html`  | Collections / Lookbook catalog          | LOOKBOOK & CAPSULES   |
| `atelier.html`   | Custom Atelier / Made-to-Measure builder| CUSTOM ATELIER        |
| `our-story.html` | Our Story / How to Order / Inquiries    | HOW TO ORDER          |

The header and footer nav links on every page now point to the real files above (they were all placeholder `#` links in the original Stitch export). The "ARTISANAL CRAFT" link points to the heritage/batik section on the home page (`index.html#heritage-story`) since no separate screen was provided for it — swap in a dedicated page later if you build one.

## How to run it

No build step — it's plain HTML + the Tailwind CDN (JIT compiled in the browser), exactly like the original Stitch export.

1. Open this folder in VS Code.
2. Install the **Live Server** extension (or any static server).
3. Right-click `index.html` → "Open with Live Server" (or run `npx serve .` from a terminal).
4. Requires an internet connection — it loads Tailwind, Google Fonts (Playfair Display + Inter), Material Symbols, and all product photography from Google's `lh3.googleusercontent.com` CDN (the same image URLs Stitch generated). If you want the site fully self-hosted, download those images and swap the `src`/`srcset` URLs for local paths in `/assets/images`.

## Notes on fidelity

- Layout, spacing, type scale, and the full color system come straight from the Stitch `DESIGN.md` tokens (see `docs/DESIGN.md`), wired into `tailwind.config` in each file's `<head>`.
- All copy, product cards, WhatsApp deep-links, prices, and interactive JS (capsule switcher, quick-preview modal, bespoke order builder, measurement unit toggle, accordion FAQ, scroll reveals) are unchanged from the original export.
- The only edits made were: fixing the cross-page navigation (`data-path` → real `href`), removing a stray inline `cursor: grabbing` style left over from the Stitch editor, giving each page a distinct `<title>`, and guarding one scroll-listener against a missing element so no console errors are thrown on the home page.
- WhatsApp number used throughout: `+94 71 905 2928` — search-and-replace `94719052928` across the files if this should change.
- There's no mobile hamburger menu markup in the original screens (nav is desktop-only, hidden below the `xl` breakpoint) — add one if you need full mobile nav; the JS already has a guarded hook (`mobile-menu-toggle` / `mobile-menu-drawer`) ready for it.

## Structure

```
eema-fashion-website/
├── index.html
├── lookbook.html
├── atelier.html
├── our-story.html
├── docs/
│   └── DESIGN.md      ← full design system reference (colors, type, spacing, components)
└── README.md
```
