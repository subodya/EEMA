// Chamathkara Lankan Fashion — public product catalog (reads from Supabase).
// Requires: supabase-js CDN → js/supabase-config.js → js/supabase-client.js → this file.
// Used by lookbook.html (full filterable grid) and index.html (featured grid).
(function () {
  const cfg = window.EEMA_CONFIG || {};

  // Known tag slugs → display labels. Unknown tags are title-cased automatically.
  const TAG_LABELS = {
    'pure-linen': 'Pure Linen',
    'batik': 'Artisanal Batik',
    'coords': 'Co-Ords & Sets',
    'dresses': 'Dresses',
    'tailored': 'Tailored'
  };
  const TAG_ORDER = Object.keys(TAG_LABELS);

  const WA_ICON = '<svg class="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"></path></svg>';
  const FB_ICON = '<svg class="w-3.5 h-3.5 fill-current shrink-0" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"></path></svg>';

  // ---------- helpers ----------

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function formatPrice(n) {
    return 'Rs ' + Number(n || 0).toLocaleString('en-US');
  }

  function tagLabel(slug) {
    return TAG_LABELS[slug] || String(slug).replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function safeHex(hex) {
    return /^#[0-9a-f]{3,8}$/i.test(hex || '') ? hex : '#e4e2de';
  }

  // Products without the in_stock column (migration 003 not run) count as in stock.
  const isOutOfStock = (p) => p && p.in_stock === false;

  function whatsappUrl(product) {
    const color = (product.colors && product.colors[0] && product.colors[0].name) || '';
    const msg = isOutOfStock(product)
      ? `Hello Chamathkara Lankan Fashion, the ${product.name} is showing as out of stock. Could you let me know when it's available again${color ? ' in ' + color : ''}? (${formatPrice(product.price)})`
      : `Hello Chamathkara Lankan Fashion, I would like to order the ${product.name}${color ? ' in ' + color : ''} (${formatPrice(product.price)})`;
    return `https://wa.me/${cfg.WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
  }

  function productUrl(p) {
    return 'product.html?p=' + encodeURIComponent(p.slug);
  }

  // ---------- data ----------

  const PRODUCT_FIELDS = 'id,name,slug,short_note,description,price,tags,fabric,colors,sizes,in_stock,images,is_featured,category_id,created_at,category:categories(id,name,slug)';
  // Columns added by later migrations (002 sizes, 003 in_stock). If one is missing in the
  // database, the query is retried without it so the site keeps working.
  const OPTIONAL_FIELDS = ['sizes', 'in_stock'];

  async function queryProducts(build) {
    let fields = PRODUCT_FIELDS;
    let res = await build(fields);
    for (let i = 0; res.error && i < OPTIONAL_FIELDS.length; i++) {
      const missing = OPTIONAL_FIELDS.find((f) => fields.includes(',' + f) && new RegExp('\\b' + f + '\\b').test(res.error.message || ''));
      if (!missing) break;
      fields = fields.replace(',' + missing, '');
      res = await build(fields);
    }
    if (res.error) throw res.error;
    return res.data;
  }

  // In-stock pieces first; keeps the admin's ordering within each group (sort is stable).
  const inStockFirst = (list) => list.sort((a, b) => Number(isOutOfStock(a)) - Number(isOutOfStock(b)));

  async function fetchProductBySlug(slug) {
    if (!window.sb) throw new Error('Supabase not configured');
    return queryProducts((fields) => sb.from('products').select(fields)
      .eq('slug', slug).eq('is_published', true).maybeSingle());
  }

  async function fetchCategories() {
    if (!window.sb) return [];
    const { data, error } = await sb.from('categories').select('id,name,slug,sort_order').order('sort_order');
    if (error) throw error;
    return data || [];
  }

  async function fetchProducts({ featured = false, limit = null, categoryId = null } = {}) {
    if (!window.sb) throw new Error('Supabase not configured');
    const data = await queryProducts((fields) => {
      let q = sb.from('products')
        .select(fields)
        .eq('is_published', true)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });
      if (featured) q = q.eq('is_featured', true);
      if (categoryId) q = q.eq('category_id', categoryId);
      if (limit) q = q.limit(limit);
      return q;
    });
    return inStockFirst(data || []);
  }

  // ---------- card styles (injected once, shared by every page that shows products) ----------

  const CARD_CSS = `
  /* Editorial product card */
  .eema-card { display: flex; flex-direction: column; min-width: 0; }
  .ec-media { position: relative; aspect-ratio: 3 / 4; overflow: hidden; background: #F5F1EA; }
  .ec-link { position: absolute; inset: 0; display: block; }
  .ec-track { display: flex; width: 100%; height: 100%; overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none; overscroll-behavior-x: contain; }
  .ec-track::-webkit-scrollbar { display: none; }
  .ec-img { flex: 0 0 100%; width: 100%; height: 100%; object-fit: cover; scroll-snap-align: start; transition: transform 1.2s cubic-bezier(.2,.7,.2,1); }
  .eema-card:hover .ec-img { transform: scale(1.035); }
  .ec-noswipe .ec-track { overflow: hidden; }
  .ec-dots { position: absolute; left: 0; right: 0; bottom: 12px; display: flex; justify-content: center; gap: 5px; pointer-events: none; z-index: 2; }
  .ec-dots span { width: 6px; height: 6px; border-radius: 9999px; background: rgba(255,255,255,.55); box-shadow: 0 0 0 1px rgba(26,26,26,.12); transition: width .3s ease, background .3s ease; }
  .ec-dots span.on { width: 18px; background: #fff; }
  .ec-tag { position: absolute; top: 12px; left: 12px; z-index: 2; background: rgba(255,255,255,.92); backdrop-filter: blur(4px); padding: 4px 8px; font: 600 10px/1.2 Inter, sans-serif; letter-spacing: .16em; text-transform: uppercase; color: #1A1A1A; pointer-events: none; }
  .ec-veil { position: absolute; inset: 0; z-index: 1; background: rgba(255,255,255,.32); display: flex; align-items: center; justify-content: center; pointer-events: none; }
  .ec-veil span { background: rgba(26,26,26,.9); color: #fff; padding: 8px 14px; font: 600 11px/1 Inter, sans-serif; letter-spacing: .2em; text-transform: uppercase; }
  .ec-actions { position: absolute; left: 10px; right: 10px; bottom: 10px; z-index: 3; display: grid; grid-template-columns: 1fr 1fr; gap: 6px; transform: translateY(calc(100% + 14px)); opacity: 0; transition: transform .45s cubic-bezier(.2,.7,.2,1), opacity .3s ease; }
  .ec-actions a, .ec-actions button { display: flex; align-items: center; justify-content: center; gap: 6px; height: 40px; background: rgba(255,255,255,.95); backdrop-filter: blur(6px); color: #1A1A1A; font: 600 10.5px/1 Inter, sans-serif; letter-spacing: .14em; text-transform: uppercase; transition: background .2s, color .2s; }
  .ec-actions a:hover { background: #1E5E3A; color: #fff; }
  .ec-actions button:hover { background: #1A1A1A; color: #fff; }
  .ec-actions.single { grid-template-columns: 1fr; }
  .ec-body { padding: 14px 2px 4px; display: flex; flex-direction: column; gap: 4px; }
  .ec-name { font-family: 'Playfair Display', Georgia, serif; font-size: 18px; line-height: 1.3; color: #1A1A1A; transition: color .2s; }
  .eema-card:hover .ec-name { color: #960052; }
  .ec-price { font: 500 13px/1.4 Inter, sans-serif; letter-spacing: .05em; color: #1A1A1A; white-space: nowrap; }
  .ec-note { font: 400 12px/1.5 Inter, sans-serif; color: #5f5e5e; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; }
  .ec-swatches { display: flex; align-items: center; gap: 6px; margin-top: 4px; }
  .ec-swatches i { width: 10px; height: 10px; border-radius: 9999px; box-shadow: 0 0 0 1px rgba(26,26,26,.18); }
  .ec-swatches em { font: 400 11px/1 Inter, sans-serif; font-style: normal; color: #5f5e5e; margin-left: 2px; }
  .ec-stock { font: 500 11px/1.4 Inter, sans-serif; letter-spacing: .08em; text-transform: uppercase; color: #8C154E; margin-top: 2px; }
  .ec-wa-fab { display: none; }
  .is-out-of-stock .ec-img { filter: saturate(.35); }
  .is-out-of-stock .ec-price { color: #5f5e5e; }

  /* Desktop (mouse): actions slide up on hover */
  @media (hover: hover) and (pointer: fine) {
    .eema-card:hover .ec-actions, .eema-card:focus-within .ec-actions { transform: none; opacity: 1; }
    .eema-card:hover .ec-dots { bottom: 60px; }
    .ec-track { overflow: hidden; }
  }
  /* Touch: no hover bar; a small WhatsApp button on the photo instead */
  @media (hover: none), (pointer: coarse) {
    .ec-actions { display: none; }
    .ec-wa-fab { display: flex; position: absolute; right: 8px; bottom: 8px; z-index: 3; width: 36px; height: 36px; align-items: center; justify-content: center; border-radius: 9999px; background: rgba(255,255,255,.94); color: #1E5E3A; box-shadow: 0 2px 10px rgba(26,26,26,.12); }
    .ec-wa-fab svg { width: 18px; height: 18px; }
    .ec-noswipe .ec-dots { display: none; }
  }

  /* Phones: compact cards so two fit side by side */
  @media (max-width: 639px) {
    .ec-body > .flex { flex-direction: column; gap: 2px; }
    .ec-body .ec-price { padding-top: 0; }
    .ec-name { font-size: 15px; }
    .ec-note { display: none; }
    .ec-body { padding-top: 10px; }
    .ec-tag { top: 8px; left: 8px; font-size: 9px; padding: 3px 6px; }
    .ec-veil span { padding: 6px 10px; font-size: 9.5px; }
  }

  /* Lookbook filters: sticky on larger screens only, so phones keep room for the products */
  @media (max-width: 767px) { #lookbook-filters { position: static; box-shadow: none; } }

  /* Lookbook grid: 2 columns on phones, 3 on tablets, 4 on desktop */
  #product-grid.eema-grid { display: grid !important; grid-template-columns: repeat(2, minmax(0, 1fr)) !important; column-gap: .875rem; row-gap: 2rem; }
  @media (min-width: 640px) { #product-grid.eema-grid { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; column-gap: 1.25rem; row-gap: 2.5rem; } }
  @media (min-width: 1024px) { #product-grid.eema-grid { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; column-gap: 1.5rem; row-gap: 3rem; } }

  /* Sliding rows. .eema-rail slides at every size; .eema-rail-mobile slides below 1024px and becomes a 4-column grid above. */
  .eema-rail, .eema-rail-mobile { --bleed: 1.25rem; }
  @media (min-width: 768px) { .eema-rail, .eema-rail-mobile { --bleed: 3.5rem; } }
  .eema-rail { display: flex !important; gap: 1.5rem; overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none; scroll-behavior: smooth;
    margin-inline: calc(var(--bleed) * -1); padding-inline: var(--bleed); scroll-padding-inline: var(--bleed); padding-bottom: 6px; }
  .eema-rail::-webkit-scrollbar { display: none; }
  .eema-rail > * { flex: 0 0 72%; scroll-snap-align: start; }
  @media (min-width: 640px) { .eema-rail > * { flex-basis: calc((100% - 1.5rem) / 2.3); } }
  @media (min-width: 1024px) { .eema-rail > * { flex-basis: calc((100% - 4.5rem) / 4); } }
  @media (max-width: 1023px) {
    .eema-rail-mobile { display: flex !important; gap: .875rem; overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none;
      margin-inline: calc(var(--bleed) * -1); padding-inline: var(--bleed); scroll-padding-inline: var(--bleed); padding-bottom: 6px; }
    .eema-rail-mobile::-webkit-scrollbar { display: none; }
    .eema-rail-mobile > * { flex: 0 0 72%; scroll-snap-align: start; }
  }
  @media (min-width: 640px) and (max-width: 1023px) { .eema-rail-mobile > * { flex-basis: calc((100% - .875rem) / 2.3); } }
  .rail-btn { width: 44px; height: 44px; align-items: center; justify-content: center; border: 1px solid #EAE4DC; background: #fff; color: #1A1A1A; transition: background .2s, color .2s, opacity .2s; }
  .rail-btn:hover:not(:disabled) { background: #1A1A1A; color: #fff; }
  .rail-btn:disabled { opacity: .3; cursor: default; }

  /* Soft fade-up as cards scroll into view */
  .ec-reveal { opacity: 0; transform: translateY(18px); transition: opacity .8s ease, transform .8s cubic-bezier(.2,.7,.2,1); }
  .ec-reveal.is-in { opacity: 1; transform: none; }
  @media (prefers-reduced-motion: reduce) {
    .ec-reveal { opacity: 1; transform: none; transition: none; }
    .ec-img, .ec-actions, .eema-rail { transition: none; scroll-behavior: auto; }
  }
  `;
  (function injectCardCss() {
    if (document.getElementById('eema-card-css')) return;
    const style = document.createElement('style');
    style.id = 'eema-card-css';
    style.textContent = CARD_CSS;
    document.head.appendChild(style);
  })();

  // ---------- rendering ----------

  const MAX_CARD_IMAGES = 6;

  // Card tag: "Pure Linen" / "Artisanal Batik" when tagged, otherwise the category name.
  function cardTag(p) {
    const t = (p.tags || []).find((x) => x === 'pure-linen' || x === 'batik');
    return t ? tagLabel(t) : (p.category && p.category.name) || '';
  }

  // options.swipe = false for cards inside sliding rows (so swiping moves the row, not the photos)
  function renderProductCard(p, options = {}) {
    const swipe = options.swipe !== false;
    const images = (p.images || []).slice(0, MAX_CARD_IMAGES);
    const colors = Array.isArray(p.colors) ? p.colors : [];
    const catSlug = (p.category && p.category.slug) || '';
    const href = esc(productUrl(p));
    const out = isOutOfStock(p);
    const tag = cardTag(p);
    const canQuickView = typeof window.quickPreview === 'function';

    const media = images.length
      ? `<div class="ec-track">${images.map((src, i) =>
          `<img class="ec-img" src="${esc(src)}" alt="${i === 0 ? esc(p.name) + (out ? ' (out of stock)' : '') : ''}" ${i ? 'aria-hidden="true"' : ''} loading="lazy" decoding="async" draggable="false">`).join('')}</div>`
      : `<div class="w-full h-full flex items-center justify-center text-secondary/50"><span class="material-symbols-outlined text-[40px]">checkroom</span></div>`;
    const dots = images.length > 1
      ? `<div class="ec-dots" aria-hidden="true">${images.map((_, i) => `<span class="${i === 0 ? 'on' : ''}"></span>`).join('')}</div>`
      : '';
    const waLabel = out ? 'Ask about restock' : 'Inquire';

    const swatches = colors.length
      ? `<div class="ec-swatches">${colors.slice(0, 5).map((c) => `<i style="background:${safeHex(c.hex)}" title="${esc(c.name)}"></i>`).join('')}${colors.length > 1 ? `<em>${colors.length} shades</em>` : ''}</div>`
      : '';

    return `
<article class="fashion-card eema-card ec-reveal${out ? ' is-out-of-stock' : ''}${swipe ? '' : ' ec-noswipe'}"
  data-id="${esc(p.id)}" data-stock="${out ? 'out' : 'in'}" data-category-slug="${esc(catSlug)}" data-tags="${esc((p.tags || []).join(' '))}"
  data-colors="${esc(colors.map((c) => c.name).join('|'))}" data-price="${Number(p.price) || 0}"
  data-created="${esc(p.created_at || '')}" data-order="${options.index != null ? options.index : ''}"
  data-search="${esc([p.name, p.short_note, p.fabric, (p.tags || []).join(' '), p.category && p.category.name].join(' ').toLowerCase())}">
  <div class="ec-media">
    <a href="${href}" class="ec-link" aria-label="View ${esc(p.name)}">${media}</a>
    ${out ? '<div class="ec-veil"><span>Out of stock</span></div>' : ''}
    ${tag ? `<span class="ec-tag">${esc(tag)}</span>` : ''}
    ${dots}
    <div class="ec-actions${canQuickView ? '' : ' single'}">
      ${canQuickView ? `<button type="button" data-quick-view="${esc(p.id)}" aria-label="Quick view ${esc(p.name)}"><span class="material-symbols-outlined text-[16px]" aria-hidden="true">visibility</span>Quick view</button>` : ''}
      <a href="${esc(whatsappUrl(p))}" target="_blank" rel="noopener noreferrer" aria-label="${waLabel} about ${esc(p.name)} on WhatsApp">${WA_ICON}${waLabel}</a>
    </div>
    <a class="ec-wa-fab" href="${esc(whatsappUrl(p))}" target="_blank" rel="noopener noreferrer" aria-label="${waLabel} about ${esc(p.name)} on WhatsApp">${WA_ICON}</a>
  </div>
  <div class="ec-body">
    <div class="flex items-start justify-between gap-3">
      <h3 class="ec-name"><a href="${href}">${esc(p.name)}</a></h3>
      <span class="ec-price pt-1">${formatPrice(p.price)}</span>
    </div>
    ${p.short_note ? `<p class="ec-note">${esc(p.short_note)}</p>` : ''}
    ${swatches}
    ${out ? '<p class="ec-stock">Out of stock · ask about restock</p>' : ''}
  </div>
</article>`;
  }

  // ---------- card photo browsing: mouse position on desktop, swipe on touch ----------

  function setCardDots(card, i) {
    card.querySelectorAll('.ec-dots span').forEach((d, k) => d.classList.toggle('on', k === i));
  }
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

  document.addEventListener('pointermove', (e) => {
    if (!finePointer.matches || e.pointerType !== 'mouse') return;
    const media = e.target.closest && e.target.closest('.ec-media');
    if (!media) return;
    const track = media.querySelector('.ec-track');
    const n = track ? track.children.length : 0;
    if (n < 2) return;
    const r = media.getBoundingClientRect();
    const i = Math.min(n - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * n)));
    if (track.dataset.i !== String(i)) {
      track.dataset.i = i;
      track.scrollTo({ left: i * track.clientWidth, behavior: 'instant' });
      setCardDots(media.closest('.eema-card'), i);
    }
  }, { passive: true });

  document.addEventListener('pointerout', (e) => {
    const media = e.target.closest && e.target.closest('.ec-media');
    if (!media || media.contains(e.relatedTarget)) return;
    const track = media.querySelector('.ec-track');
    if (track && track.dataset.i && track.dataset.i !== '0') {
      track.dataset.i = 0;
      track.scrollTo({ left: 0, behavior: 'instant' });
      setCardDots(media.closest('.eema-card'), 0);
    }
  }, { passive: true });

  // Swipe (touch): keep dots in step with the scrolled photo
  document.addEventListener('scroll', (e) => {
    const track = e.target;
    if (!track.classList || !track.classList.contains('ec-track')) return;
    const i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
    if (track.dataset.i !== String(i)) { track.dataset.i = i; setCardDots(track.closest('.eema-card'), i); }
  }, { passive: true, capture: true });

  // ---------- fade-in as cards enter the viewport ----------

  const revealObserver = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add('is-in'); revealObserver.unobserve(en.target); }
      }), { rootMargin: '0px 0px -8% 0px', threshold: 0.05 })
    : null;
  function observeReveal(root) {
    const cards = root.querySelectorAll('.ec-reveal:not(.is-in)');
    cards.forEach((c, i) => {
      c.style.transitionDelay = `${(i % 4) * 70}ms`;
      if (revealObserver) revealObserver.observe(c); else c.classList.add('is-in');
    });
  }

  // ---------- sliding rows: arrow buttons ----------

  function wireRail(rail, prevBtn, nextBtn) {
    if (!rail) return;
    const update = () => {
      const max = rail.scrollWidth - rail.clientWidth - 2;
      if (prevBtn) prevBtn.disabled = rail.scrollLeft <= 2;
      if (nextBtn) nextBtn.disabled = rail.scrollLeft >= max;
    };
    const step = (dir) => rail.scrollBy({ left: dir * rail.clientWidth * 0.85, behavior: 'smooth' });
    if (prevBtn) prevBtn.addEventListener('click', () => step(-1));
    if (nextBtn) nextBtn.addEventListener('click', () => step(1));
    rail.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
    setTimeout(update, 400);
  }

  function renderSkeletons(n) {
    return Array.from({ length: n }, () => `
<div class="flex flex-col animate-pulse" aria-hidden="true">
  <div class="w-full aspect-[3/4] bg-linen-elevated"></div>
  <div class="pt-4 space-y-2"><div class="h-4 w-3/4 bg-linen-stone"></div><div class="h-3 w-1/3 bg-linen-elevated"></div></div>
</div>`).join('');
  }

  function renderMessage(title, body) {
    return `
<div class="col-span-full flex flex-col items-center text-center gap-3 py-16 bg-surface-container-low">
  <span class="material-symbols-outlined text-[32px] text-primary">checkroom</span>
  <h3 class="font-headline-sm text-headline-sm text-noir-text">${esc(title)}</h3>
  <p class="font-body-md text-body-md text-secondary max-w-md">${esc(body)}</p>
  <a class="mt-2 px-6 py-3 bg-noir-text hover:bg-whatsapp-forest text-surface-container-lowest font-label-caps text-label-caps uppercase tracking-widest transition-colors" href="https://wa.me/${esc(cfg.WHATSAPP_NUMBER)}" rel="noopener noreferrer" target="_blank">Ask our Stylist</a>
</div>`;
  }

  // Quick-view: one delegated listener, reusing the page's existing quickPreview() modal.
  const productIndex = new Map();
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-quick-view]');
    if (!btn || typeof window.quickPreview !== 'function') return;
    const p = productIndex.get(btn.getAttribute('data-quick-view'));
    if (!p) return;
    const color = (p.colors || []).map((c) => c.name).join(' / ') || '—';
    const out = isOutOfStock(p);
    window.quickPreview(p.name, formatPrice(p.price) + (out ? ' · Out of stock' : ''), color, p.description || p.fabric || '', (p.images || [])[0] || '');
    const modalWa = document.getElementById('modal-whatsapp-link');
    if (modalWa) {
      modalWa.href = whatsappUrl(p);
      const label = [...modalWa.querySelectorAll('span')].pop();
      if (label) label.textContent = out ? 'Ask about restock' : 'Inquire via WhatsApp';
    }
    const modalImg = document.getElementById('modal-img');
    if (modalImg) modalImg.style.filter = out ? 'saturate(.35)' : '';

    // Add a "View full details" link to the existing modal
    const waLink = document.getElementById('modal-whatsapp-link');
    if (waLink) {
      let details = document.getElementById('modal-details-link');
      if (!details) {
        details = document.createElement('a');
        details.id = 'modal-details-link';
        details.className = 'w-full py-2.5 border border-noir-text text-noir-text font-label-caps text-label-caps uppercase tracking-widest text-center hover:bg-noir-text hover:text-surface-container-lowest transition-colors';
        details.textContent = 'View full details';
        waLink.parentElement.prepend(details);
      }
      details.href = productUrl(p);
    }
  });

  function mount(grid, products, options = {}) {
    products.forEach((p) => productIndex.set(p.id, p));
    grid.innerHTML = products.map((p, index) => renderProductCard(p, { ...options, index })).join('');
    observeReveal(grid);
  }

  // ---------- lookbook page ----------

  const CHIP_BASE = 'px-2.5 py-1 text-body-sm border whitespace-nowrap transition-colors';
  const CHIP_ON = 'bg-noir-text text-surface-container-lowest border-noir-text';
  const CHIP_OFF = 'bg-transparent text-secondary border-stone-200/70 hover:text-noir-text';
  const TAB_ON = 'border-noir-text text-noir-text font-medium';
  const TAB_OFF = 'border-transparent text-secondary hover:text-noir-text';

  const state = { category: 'all', tag: 'all', color: 'all', search: '', sort: 'featured' };
  const SORTS = {
    featured: (a, b) => a.order - b.order,
    newest: (a, b) => (b.created || '').localeCompare(a.created || '') || a.order - b.order,
    'price-asc': (a, b) => a.price - b.price || a.order - b.order,
    'price-desc': (a, b) => b.price - a.price || a.order - b.order
  };

  // Re-orders the cards in the grid. Out-of-stock pieces always stay after in-stock ones.
  function applySort() {
    const grid = document.getElementById('product-grid');
    if (!grid) return;
    const cmp = SORTS[state.sort] || SORTS.featured;
    const cards = [...grid.querySelectorAll('.fashion-card')].map((el) => ({
      el, out: el.dataset.stock === 'out', price: Number(el.dataset.price) || 0,
      created: el.dataset.created || '', order: Number(el.dataset.order) || 0
    }));
    cards.sort((a, b) => Number(a.out) - Number(b.out) || cmp(a, b)).forEach((c) => grid.appendChild(c.el));
    const sel = document.getElementById('sort-select');
    if (sel && sel.value !== state.sort) sel.value = state.sort;
  }

  function setActive(container, value, on, off) {
    container.querySelectorAll('[data-value]').forEach((el) => {
      const active = el.getAttribute('data-value') === value;
      el.className = el.className.split(' ').filter((c) => !on.split(' ').includes(c) && !off.split(' ').includes(c)).join(' ') + ' ' + (active ? on : off);
      el.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function applyFilters() {
    let visible = 0;
    document.querySelectorAll('#product-grid .fashion-card').forEach((card) => {
      const cat = card.getAttribute('data-category-slug');
      const tags = (card.getAttribute('data-tags') || '').split(' ');
      const colors = (card.getAttribute('data-colors') || '').split('|');
      const show = (state.category === 'all' || cat === state.category) &&
                   (state.tag === 'all' || tags.includes(state.tag)) &&
                   (state.color === 'all' || colors.includes(state.color)) &&
                   (!state.search || (card.getAttribute('data-search') || '').includes(state.search.toLowerCase()));
      card.style.display = show ? 'flex' : 'none';
      if (show) visible++;
    });
    const counter = document.getElementById('product-counter');
    if (counter) counter.textContent = `Showing ${visible} silhouette${visible === 1 ? '' : 's'}` + (state.search ? ` for “${state.search}”` : '');
    const empty = document.getElementById('filter-empty');
    if (empty) empty.hidden = visible > 0 || !document.querySelector('#product-grid .fashion-card');

    const tabs = document.getElementById('category-tabs');
    const tagBox = document.getElementById('tag-chips');
    const toneBox = document.getElementById('tone-chips');
    if (tabs) setActive(tabs, state.category, TAB_ON, TAB_OFF);
    if (tagBox) setActive(tagBox, state.tag, CHIP_ON, CHIP_OFF);
    if (toneBox) setActive(toneBox, state.color, CHIP_ON, CHIP_OFF);

    const url = new URL(location.href);
    if (state.category === 'all') url.searchParams.delete('category'); else url.searchParams.set('category', state.category);
    if (state.search) url.searchParams.set('search', state.search); else url.searchParams.delete('search');
    if (state.sort !== 'featured') url.searchParams.set('sort', state.sort); else url.searchParams.delete('sort');
    history.replaceState(null, '', url);
  }

  function buttonsHtml(items, base, off) {
    return items.map(([value, label]) =>
      `<button type="button" data-value="${esc(value)}" class="${base} ${off}">${esc(label)}</button>`).join('');
  }

  async function initLookbook() {
    const grid = document.getElementById('product-grid');
    if (!grid) return;
    grid.classList.add('eema-grid');
    grid.innerHTML = renderSkeletons(8);
    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) sortSelect.addEventListener('change', () => { state.sort = sortSelect.value; applySort(); applyFilters(); });

    try {
      const [categories, products] = await Promise.all([fetchCategories(), fetchProducts()]);

      // Category tabs (from DB, so new categories show up automatically)
      const tabs = document.getElementById('category-tabs');
      if (tabs) {
        tabs.innerHTML = buttonsHtml([['all', 'All Silhouettes'], ...categories.map((c) => [c.slug, c.name])],
          'cat-pill pb-2 border-b-2 transition-colors whitespace-nowrap', TAB_OFF);
        tabs.onclick = (e) => { const b = e.target.closest('[data-value]'); if (b) { state.category = b.dataset.value; applyFilters(); } };
      }

      // Style tags (from products)
      const tagSet = new Set(products.flatMap((p) => p.tags || []));
      const tags = [...tagSet].sort((a, b) => {
        const ia = TAG_ORDER.indexOf(a), ib = TAG_ORDER.indexOf(b);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
      });
      const tagBox = document.getElementById('tag-chips');
      if (tagBox) {
        tagBox.innerHTML = buttonsHtml([['all', 'All'], ...tags.map((t) => [t, tagLabel(t)])], CHIP_BASE, CHIP_OFF);
        tagBox.onclick = (e) => { const b = e.target.closest('[data-value]'); if (b) { state.tag = b.dataset.value; applyFilters(); } };
      }

      // Tone chips — the 6 most common colour names across products
      const colorCount = new Map();
      products.forEach((p) => (p.colors || []).forEach((c) => {
        const cur = colorCount.get(c.name) || { n: 0, hex: c.hex };
        cur.n++; colorCount.set(c.name, cur);
      }));
      const topColors = [...colorCount.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 6);
      const toneBox = document.getElementById('tone-chips');
      if (toneBox) {
        toneBox.innerHTML = `<button type="button" data-value="all" class="${CHIP_BASE} ${CHIP_OFF}">All</button>` +
          topColors.map(([name, { hex }]) =>
            `<button type="button" data-value="${esc(name)}" class="${CHIP_BASE} ${CHIP_OFF} inline-flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full ring-1 ring-noir-text/20" style="background:${safeHex(hex)}"></span>${esc(name)}</button>`).join('');
        toneBox.onclick = (e) => { const b = e.target.closest('[data-value]'); if (b) { state.color = b.dataset.value; applyFilters(); } };
      }

      if (!products.length) {
        grid.innerHTML = renderMessage('New pieces arriving soon', 'Our atelier is preparing the next collection. Message our stylist to hear about it first.');
        return;
      }

      mount(grid, products);

      // Keep the made-to-measure drawer's garment list in sync with the catalog
      const garmentSelect = document.getElementById('fit-garment');
      if (garmentSelect) {
        garmentSelect.innerHTML = products.map((p) => {
          const v = `${p.name} (${formatPrice(p.price)})${isOutOfStock(p) ? ' — out of stock, made to order' : ''}`;
          return `<option value="${esc(v)}">${esc(v)}</option>`;
        }).join('');
      }

      const params = new URL(location.href).searchParams;
      const wanted = params.get('category');
      state.search = (params.get('search') || '').trim();
      if (SORTS[params.get('sort')]) state.sort = params.get('sort');
      if (wanted && categories.some((c) => c.slug === wanted)) state.category = wanted;
      applySort();
      applyFilters();
    } catch (err) {
      console.error('[EEMA] Could not load catalog:', err);
      grid.innerHTML = renderMessage('Collection temporarily unavailable', 'We could not load the catalog right now. Please refresh, or message our stylist directly on WhatsApp.');
    }
  }

  function setSearch(q) {
    state.search = (q || '').trim();
    applyFilters();
  }

  function resetFilters() {
    state.category = 'all'; state.tag = 'all'; state.color = 'all'; state.search = ''; state.sort = 'featured';
    applySort();
    applyFilters();
  }

  // ---------- home page ----------

  async function initFeatured(selector, { limit = 4 } = {}) {
    const grid = document.querySelector(selector);
    if (!grid) return;
    grid.classList.add('eema-rail-mobile');
    grid.innerHTML = renderSkeletons(limit);
    try {
      // Only in-stock pieces on the home page; top up with newest in-stock items if needed.
      let products = (await fetchProducts({ featured: true, limit: limit * 3 })).filter((p) => !isOutOfStock(p)).slice(0, limit);
      if (products.length < limit) {
        const more = (await fetchProducts({ limit: limit * 4 })).filter((p) => !isOutOfStock(p) && !products.some((x) => x.id === p.id));
        products = products.concat(more).slice(0, limit);
      }
      if (!products.length) {
        grid.innerHTML = renderMessage('New pieces arriving soon', 'Message our stylist to hear about the next collection first.');
        return;
      }
      mount(grid, products, { swipe: false });
      const count = document.getElementById('featured-count');
      if (count) count.textContent = `${products.length} Design${products.length === 1 ? '' : 's'} Available`;
    } catch (err) {
      console.error('[EEMA] Could not load featured products:', err);
      grid.innerHTML = renderMessage('Collection temporarily unavailable', 'Please refresh, or browse the full lookbook.');
    }
  }

  // One sliding row per category ("The Ladies Edit", ...), newest first, in-stock first.
  async function initCategoryRails(selector, { perRow = 10 } = {}) {
    const box = document.querySelector(selector);
    if (!box) return;
    try {
      const [categories, products] = await Promise.all([fetchCategories(), fetchProducts()]);
      const rows = categories
        .map((c) => ({ c, items: products.filter((p) => p.category_id === c.id).slice(0, perRow) }))
        .filter((r) => r.items.length);
      if (!rows.length) { box.hidden = true; return; }
      box.innerHTML = rows.map(({ c, items }, i) => `
        <div class="rail-block" data-rail="${esc(c.slug)}">
          <div class="flex items-end justify-between gap-6 mb-6 md:mb-8">
            <div class="space-y-2">
              <div class="font-label-caps text-label-caps uppercase tracking-[0.2em] text-primary">${String(i + 1).padStart(2, '0')} — Shop by category</div>
              <h2 class="font-headline-lg-mobile text-headline-lg-mobile md:font-headline-lg md:text-headline-lg text-noir-text">The ${esc(c.name)} Edit</h2>
              <p class="font-body-sm text-body-sm text-secondary">${items.length} piece${items.length === 1 ? '' : 's'} · swipe to explore</p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <a class="hidden sm:inline-flex items-center gap-1.5 mr-3 font-label-caps text-label-caps uppercase tracking-widest text-noir-text hover:text-primary transition-colors" href="lookbook.html?category=${encodeURIComponent(c.slug)}">View all <span class="material-symbols-outlined text-[16px]" aria-hidden="true">arrow_forward</span></a>
              <button type="button" class="rail-btn hidden md:inline-flex" data-dir="prev" aria-label="Previous ${esc(c.name)} pieces"><span class="material-symbols-outlined" aria-hidden="true">west</span></button>
              <button type="button" class="rail-btn hidden md:inline-flex" data-dir="next" aria-label="More ${esc(c.name)} pieces"><span class="material-symbols-outlined" aria-hidden="true">east</span></button>
            </div>
          </div>
          <div class="eema-rail" role="list" aria-label="${esc(c.name)} pieces"></div>
          <a class="sm:hidden mt-5 inline-flex items-center gap-1.5 font-label-caps text-label-caps uppercase tracking-widest text-noir-text" href="lookbook.html?category=${encodeURIComponent(c.slug)}">View all ${esc(c.name)} <span class="material-symbols-outlined text-[16px]" aria-hidden="true">arrow_forward</span></a>
        </div>`).join('');
      rows.forEach(({ c, items }) => {
        const block = box.querySelector(`[data-rail="${CSS.escape(c.slug)}"]`);
        const rail = block.querySelector('.eema-rail');
        mount(rail, items, { swipe: false });
        rail.querySelectorAll('.fashion-card').forEach((el) => el.setAttribute('role', 'listitem'));
        wireRail(rail, block.querySelector('[data-dir="prev"]'), block.querySelector('[data-dir="next"]'));
      });
      box.hidden = false;
    } catch (err) {
      console.error('[EEMA] Could not load category rows:', err);
      box.hidden = true;
    }
  }

  async function initCategoryLinks(selector) {
    const box = document.querySelector(selector);
    if (!box) return;
    try {
      const categories = await fetchCategories();
      if (!categories.length) return;
      const cls = box.getAttribute('data-link-class') || '';
      box.innerHTML = `<a class="${esc(cls)}" href="lookbook.html">All Collections</a>` +
        categories.map((c) => `<a class="${esc(cls)}" href="lookbook.html?category=${encodeURIComponent(c.slug)}">${esc(c.name)}</a>`).join('');
    } catch (err) {
      console.warn('[EEMA] Category links kept as static fallback:', err);
    }
  }

  window.EEMA = { WA_ICON, observeReveal, isOutOfStock, whatsappUrl, wireRail, initCategoryRails, esc, formatPrice, tagLabel, safeHex, productUrl, fetchProductBySlug, renderSkeletons, mount, fetchCategories, fetchProducts, renderProductCard, initLookbook, initFeatured, initCategoryLinks, resetFilters, applyFilters, setSearch };
  window.resetFilters = resetFilters; // used by the lookbook "Reset" button
})();
