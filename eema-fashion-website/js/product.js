// EEMA Fashion — product detail page (product.html?p=<slug>).
// Requires: supabase-js CDN → supabase-config.js → supabase-client.js → catalog.js → this file.
(function () {
  const cfg = window.EEMA_CONFIG || {};
  const { esc, formatPrice, tagLabel, safeHex, WA_ICON } = window.EEMA;
  const isOut = (p) => window.EEMA.isOutOfStock(p);
  const $ = (sel, root = document) => root.querySelector(sel);

  const ADULT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
  const state = { product: null, image: 0, color: null, size: null };

  // ---------- copy blocks (wording taken from our-story.html ordering info) ----------

  function careText(p) {
    const fabric = `${p.fabric || ''} ${(p.tags || []).join(' ')}`.toLowerCase();
    if (fabric.includes('batik')) {
      return 'Hand wash cold and separately with a mild detergent. Dry in shade to protect the hand-dyed colours, and warm iron on the reverse. Small variations in the wax-resist pattern are part of each piece\'s character.';
    }
    return 'Gentle hand wash or cool delicate cycle. Line dry in shade and warm iron while slightly damp. Pure linen softens beautifully with every wash.';
  }

  const ICON = (name, cls = '') => `<span class="material-symbols-outlined ${cls}">${name}</span>`;

  // ---------- render ----------

  function galleryHtml(p) {
    const images = (p.images || []).length ? p.images : [null];
    const slides = images.map((src, i) => `
      <button type="button" class="pd-slide relative shrink-0 w-full snap-center aspect-[3/4] bg-linen-elevated overflow-hidden cursor-zoom-in" data-index="${i}" aria-label="Open image ${i + 1} full screen">
        ${src ? `<img src="${esc(src)}" alt="${esc(p.name)}${images.length > 1 ? ` — view ${i + 1}` : ''}" class="w-full h-full object-cover" ${isOut(p) ? 'style="filter:saturate(.4)"' : ''} ${i === 0 ? 'fetchpriority="high"' : 'loading="lazy"'}>`
              : `<span class="absolute inset-0 flex items-center justify-center text-secondary/40">${ICON('checkroom', 'text-[56px]')}</span>`}
      </button>`).join('');
    const thumbs = images.length > 1 ? images.map((src, i) => `
      <button type="button" class="pd-thumb shrink-0 w-16 lg:w-20 aspect-[3/4] bg-linen-elevated overflow-hidden border border-transparent transition-all opacity-60 hover:opacity-100" data-index="${i}" aria-label="Show image ${i + 1}">
        <img src="${esc(src)}" alt="" loading="lazy" class="w-full h-full object-cover">
      </button>`).join('') : '';
    const multi = images.length > 1;
    return `
      <div class="flex flex-col-reverse lg:flex-row gap-3 lg:gap-4">
        ${multi ? `<div class="flex lg:flex-col gap-2 lg:gap-3 overflow-x-auto lg:overflow-visible scrollbar-none" role="tablist" aria-label="Product images">${thumbs}</div>` : ''}
        <div class="relative flex-1 min-w-0 group">
          <div id="pd-track" class="flex overflow-x-auto snap-x snap-mandatory scrollbar-none scroll-smooth">${slides}</div>
          ${isOut(p) ? `<span class="absolute top-4 left-4 bg-noir-text/90 text-surface-container-lowest px-3.5 py-2 font-label-caps text-label-caps uppercase tracking-[0.2em] pointer-events-none">Out of stock</span>` : ''}
          ${multi ? `
          <button type="button" data-step="-1" aria-label="Previous image" class="pd-arrow hidden lg:flex absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 items-center justify-center bg-surface-container-lowest/90 backdrop-blur-sm text-noir-text opacity-0 group-hover:opacity-100 transition-opacity hover:text-primary">${ICON('west')}</button>
          <button type="button" data-step="1" aria-label="Next image" class="pd-arrow hidden lg:flex absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 items-center justify-center bg-surface-container-lowest/90 backdrop-blur-sm text-noir-text opacity-0 group-hover:opacity-100 transition-opacity hover:text-primary">${ICON('east')}</button>
          <span id="pd-counter" class="absolute bottom-4 left-4 bg-surface-container-lowest/90 backdrop-blur-sm px-2.5 py-1 font-label-caps text-[10px] uppercase tracking-widest text-noir-text">1 / ${images.length}</span>` : ''}
          <span class="absolute bottom-4 right-4 hidden lg:flex items-center gap-1.5 bg-surface-container-lowest/90 backdrop-blur-sm px-2.5 py-1 font-label-caps text-[10px] uppercase tracking-widest text-noir-text pointer-events-none">${ICON('zoom_in', 'text-[14px]')}Click to enlarge</span>
        </div>
      </div>`;
  }

  function colorsHtml(p) {
    const colors = Array.isArray(p.colors) ? p.colors : [];
    if (!colors.length) return '';
    return `
      <div class="space-y-3">
        <div class="flex items-baseline gap-2">
          <span class="font-label-caps text-label-caps uppercase tracking-widest text-noir-text">Colour</span>
          <span class="font-body-sm text-body-sm text-secondary" id="pd-color-name">${esc(colors[0].name)}</span>
        </div>
        <div class="flex flex-wrap gap-3" role="radiogroup" aria-label="Colour">
          ${colors.map((c, i) => `
            <button type="button" role="radio" data-color="${esc(c.name)}" aria-checked="${i === 0}" title="${esc(c.name)}"
              class="pd-swatch w-9 h-9 rounded-full ring-1 ring-noir-text/15 ring-offset-2 ring-offset-surface transition-all hover:scale-105"
              style="background:${safeHex(c.hex)}"><span class="sr-only">${esc(c.name)}</span></button>`).join('')}
        </div>
      </div>`;
  }

  function sizesHtml(p) {
    const sizes = Array.isArray(p.sizes) ? p.sizes : [];
    const hasAdult = sizes.some((s) => ADULT_SIZES.includes(s));
    if (!sizes.length) {
      return `
        <div class="flex gap-3 items-start bg-linen-elevated p-4">
          ${ICON('straighten', 'text-primary text-[20px] mt-0.5')}
          <div>
            <div class="font-label-caps text-label-caps uppercase tracking-widest text-noir-text">Made to your measurements</div>
            <p class="font-body-sm text-body-sm text-secondary mt-1">Share your measurements with our stylist and this piece will be cut and tailored to fit you. <a href="atelier.html" class="text-primary underline underline-offset-2">How to measure</a></p>
          </div>
        </div>`;
    }
    return `
      <div class="space-y-3" id="pd-size-block">
        <div class="flex items-baseline justify-between gap-2">
          <div class="flex items-baseline gap-2">
            <span class="font-label-caps text-label-caps uppercase tracking-widest text-noir-text">Size</span>
            <span class="font-body-sm text-body-sm text-secondary" id="pd-size-name">Select a size</span>
          </div>
          ${hasAdult ? `<button type="button" id="pd-open-size-guide" class="inline-flex items-center gap-1 font-body-sm text-body-sm text-noir-text underline underline-offset-4 decoration-linen-stone hover:decoration-noir-text">${ICON('straighten', 'text-[16px]')}Size guide</button>` : ''}
        </div>
        <div class="flex flex-wrap gap-2" role="radiogroup" aria-label="Size">
          ${sizes.map((s) => `<button type="button" role="radio" aria-checked="false" data-size="${esc(s)}" class="pd-size min-w-[52px] h-11 px-3 border border-linen-stone bg-surface-container-lowest font-body-sm text-body-md text-noir-text transition-colors hover:border-noir-text">${esc(s)}</button>`).join('')}
          <button type="button" role="radio" aria-checked="false" data-size="Custom fit" class="pd-size h-11 px-4 border border-dashed border-primary-container/50 bg-berry-soft/40 font-body-sm text-body-sm text-berry-deep transition-colors hover:border-primary-container inline-flex items-center gap-1.5">${ICON('design_services', 'text-[16px]')}Custom fit</button>
        </div>
        <p id="pd-size-error" class="font-body-sm text-body-sm text-error" hidden>Please choose a size, or select Custom fit.</p>
      </div>`;
  }

  function accordion(title, body, open = false) {
    return `
      <details class="pd-acc group border-b border-linen-stone" ${open ? 'open' : ''}>
        <summary class="flex items-center justify-between py-4 cursor-pointer list-none select-none">
          <span class="font-label-caps text-label-caps uppercase tracking-widest text-noir-text">${title}</span>
          <span class="material-symbols-outlined text-[20px] text-secondary transition-transform duration-300 group-open:rotate-45">add</span>
        </summary>
        <div class="pb-5 font-body-md text-body-md text-secondary space-y-2">${body}</div>
      </details>`;
  }

  function infoHtml(p) {
    const cat = p.category;
    const eyebrow = [
      cat ? `<a href="lookbook.html?category=${encodeURIComponent(cat.slug)}" class="hover:text-noir-text transition-colors">${esc(cat.name)}</a>` : '',
      ...(p.tags || []).filter((t) => t !== 'tailored').slice(0, 2).map((t) => `<span>${esc(tagLabel(t))}</span>`)
    ].filter(Boolean).join('<span class="text-linen-stone">/</span>');

    const description = p.description
      ? `<p>${esc(p.description)}</p>`
      : `<p>${esc(p.short_note || 'A considered piece from our Colombo atelier.')}</p>`;
    const details = [
      p.fabric && `<li><span class="text-noir-text">Fabric:</span> ${esc(p.fabric)}</li>`,
      (p.colors || []).length && `<li><span class="text-noir-text">Available in:</span> ${esc(p.colors.map((c) => c.name).join(', '))}</li>`,
      (p.sizes || []).length && `<li><span class="text-noir-text">Sizes:</span> ${esc(p.sizes.join(', '))} &middot; or made to measure</li>`
    ].filter(Boolean).join('');

    return `
      <div class="lg:sticky lg:top-28 space-y-7">
        <div class="space-y-3">
          ${eyebrow ? `<div class="flex flex-wrap items-center gap-2 font-label-caps text-label-caps uppercase tracking-widest text-primary">${eyebrow}</div>` : ''}
          <h1 class="font-headline-lg-mobile text-headline-lg-mobile md:font-headline-lg md:text-headline-lg text-noir-text">${esc(p.name)}</h1>
          <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span class="font-price-numeral text-[20px] leading-7 tracking-wide ${isOut(p) ? 'text-secondary' : 'text-noir-text'}">${formatPrice(p.price)}</span>
            ${isOut(p)
              ? '<span class="inline-flex items-center gap-1.5 bg-berry-soft text-berry-deep px-2.5 py-1 font-label-caps text-label-caps uppercase tracking-widest"><span class="w-1.5 h-1.5 rounded-full bg-berry-deep"></span>Out of stock</span>'
              : '<span class="inline-flex items-center gap-1.5 font-body-sm text-body-sm text-secondary"><span class="w-1.5 h-1.5 rounded-full bg-whatsapp-forest"></span>In stock · Tailored to order in Colombo</span>'}
          </div>
          ${isOut(p) ? `<div class="flex gap-3 items-start border border-primary-container/25 bg-berry-soft/50 p-4">
            ${ICON('inventory_2', 'text-primary text-[20px] mt-0.5')}
            <p class="font-body-sm text-body-sm text-charcoal-body">This piece is <strong class="font-medium text-noir-text">currently out of stock</strong>. Message us and we'll let you know as soon as it's back, or ask about having one made to your measurements.</p>
          </div>` : ''}
          ${p.short_note ? `<p class="font-body-lg text-body-lg text-secondary">${esc(p.short_note)}</p>` : ''}
        </div>

        <div class="h-px bg-linen-stone"></div>

        ${colorsHtml(p)}
        ${sizesHtml(p)}

        <div class="space-y-2.5" id="pd-cta">
          <a id="pd-whatsapp" href="#" target="_blank" rel="noopener noreferrer" class="w-full py-4 bg-noir-text hover:bg-whatsapp-forest text-surface-container-lowest font-label-caps text-label-caps uppercase tracking-widest flex items-center justify-center gap-2.5 transition-colors">
            ${WA_ICON}
            ${isOut(p) ? 'Ask about restock' : 'Inquire on WhatsApp'}
          </a>
          <div class="grid grid-cols-2 gap-2.5">
            <a href="${esc(cfg.FACEBOOK_URL)}" target="_blank" rel="noopener noreferrer" class="py-3 border border-linen-stone hover:border-noir-text text-noir-text font-label-caps text-label-caps uppercase tracking-widest flex items-center justify-center gap-2 transition-colors">Facebook</a>
            <button type="button" id="pd-share" class="py-3 border border-linen-stone hover:border-noir-text text-noir-text font-label-caps text-label-caps uppercase tracking-widest flex items-center justify-center gap-2 transition-colors">${ICON('ios_share', 'text-[16px]')}<span>Share</span></button>
          </div>
        </div>

        <ul class="grid grid-cols-3 gap-3 text-center">
          <li class="flex flex-col items-center gap-1.5 bg-surface-container-low px-2 py-3">${ICON('verified', 'text-whatsapp-forest text-[20px]')}<span class="font-body-sm text-[11px] leading-4 text-secondary">Hand-finished in Colombo</span></li>
          <li class="flex flex-col items-center gap-1.5 bg-surface-container-low px-2 py-3">${ICON('local_shipping', 'text-whatsapp-forest text-[20px]')}<span class="font-body-sm text-[11px] leading-4 text-secondary">Islandwide &amp; worldwide</span></li>
          <li class="flex flex-col items-center gap-1.5 bg-surface-container-low px-2 py-3">${ICON('schedule', 'text-whatsapp-forest text-[20px]')}<span class="font-body-sm text-[11px] leading-4 text-secondary">Stylist replies within 15 mins</span></li>
        </ul>

        <div class="border-t border-linen-stone">
          ${accordion('Description', description + (details ? `<ul class="space-y-1 pt-2">${details}</ul>` : ''), true)}
          ${accordion('Fabric &amp; Care', `<p>${esc(careText(p))}</p>`)}
          ${accordion('Fit &amp; Tailoring', `<p>Choose a standard size, or select <strong class="text-noir-text font-medium">Custom fit</strong> and our master cutter will tailor the piece to your bust, waist, hip and length measurements.</p><p>Bespoke pieces include complimentary alterations. <a href="atelier.html" class="text-primary underline underline-offset-2">Visit the Custom Atelier</a></p>`)}
          ${accordion('Delivery &amp; Exchanges', `<p><span class="text-noir-text">Islandwide Sri Lanka:</span> dispatched by courier in 2–4 business days, complimentary on orders over Rs 10,000.</p><p><span class="text-noir-text">Worldwide:</span> express air freight in 7–10 business days.</p><p>Ready-to-wear pieces can be exchanged for another size within 7 days if unworn. Bank transfer and cash on delivery accepted. <a href="returns.html" class="text-primary underline underline-offset-2">Returns &amp; exchanges</a> · <a href="our-story.html#how-to-order" class="text-primary underline underline-offset-2">Ordering details</a></p>`)}
        </div>
      </div>`;
  }

  // ---------- behaviour ----------

  function whatsappHref() {
    const p = state.product;
    const lines = [isOut(p)
      ? `Hello EEMA Fashion, the *${p.name}* is showing as out of stock. Please let me know when it's available again.`
      : `Hello EEMA Fashion, I would like to order the *${p.name}*.`];
    if (state.color) lines.push(`• Colour: ${state.color}`);
    if (state.size) lines.push(`• Size: ${state.size}${state.size === 'Custom fit' ? ' (I will share my measurements)' : ''}`);
    lines.push(`• Price: ${formatPrice(p.price)}`);
    lines.push('', location.href);
    return `https://wa.me/${cfg.WHATSAPP_NUMBER}?text=${encodeURIComponent(lines.join('\n'))}`;
  }

  function refreshCta() {
    const href = whatsappHref();
    const main = $('#pd-whatsapp');
    const sticky = $('#pd-sticky-whatsapp');
    if (main) main.href = href;
    if (sticky) sticky.href = href;
  }

  function needsSize() {
    return !isOut(state.product) && (state.product.sizes || []).length > 0 && !state.size;
  }

  function guardSize(e) {
    if (!needsSize()) return;
    e.preventDefault();
    const err = $('#pd-size-error');
    if (err) err.hidden = false;
    const block = $('#pd-size-block');
    if (block) {
      block.scrollIntoView({ behavior: 'smooth', block: 'center' });
      block.classList.add('pd-shake');
      setTimeout(() => block.classList.remove('pd-shake'), 500);
    }
  }

  function goToImage(i, { smooth = true } = {}) {
    const track = $('#pd-track');
    const count = track.children.length;
    state.image = (i + count) % count;
    track.scrollTo({ left: track.clientWidth * state.image, behavior: smooth ? 'smooth' : 'auto' });
    updateGalleryUi();
  }

  function updateGalleryUi() {
    const count = $('#pd-track').children.length;
    document.querySelectorAll('.pd-thumb').forEach((t, i) => {
      const on = i === state.image;
      t.classList.toggle('opacity-60', !on);
      t.classList.toggle('border-noir-text', on);
      t.setAttribute('aria-selected', String(on));
    });
    const counter = $('#pd-counter');
    if (counter) counter.textContent = `${state.image + 1} / ${count}`;
  }

  function bindGallery() {
    const track = $('#pd-track');
    let raf;
    track.addEventListener('scroll', () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const i = Math.round(track.scrollLeft / track.clientWidth);
        if (i !== state.image) { state.image = i; updateGalleryUi(); }
      });
    }, { passive: true });
    document.querySelectorAll('.pd-thumb').forEach((t) => t.addEventListener('click', () => goToImage(+t.dataset.index)));
    document.querySelectorAll('.pd-arrow').forEach((b) => b.addEventListener('click', () => goToImage(state.image + +b.dataset.step)));
    track.addEventListener('click', (e) => {
      const slide = e.target.closest('.pd-slide');
      if (slide && (state.product.images || []).length) openLightbox(+slide.dataset.index);
    });
    updateGalleryUi();
  }

  // Lightbox
  let lbIndex = 0;
  function openLightbox(i) {
    lbIndex = i;
    renderLightbox();
    $('#pd-lightbox').hidden = false;
    document.body.style.overflow = 'hidden';
    $('#pd-lb-close').focus();
  }
  function closeLightbox() {
    $('#pd-lightbox').hidden = true;
    document.body.style.overflow = '';
  }
  function renderLightbox() {
    const imgs = state.product.images || [];
    lbIndex = (lbIndex + imgs.length) % imgs.length;
    $('#pd-lb-img').src = imgs[lbIndex];
    $('#pd-lb-img').alt = state.product.name;
    $('#pd-lb-count').textContent = `${lbIndex + 1} / ${imgs.length}`;
    document.querySelectorAll('.pd-lb-nav').forEach((b) => { b.hidden = imgs.length < 2; });
  }
  function bindLightbox() {
    $('#pd-lb-close').addEventListener('click', closeLightbox);
    $('#pd-lightbox').addEventListener('click', (e) => {
      const nav = e.target.closest('.pd-lb-nav');
      if (nav) { lbIndex += +nav.dataset.step; renderLightbox(); return; }
      if (e.target.id === 'pd-lightbox' || e.target.id === 'pd-lb-stage') closeLightbox();
    });
    document.addEventListener('keydown', (e) => {
      if ($('#pd-lightbox').hidden) {
        if (e.key === 'Escape') closeSizeGuide();
        return;
      }
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowRight') { lbIndex++; renderLightbox(); }
      if (e.key === 'ArrowLeft') { lbIndex--; renderLightbox(); }
    });
  }

  function openSizeGuide() { $('#pd-size-guide').hidden = false; document.body.style.overflow = 'hidden'; }
  function closeSizeGuide() { const g = $('#pd-size-guide'); if (g && !g.hidden) { g.hidden = true; document.body.style.overflow = ''; } }

  function bindOptions() {
    document.querySelectorAll('.pd-swatch').forEach((b) => b.addEventListener('click', () => {
      state.color = b.dataset.color;
      document.querySelectorAll('.pd-swatch').forEach((x) => {
        const on = x === b;
        x.setAttribute('aria-checked', String(on));
        x.classList.toggle('ring-2', on);
        x.classList.toggle('ring-noir-text', on);
        x.classList.toggle('ring-1', !on);
        x.classList.toggle('ring-noir-text/15', !on);
      });
      $('#pd-color-name').textContent = state.color;
      refreshCta();
    }));
    const first = document.querySelector('.pd-swatch');
    if (first) first.click();

    document.querySelectorAll('.pd-size').forEach((b) => b.addEventListener('click', () => {
      state.size = b.dataset.size;
      document.querySelectorAll('.pd-size').forEach((x) => {
        const on = x === b;
        x.setAttribute('aria-checked', String(on));
        if (x.dataset.size === 'Custom fit') {
          x.classList.toggle('!bg-berry-deep', on);
          x.classList.toggle('!text-surface-container-lowest', on);
          x.classList.toggle('!border-berry-deep', on);
        } else {
          x.classList.toggle('!bg-noir-text', on);
          x.classList.toggle('!text-surface-container-lowest', on);
          x.classList.toggle('!border-noir-text', on);
        }
      });
      $('#pd-size-name').textContent = state.size === 'Custom fit' ? 'Tailored to your measurements' : state.size;
      const err = $('#pd-size-error');
      if (err) err.hidden = true;
      refreshCta();
    }));

    $('#pd-whatsapp').addEventListener('click', guardSize);
    $('#pd-sticky-whatsapp').addEventListener('click', guardSize);

    const sg = $('#pd-open-size-guide');
    if (sg) sg.addEventListener('click', openSizeGuide);
    $('#pd-size-guide').addEventListener('click', (e) => {
      if (e.target.closest('[data-close-guide]') || e.target.id === 'pd-size-guide') closeSizeGuide();
    });

    $('#pd-share').addEventListener('click', async () => {
      const data = { title: `${state.product.name} | EEMA Fashion`, url: location.href };
      const label = $('#pd-share span:last-child');
      try {
        if (navigator.share) { await navigator.share(data); return; }
        await navigator.clipboard.writeText(location.href);
        label.textContent = 'Link copied';
      } catch {
        label.textContent = 'Copy failed';
      }
      setTimeout(() => { label.textContent = 'Share'; }, 2000);
    });
  }

  function bindStickyBar() {
    const bar = $('#pd-sticky');
    const cta = $('#pd-cta');
    if (!bar || !cta || !('IntersectionObserver' in window)) return;
    new IntersectionObserver(([entry]) => {
      const show = !entry.isIntersecting && entry.boundingClientRect.top < 0;
      bar.classList.toggle('translate-y-full', !show);
      bar.setAttribute('aria-hidden', String(!show));
    }).observe(cta);
  }

  function setMeta(p) {
    document.title = `${p.name} | EEMA Fashion`;
    const desc = [p.short_note, p.description].filter(Boolean).join(' — ') || `${p.name} by EEMA Fashion, Colombo.`;
    const setTag = (attr, key, val) => {
      let m = document.head.querySelector(`meta[${attr}="${key}"]`);
      if (!m) { m = document.createElement('meta'); m.setAttribute(attr, key); document.head.appendChild(m); }
      m.setAttribute('content', val);
    };
    setTag('name', 'description', desc.slice(0, 160));
    setTag('property', 'og:title', p.name);
    setTag('property', 'og:description', desc.slice(0, 200));
    if ((p.images || [])[0]) setTag('property', 'og:image', p.images[0]);

    const ld = document.createElement('script');
    ld.type = 'application/ld+json';
    ld.textContent = JSON.stringify({
      '@context': 'https://schema.org', '@type': 'Product', name: p.name, description: desc,
      image: p.images || [], brand: { '@type': 'Brand', name: 'EEMA Fashion' },
      offers: { '@type': 'Offer', priceCurrency: 'LKR', price: p.price, availability: isOut(p) ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock', url: location.href }
    });
    document.head.appendChild(ld);
  }

  async function loadRelated(p) {
    const section = $('#pd-related');
    const grid = $('#pd-related-grid');
    grid.innerHTML = EEMA.renderSkeletons(4);
    section.hidden = false;
    try {
      let items = (await EEMA.fetchProducts({ categoryId: p.category_id, limit: 9 })).filter((x) => x.id !== p.id);
      if (items.length < 4) {
        const more = (await EEMA.fetchProducts({ limit: 12 })).filter((x) => x.id !== p.id && !items.some((y) => y.id === x.id));
        items = items.concat(more);
      }
      items = items.slice(0, 4);
      if (!items.length) { section.hidden = true; return; }
      grid.classList.add('eema-rail-mobile');
      EEMA.mount(grid, items, { swipe: false });
    } catch (err) {
      console.warn('[EEMA] Related products unavailable:', err);
      section.hidden = true;
    }
  }

  function showNotFound() {
    $('#pd-root').innerHTML = `
      <div class="max-w-lg mx-auto text-center py-24 space-y-4">
        ${ICON('checkroom', 'text-primary text-[40px]')}
        <h1 class="font-headline-md text-headline-md text-noir-text">This piece isn't available</h1>
        <p class="font-body-md text-body-md text-secondary">It may have sold out or been retired from the collection. Explore the current lookbook, or ask our stylist about something similar.</p>
        <div class="flex flex-wrap justify-center gap-3 pt-2">
          <a href="lookbook.html" class="px-6 py-3 bg-noir-text hover:bg-primary text-surface-container-lowest font-label-caps text-label-caps uppercase tracking-widest transition-colors">Browse the lookbook</a>
          <a href="https://wa.me/${esc(cfg.WHATSAPP_NUMBER)}" target="_blank" rel="noopener noreferrer" class="px-6 py-3 border border-noir-text text-noir-text font-label-caps text-label-caps uppercase tracking-widest hover:bg-noir-text hover:text-surface-container-lowest transition-colors">Ask our stylist</a>
        </div>
      </div>`;
    $('#pd-breadcrumb-current').textContent = 'Not found';
    document.title = 'Piece not found | EEMA Fashion';
  }

  async function init() {
    const slug = new URLSearchParams(location.search).get('p');
    if (!slug) { showNotFound(); return; }
    let p;
    try {
      p = await EEMA.fetchProductBySlug(slug);
    } catch (err) {
      console.error('[EEMA] Could not load product:', err);
      $('#pd-root').innerHTML = `<div class="text-center py-24 space-y-3"><h1 class="font-headline-md text-headline-md">We couldn't load this piece</h1><p class="text-secondary">Please refresh the page, or message our stylist on WhatsApp.</p></div>`;
      return;
    }
    if (!p) { showNotFound(); return; }
    state.product = p;

    // Breadcrumb
    if (p.category) {
      const crumbCat = $('#pd-breadcrumb-cat');
      crumbCat.textContent = p.category.name;
      crumbCat.href = `lookbook.html?category=${encodeURIComponent(p.category.slug)}`;
      crumbCat.parentElement.hidden = false;
    }
    $('#pd-breadcrumb-current').textContent = p.name;

    $('#pd-root').innerHTML = `
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 xl:gap-20">
        <div class="lg:col-span-7">${galleryHtml(p)}</div>
        <div class="lg:col-span-5">${infoHtml(p)}</div>
      </div>`;

    // Sticky mobile bar
    $('#pd-sticky-name').textContent = p.name;
    $('#pd-sticky-price').textContent = formatPrice(p.price) + (isOut(p) ? ' · Out of stock' : '');
    if (isOut(p)) $('#pd-sticky-whatsapp').textContent = 'Ask about restock';

    bindGallery();
    bindLightbox();
    bindOptions();
    bindStickyBar();
    refreshCta();
    setMeta(p);
    loadRelated(p);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
