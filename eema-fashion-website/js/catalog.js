// EEMA Fashion — public product catalog (reads from Supabase).
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

  function whatsappUrl(product) {
    const color = (product.colors && product.colors[0] && product.colors[0].name) || '';
    const msg = `Hello EEMA Fashion, I would like to order the ${product.name}${color ? ' in ' + color : ''} (${formatPrice(product.price)})`;
    return `https://wa.me/${cfg.WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
  }

  function productUrl(p) {
    return 'product.html?p=' + encodeURIComponent(p.slug);
  }

  // ---------- data ----------

  const PRODUCT_FIELDS = 'id,name,slug,short_note,description,price,tags,fabric,colors,sizes,images,is_featured,category_id,category:categories(id,name,slug)';

  // Runs a products query; if the `sizes` column hasn't been added yet
  // (supabase/migrations/002_product_sizes.sql not run), retries without it.
  async function queryProducts(build) {
    let res = await build(PRODUCT_FIELDS);
    if (res.error && /sizes/i.test(res.error.message || '')) {
      res = await build(PRODUCT_FIELDS.replace(',sizes', ''));
    }
    if (res.error) throw res.error;
    return res.data;
  }

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
    return data || [];
  }

  // ---------- rendering ----------

  function renderProductCard(p) {
    const images = p.images || [];
    const colors = Array.isArray(p.colors) ? p.colors : [];
    const cover = images[0];
    const alt = images[1];
    const catSlug = (p.category && p.category.slug) || '';
    const href = esc(productUrl(p));

    const media = cover
      ? `<img alt="${esc(p.name)}" loading="lazy" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" src="${esc(cover)}">` +
        (alt ? `<img alt="" aria-hidden="true" loading="lazy" class="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-700" src="${esc(alt)}">` : '')
      : `<div class="w-full h-full flex items-center justify-center text-secondary/50"><span class="material-symbols-outlined text-[40px]">checkroom</span></div>`;

    const swatches = colors.length
      ? `<div class="mt-3 flex items-center gap-2">${colors.slice(0, 5).map((c) =>
          `<span class="w-3 h-3 rounded-full inline-block ring-1 ring-noir-text/20" style="background:${safeHex(c.hex)}" title="${esc(c.name)}"></span>`).join('')}
          <span class="font-body-sm text-[11px] text-secondary ml-1">${colors.length} Shade${colors.length === 1 ? '' : 's'}</span></div>`
      : '';

    return `
<article class="fashion-card group flex flex-col bg-surface-container-lowest transition-all hover:-translate-y-1 hover:shadow-md"
  data-id="${esc(p.id)}" data-category-slug="${esc(catSlug)}" data-tags="${esc((p.tags || []).join(' '))}"
  data-colors="${esc(colors.map((c) => c.name).join('|'))}"
  data-search="${esc([p.name, p.short_note, p.fabric, (p.tags || []).join(' '), p.category && p.category.name].join(' ').toLowerCase())}">
  <div class="relative w-full aspect-[3/4] overflow-hidden bg-linen-elevated">
    <a href="${href}" class="block w-full h-full" aria-label="View ${esc(p.name)}">${media}</a>
    ${p.category ? `<span class="absolute top-3 left-3 bg-surface-container-lowest/90 backdrop-blur-sm px-2 py-1 font-label-caps text-[10px] uppercase tracking-widest text-noir-text">${esc(p.category.name)}</span>` : ''}
    ${typeof window.quickPreview === 'function' ? `<button type="button" aria-label="Quick view ${esc(p.name)}" data-quick-view="${esc(p.id)}" class="absolute bottom-3 right-3 bg-surface-container-lowest/90 backdrop-blur-sm p-2 text-noir-text hover:text-primary transition-colors shadow-sm"><span class="material-symbols-outlined text-[18px]">visibility</span></button>` : ''}
  </div>
  <div class="p-5 flex flex-col flex-1 justify-between gap-4">
    <div>
      <div class="flex items-start justify-between gap-2">
        <h3 class="font-headline-sm text-headline-sm text-noir-text font-normal group-hover:text-primary transition-colors"><a href="${href}">${esc(p.name)}</a></h3>
        <span class="font-price-numeral text-price-numeral text-noir-text whitespace-nowrap">${formatPrice(p.price)}</span>
      </div>
      ${p.short_note ? `<p class="font-body-sm text-body-sm text-secondary mt-1">${esc(p.short_note)}</p>` : ''}
      ${swatches}
    </div>
    <div class="flex flex-col gap-2 pt-3">
      <a class="w-full py-2.5 bg-noir-text hover:bg-whatsapp-forest text-surface-container-lowest font-label-caps text-label-caps uppercase tracking-widest text-center flex items-center justify-center gap-2 transition-colors" href="${esc(whatsappUrl(p))}" rel="noopener noreferrer" target="_blank">${WA_ICON}<span>Inquire on WhatsApp</span></a>
      <a class="w-full py-2 bg-surface-container-high hover:bg-surface-variant text-noir-text font-label-caps text-label-caps uppercase tracking-widest text-center flex items-center justify-center gap-2 transition-colors" href="${esc(cfg.FACEBOOK_URL)}" rel="noopener noreferrer" target="_blank">${FB_ICON}<span>Message on Facebook</span></a>
    </div>
  </div>
</article>`;
  }

  function renderSkeletons(n) {
    return Array.from({ length: n }, () => `
<div class="flex flex-col bg-surface-container-lowest animate-pulse" aria-hidden="true">
  <div class="w-full aspect-[3/4] bg-linen-elevated"></div>
  <div class="p-5 space-y-3"><div class="h-5 w-3/4 bg-linen-stone"></div><div class="h-3 w-1/2 bg-linen-elevated"></div><div class="h-9 w-full bg-linen-elevated mt-6"></div></div>
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
    window.quickPreview(p.name, formatPrice(p.price), color, p.description || p.fabric || '', (p.images || [])[0] || '');

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

  function mount(grid, products) {
    products.forEach((p) => productIndex.set(p.id, p));
    grid.innerHTML = products.map(renderProductCard).join('');
  }

  // ---------- lookbook page ----------

  const CHIP_BASE = 'px-2.5 py-1 text-body-sm border whitespace-nowrap transition-colors';
  const CHIP_ON = 'bg-noir-text text-surface-container-lowest border-noir-text';
  const CHIP_OFF = 'bg-transparent text-secondary border-stone-200/70 hover:text-noir-text';
  const TAB_ON = 'border-noir-text text-noir-text font-medium';
  const TAB_OFF = 'border-transparent text-secondary hover:text-noir-text';

  const state = { category: 'all', tag: 'all', color: 'all', search: '' };

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
    history.replaceState(null, '', url);
  }

  function buttonsHtml(items, base, off) {
    return items.map(([value, label]) =>
      `<button type="button" data-value="${esc(value)}" class="${base} ${off}">${esc(label)}</button>`).join('');
  }

  async function initLookbook() {
    const grid = document.getElementById('product-grid');
    if (!grid) return;
    grid.innerHTML = renderSkeletons(8);

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
          const v = `${p.name} (${formatPrice(p.price)})`;
          return `<option value="${esc(v)}">${esc(v)}</option>`;
        }).join('');
      }

      const params = new URL(location.href).searchParams;
      const wanted = params.get('category');
      state.search = (params.get('search') || '').trim();
      if (wanted && categories.some((c) => c.slug === wanted)) state.category = wanted;
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
    state.category = 'all'; state.tag = 'all'; state.color = 'all'; state.search = '';
    applyFilters();
  }

  // ---------- home page ----------

  async function initFeatured(selector, { limit = 4 } = {}) {
    const grid = document.querySelector(selector);
    if (!grid) return;
    grid.innerHTML = renderSkeletons(limit);
    try {
      let products = await fetchProducts({ featured: true, limit });
      if (!products.length) products = await fetchProducts({ limit }); // fall back to newest
      if (!products.length) {
        grid.innerHTML = renderMessage('New pieces arriving soon', 'Message our stylist to hear about the next collection first.');
        return;
      }
      mount(grid, products);
      const count = document.getElementById('featured-count');
      if (count) count.textContent = `${products.length} Design${products.length === 1 ? '' : 's'} Available`;
    } catch (err) {
      console.error('[EEMA] Could not load featured products:', err);
      grid.innerHTML = renderMessage('Collection temporarily unavailable', 'Please refresh, or browse the full lookbook.');
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

  window.EEMA = { WA_ICON, esc, formatPrice, tagLabel, safeHex, productUrl, fetchProductBySlug, renderSkeletons, mount, fetchCategories, fetchProducts, renderProductCard, initLookbook, initFeatured, initCategoryLinks, resetFilters, applyFilters, setSearch };
  window.resetFilters = resetFilters; // used by the lookbook "Reset" button
})();
