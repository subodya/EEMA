// EEMA Fashion — admin panel (admin.html).
// Auth: Supabase email/password + membership in the `admins` table.
// Security is enforced server-side by RLS in supabase/schema.sql; this file is only the UI.
(function () {
  const cfg = window.EEMA_CONFIG || {};
  const BUCKET = cfg.STORAGE_BUCKET || 'product-images';
  const PRESET_TAGS = ['pure-linen', 'batik', 'coords', 'dresses', 'tailored'];
  const TAG_LABELS = { 'pure-linen': 'Pure Linen', 'batik': 'Artisanal Batik', 'coords': 'Co-Ords & Sets', 'dresses': 'Dresses', 'tailored': 'Tailored' };
  const MAX_IMAGE_EDGE = 1600;
  const SIZES_ADULT = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
  const SIZES_KIDS = ['2-3Y', '4-5Y', '6-7Y', '8-9Y', '10-11Y', '12-13Y'];
  const DEFAULT_ADULT = ['XS', 'S', 'M', 'L', 'XL'];

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const state = {
    user: null,
    categories: [],
    products: [],
    // drawer
    editing: null,           // product being edited, or null for "new"
    photos: [],              // [{ id, url, uploading, isNew }]
    uploadedThisSession: [], // storage paths uploaded while the drawer was open (cleaned up on cancel)
    tags: new Set(),
    sizes: [],
    sizesTouched: false,
    categoryId: null
  };

  // ---------- small utilities ----------

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  const formatPrice = (n) => 'Rs ' + Number(n || 0).toLocaleString('en-US');
  const slugify = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'item';
  const tagLabel = (t) => TAG_LABELS[t] || t.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

  function toast(message, type = 'success') {
    const icons = { success: 'check_circle', error: 'error', info: 'info' };
    const colors = { success: 'text-whatsapp-forest', error: 'text-error', info: 'text-primary' };
    const el = document.createElement('div');
    // Toasts never block taps — they often sit over the form's Save button.
    el.className = 'toast pointer-events-none bg-white border border-linen-stone shadow-lg px-4 py-3 flex items-center gap-3 text-sm max-w-sm';
    el.innerHTML = `<span class="material-symbols-outlined ${colors[type]}">${icons[type]}</span><span>${esc(message)}</span>`;
    $('#toasts').appendChild(el);
    setTimeout(() => { el.style.transition = 'opacity .3s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, type === 'error' ? 5000 : 2800);
  }

  // True when Supabase rejects a write because a column from a later migration doesn't exist yet.
  function isMissingColumn(err, col) {
    const msg = (err && err.message) || '';
    return new RegExp('\\b' + col + '\\b').test(msg) && /column|schema cache/i.test(msg);
  }
  const MIGRATION_FOR = { sizes: '002_product_sizes.sql', in_stock: '003_product_stock.sql' };
  const isMissingSizesColumn = (err) => isMissingColumn(err, 'sizes');

  function friendlyError(err) {
    const msg = (err && (err.message || err.error_description)) || String(err);
    if (/row-level security|permission denied|not authorized/i.test(msg)) return 'You don\'t have permission to do that. Are you signed in as an admin?';
    if (isMissingSizesColumn(err)) return 'The database needs the sizes update — run supabase/migrations/002_product_sizes.sql in the Supabase SQL Editor.';
    if (isMissingColumn(err, 'in_stock')) return 'The database needs the stock update — run supabase/migrations/003_product_stock.sql in the Supabase SQL Editor.';
    if (/rate limit|too many/i.test(msg)) return 'Too many attempts. Please wait a few minutes and try again.';
    if (/Failed to fetch|NetworkError/i.test(msg)) return 'Network problem — check your connection and try again.';
    return msg;
  }

  function confirmDialog({ title, body, okLabel = 'Delete' }) {
    return new Promise((resolve) => {
      const dlg = $('#confirm');
      $('#confirm-title').textContent = title;
      $('#confirm-body').textContent = body;
      $('#confirm-ok').textContent = okLabel;
      dlg.hidden = false;
      $('#confirm-ok').focus();
      const done = (val) => {
        dlg.hidden = true;
        dlg.removeEventListener('click', onClick);
        document.removeEventListener('keydown', onKey);
        resolve(val);
      };
      const onClick = (e) => {
        if (e.target.closest('#confirm-ok')) done(true);
        else if (e.target.closest('[data-cancel]')) done(false);
      };
      const onKey = (e) => { if (e.key === 'Escape') done(false); };
      dlg.addEventListener('click', onClick);
      document.addEventListener('keydown', onKey);
    });
  }

  function setBusy(btn, busy, label) {
    if (busy) {
      btn.dataset.label = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = `<span class="material-symbols-outlined spin text-[18px]">progress_activity</span>${label ? esc(label) : ''}`;
    } else {
      btn.disabled = false;
      if (btn.dataset.label) btn.innerHTML = btn.dataset.label;
    }
  }

  function show(view) {
    ['loading', 'login', 'app'].forEach((v) => { $('#view-' + v).hidden = v !== view; });
  }

  // ---------- auth ----------
  // Sessions are kept in sessionStorage (see admin.html), so closing the tab or browser signs out.
  // On top of that, the session guard below signs out after inactivity and after a maximum age.

  const IDLE_MS = Math.max(1, Number(cfg.ADMIN_IDLE_MINUTES) || 20) * 60 * 1000;
  const MAX_MS = Math.max(1, Number(cfg.ADMIN_MAX_SESSION_HOURS) || 8) * 60 * 60 * 1000;
  const WARN_MS = Math.min(60 * 1000, IDLE_MS / 2);
  const KEY_ACTIVE = 'eema-admin-last-active';
  const KEY_LOGIN = 'eema-admin-login-at';

  const store = {
    get: (k) => { try { return Number(sessionStorage.getItem(k)) || 0; } catch { return 0; } },
    set: (k, v) => { try { sessionStorage.setItem(k, String(v)); } catch { /* ignore */ } },
    clear: () => { try { sessionStorage.removeItem(KEY_ACTIVE); sessionStorage.removeItem(KEY_LOGIN); } catch { /* ignore */ } }
  };

  // Returns a reason string if the stored session should no longer be trusted.
  function sessionExpiredReason() {
    const now = Date.now();
    const loginAt = store.get(KEY_LOGIN);
    const lastActive = store.get(KEY_ACTIVE);
    if (!loginAt) return 'Please sign in to continue.';
    if (now - loginAt >= MAX_MS) return `For security, sessions end after ${Math.round(MAX_MS / 3600000)} hours. Please sign in again.`;
    if (now - lastActive >= IDLE_MS) return `You were signed out after ${Math.round(IDLE_MS / 60000)} minutes of inactivity.`;
    return '';
  }

  const guard = { timer: null, warnTimer: null, lastWrite: 0, running: false };

  function touchActivity() {
    const now = Date.now();
    store.set(KEY_ACTIVE, now);
    guard.lastWrite = now;
  }

  function markActive() {
    if (!guard.running) return;
    if (!$('#idle-warning').hidden) hideIdleWarning();
    if (Date.now() - guard.lastWrite > 5000) touchActivity();
  }

  function showIdleWarning(msLeft) {
    const dlg = $('#idle-warning');
    const render = (ms) => { $('#idle-countdown').textContent = Math.max(0, Math.ceil(ms / 1000)); };
    render(msLeft);
    if (dlg.hidden) {
      dlg.hidden = false;
      $('#idle-stay').focus();
      clearInterval(guard.warnTimer);
      guard.warnTimer = setInterval(() => {
        const left = IDLE_MS - (Date.now() - store.get(KEY_ACTIVE));
        render(left);
        if (left <= 0) checkSession();
      }, 1000);
    }
  }
  function hideIdleWarning() {
    $('#idle-warning').hidden = true;
    clearInterval(guard.warnTimer);
  }

  function checkSession() {
    if (!guard.running) return;
    // A photo upload counts as activity so a long upload never gets cut off.
    if (state.photos.some((p) => p.uploading)) touchActivity();
    const reason = sessionExpiredReason();
    if (reason) { endSession(reason); return; }
    const idleFor = Date.now() - store.get(KEY_ACTIVE);
    if (idleFor >= IDLE_MS - WARN_MS) showIdleWarning(IDLE_MS - idleFor);
  }

  // Activity inside the warning dialog must not count, or tapping "Sign out" would reset the timer first.
  const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'input'];
  const onActivity = (e) => { if (!e.target.closest || !e.target.closest('#idle-warning')) markActive(); };
  function startGuard() {
    guard.running = true;
    ACTIVITY_EVENTS.forEach((ev) => document.addEventListener(ev, onActivity, { passive: true, capture: true }));
    clearInterval(guard.timer);
    guard.timer = setInterval(checkSession, 10000);
  }
  function stopGuard() {
    guard.running = false;
    ACTIVITY_EVENTS.forEach((ev) => document.removeEventListener(ev, onActivity, { capture: true }));
    clearInterval(guard.timer);
    hideIdleWarning();
  }
  // Tablets pause timers while asleep — re-check the moment the page is visible again.
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkSession(); });
  window.addEventListener('focus', checkSession);

  $('#idle-stay').addEventListener('click', () => { touchActivity(); hideIdleWarning(); });
  $('#idle-signout').addEventListener('click', () => endSession('You have been signed out.'));

  // Signs out this device only (scope 'local' keeps the owner's other devices signed in).
  async function endSession(notice) {
    if (!guard.running && !state.user) { showLoginNotice(notice); show('login'); return; }
    stopGuard();
    await discardOpenEdits();
    try { await sb.auth.signOut({ scope: 'local' }); } catch (e) { /* already signed out */ }
    store.clear();
    state.user = null;
    state.products = [];
    $('#product-list').innerHTML = '';
    $('#login-password').value = '';
    showLoginNotice(notice);
    show('login');
  }

  async function isAdmin(userId) {
    const { data, error } = await sb.from('admins').select('user_id').eq('user_id', userId).maybeSingle();
    if (error) throw error;
    return !!data;
  }

  async function enterWithSession(session, { fresh = false } = {}) {
    if (!session) { show('login'); return; }
    if (fresh) {
      store.set(KEY_LOGIN, Date.now());
      touchActivity();
    } else {
      const reason = sessionExpiredReason();
      if (reason) {
        try { await sb.auth.signOut({ scope: 'local' }); } catch (e) { /* ignore */ }
        store.clear();
        showLoginNotice(reason);
        show('login');
        return;
      }
    }
    try {
      if (!(await isAdmin(session.user.id))) {
        await sb.auth.signOut({ scope: 'local' });
        store.clear();
        showLoginError('This account doesn\'t have admin access.');
        show('login');
        return;
      }
    } catch (err) {
      showLoginError(friendlyError(err));
      show('login');
      return;
    }
    state.user = session.user;
    $('#user-email').textContent = session.user.email;
    showLoginNotice('');
    show('app');
    startGuard();
    await loadAll();
  }

  function showLoginError(msg) {
    const el = $('#login-error');
    el.textContent = msg;
    el.hidden = !msg;
  }
  function showLoginNotice(msg) {
    $('#login-notice-text').textContent = msg || '';
    $('#login-notice').hidden = !msg;
  }

  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!window.sb) return;
    showLoginError('');
    const email = $('#login-email').value.trim();
    const password = $('#login-password').value;
    if (!email || !password) { showLoginError('Please enter your email and password.'); return; }
    const btn = $('#login-submit');
    setBusy(btn, true, 'Signing in');
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    setBusy(btn, false);
    if (error) {
      showLoginError(/invalid/i.test(error.message) ? 'Incorrect email or password.' : friendlyError(error));
      return;
    }
    $('#login-password').value = '';
    await enterWithSession(data.session, { fresh: true });
  });

  $('#toggle-password').addEventListener('click', (e) => {
    const input = $('#login-password');
    const showing = input.type === 'text';
    input.type = showing ? 'password' : 'text';
    e.currentTarget.innerHTML = `<span class="material-symbols-outlined">${showing ? 'visibility' : 'visibility_off'}</span>`;
  });

  $('#sign-out').addEventListener('click', () => endSession('You have been signed out.'));

  // ---------- tabs ----------

  $$('.tab').forEach((tab) => tab.addEventListener('click', () => {
    const name = tab.dataset.tab;
    $$('.tab').forEach((t) => {
      const active = t === tab;
      t.classList.toggle('border-noir-text', active);
      t.classList.toggle('text-noir-text', active);
      t.classList.toggle('border-transparent', !active);
      t.classList.toggle('text-secondary', !active);
    });
    $('#panel-products').hidden = name !== 'products';
    $('#panel-categories').hidden = name !== 'categories';
  }));

  // ---------- data ----------

  async function loadAll() {
    $('#product-list').innerHTML = `<div class="py-16 flex justify-center"><span class="material-symbols-outlined spin text-secondary">progress_activity</span></div>`;
    try {
      const [cats, prods] = await Promise.all([
        sb.from('categories').select('*').order('sort_order'),
        sb.from('products').select('*').order('sort_order').order('created_at', { ascending: false })
      ]);
      if (cats.error) throw cats.error;
      if (prods.error) throw prods.error;
      state.categories = cats.data || [];
      state.products = prods.data || [];
      renderCategoryFilter();
      renderProducts();
      renderCategories();
    } catch (err) {
      $('#product-list').innerHTML = '';
      toast('Could not load data: ' + friendlyError(err), 'error');
    }
  }

  const categoryName = (id) => (state.categories.find((c) => c.id === id) || {}).name || 'Uncategorised';

  // ---------- products list ----------

  function renderCategoryFilter() {
    const sel = $('#filter-category');
    const cur = sel.value;
    sel.innerHTML = '<option value="all">All categories</option>' +
      state.categories.map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
    sel.value = state.categories.some((c) => c.id === cur) ? cur : 'all';
  }

  function renderStats() {
    const p = state.products;
    const stats = [
      ['Total', p.length, 'inventory_2'],
      ['Out of stock', p.filter((x) => x.in_stock === false).length, 'remove_shopping_cart'],
      ['Hidden', p.filter((x) => !x.is_published).length, 'visibility_off'],
      ['Featured', p.filter((x) => x.is_featured).length, 'star']
    ];
    $('#stats').innerHTML = stats.map(([label, n, icon]) => `
      <div class="bg-white border border-linen-stone px-4 py-3.5 flex items-center justify-between">
        <div><div class="label-caps text-secondary">${label}</div><div class="font-serif text-2xl mt-0.5">${n}</div></div>
        <span class="material-symbols-outlined text-[#c9c0b4]">${icon}</span>
      </div>`).join('');
  }

  function filteredProducts() {
    const q = $('#filter-search').value.trim().toLowerCase();
    const cat = $('#filter-category').value;
    const status = $('#filter-status').value;
    return state.products.filter((p) =>
      (!q || [p.name, p.short_note, p.fabric].join(' ').toLowerCase().includes(q)) &&
      (cat === 'all' || p.category_id === cat) &&
      (status === 'all' ||
        (status === 'published' && p.is_published) ||
        (status === 'draft' && !p.is_published) ||
        (status === 'in-stock' && p.in_stock !== false) ||
        (status === 'out-of-stock' && p.in_stock === false) ||
        (status === 'featured' && p.is_featured)));
  }

  function renderProducts() {
    renderStats();
    const list = filteredProducts();
    const hasAny = state.products.length > 0;
    $('#product-empty').hidden = list.length > 0;
    $('#product-empty-title').textContent = hasAny ? 'No matches' : 'No products yet';
    $('#product-empty-body').textContent = hasAny ? 'Try a different search or filter.' : 'Click "Add product" to add your first piece — it will appear on the website straight away.';

    $('#product-list').innerHTML = list.map((p) => {
      const cover = (p.images || [])[0];
      const cat = esc(categoryName(p.category_id));
      const inStock = p.in_stock !== false;
      const stockTitle = inStock ? 'In stock — tap to mark out of stock' : 'Out of stock — tap to mark back in stock';
      // One markup, three layouts (see .product-row CSS in admin.html):
      // phone = stacked card, tablet = 2-column cards, desktop (≥1024px) = table row.
      return `
      <div class="product-row ${p.is_published ? '' : 'is-hidden'} ${inStock ? '' : 'is-out'}" data-id="${esc(p.id)}">
        <button class="pr-thumb bg-linen-elevated overflow-hidden" data-action="edit" aria-label="Edit ${esc(p.name)}">
          ${cover ? `<img src="${esc(cover)}" alt="" loading="lazy" class="w-full h-full object-cover">` : '<span class="material-symbols-outlined text-[#c9c0b4]">image</span>'}
        </button>
        <div class="pr-info min-w-0">
          <button class="pr-name text-left font-medium hover:text-primary transition-colors" data-action="edit">${esc(p.name)}</button>
          ${p.is_published ? '' : '<span class="pr-flag inline-flex items-center gap-1 text-[11px] text-secondary bg-linen-elevated px-1.5 py-0.5 mt-1"><span class="material-symbols-outlined text-[13px]">visibility_off</span>Hidden from website</span>'}
          <div class="pr-note text-xs text-secondary">${esc(p.short_note || '')}</div>
          <div class="pr-meta flex flex-wrap items-center gap-x-2 gap-y-1 mt-2 text-xs">
            <span class="px-1.5 py-0.5 bg-linen-elevated">${cat}</span>
            <span class="font-medium text-sm tabular-nums">${formatPrice(p.price)}</span>
            ${p.is_featured ? '<span class="text-primary inline-flex items-center gap-0.5"><span class="material-symbols-outlined text-[14px]" style="font-variation-settings:\x27FILL\x27 1">star</span>Featured</span>' : ''}
          </div>
        </div>
        <div class="pr-cat"><span class="text-xs px-2 py-1 bg-linen-elevated">${cat}</span></div>
        <div class="pr-price text-right text-sm font-medium tabular-nums">${formatPrice(p.price)}</div>
        <div class="pr-actions">
          <label class="pr-live flex items-center gap-2.5 cursor-pointer" title="${stockTitle}">
            <button class="switch switch-stock" role="switch" aria-checked="${inStock}" data-action="stock" aria-label="${stockTitle}"></button>
            <span class="pr-live-label text-xs font-medium ${inStock ? 'text-whatsapp-forest' : 'text-berry-deep'}">${inStock ? 'In stock' : 'Out of stock'}</span>
          </label>
          <div class="pr-buttons flex items-center gap-0.5">
            <button class="icon-btn ${p.is_featured ? '!text-primary' : ''}" data-action="feature" title="${p.is_featured ? 'Featured on home page — tap to remove' : 'Feature on home page'}" aria-label="${p.is_featured ? 'Remove from home page' : 'Feature on home page'}">
              <span class="material-symbols-outlined" style="font-variation-settings:'FILL' ${p.is_featured ? 1 : 0}">star</span>
            </button>
            <a class="icon-btn" href="product.html?p=${encodeURIComponent(p.slug)}" target="_blank" rel="noopener" title="${p.is_published ? 'View on website' : 'Hidden — publish to view on website'}" aria-label="View on website"><span class="material-symbols-outlined">open_in_new</span></a>
            <button class="icon-btn" data-action="edit" title="Edit" aria-label="Edit ${esc(p.name)}"><span class="material-symbols-outlined">edit</span></button>
            <button class="icon-btn hover:!text-error" data-action="delete" title="Delete" aria-label="Delete ${esc(p.name)}"><span class="material-symbols-outlined">delete</span></button>
          </div>
        </div>
      </div>`;
    }).join('');
  }

  ['#filter-search', '#filter-category', '#filter-status'].forEach((sel) =>
    $(sel).addEventListener('input', renderProducts));

  $('#product-list').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = btn.closest('.product-row').dataset.id;
    const product = state.products.find((p) => p.id === id);
    if (!product) return;
    const action = btn.dataset.action;

    if (action === 'edit') openDrawer(product);
    if (action === 'stock') await quickUpdate(product, { in_stock: product.in_stock === false },
      product.in_stock === false ? `"${product.name}" is back in stock` : `"${product.name}" marked out of stock`);
    if (action === 'feature') await quickUpdate(product, { is_featured: !product.is_featured },
      product.is_featured ? 'Removed from home page' : 'Featured on home page');
    if (action === 'delete') await deleteProduct(product);
  });

  async function quickUpdate(product, patch, message) {
    const before = { ...product };
    Object.assign(product, patch);
    renderProducts();
    const { error } = await sb.from('products').update(patch).eq('id', product.id);
    if (error) {
      Object.assign(product, before);
      renderProducts();
      toast(friendlyError(error), 'error');
    } else {
      toast(message);
    }
  }

  async function deleteProduct(product) {
    const ok = await confirmDialog({ title: `Delete "${product.name}"?`, body: 'This removes it from the website and deletes its photos. This can\'t be undone.' });
    if (!ok) return;
    const { error } = await sb.from('products').delete().eq('id', product.id);
    if (error) { toast(friendlyError(error), 'error'); return; }
    await removeFromStorage(product.images || []);
    state.products = state.products.filter((p) => p.id !== product.id);
    renderProducts();
    renderCategories();
    toast('Product deleted');
  }

  // ---------- storage ----------

  function storagePathFromUrl(url) {
    const marker = `/storage/v1/object/public/${BUCKET}/`;
    const i = String(url).indexOf(marker);
    return i === -1 ? null : decodeURIComponent(url.slice(i + marker.length).split('?')[0]);
  }

  async function removeFromStorage(urlsOrPaths) {
    const paths = urlsOrPaths.map((u) => (u.startsWith('http') ? storagePathFromUrl(u) : u)).filter(Boolean);
    if (!paths.length) return;
    const { error } = await sb.storage.from(BUCKET).remove(paths);
    if (error) console.warn('[EEMA] Could not remove some images:', error);
  }

  // Resize to MAX_IMAGE_EDGE and re-encode as WebP (JPEG fallback) so phone photos stay small.
  async function compressImage(file) {
    let bitmap;
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      bitmap = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
      });
    }
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    let blob = await new Promise((r) => canvas.toBlob(r, 'image/webp', 0.82));
    if (!blob || blob.type !== 'image/webp') blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.85));
    return blob;
  }

  async function uploadPhoto(file) {
    const blob = await compressImage(file);
    const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `products/${uid()}.${ext}`;
    const { error } = await sb.storage.from(BUCKET).upload(path, blob, { contentType: blob.type, cacheControl: '31536000' });
    if (error) throw error;
    state.uploadedThisSession.push(path);
    return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  }

  // ---------- drawer: photos ----------

  function renderPhotos() {
    $('#photo-grid').innerHTML = state.photos.map((ph, i) => `
      <div class="photo relative aspect-[3/4] bg-linen-elevated overflow-hidden group ${ph.uploading ? '' : 'cursor-grab'}" draggable="${!ph.uploading}" data-id="${ph.id}">
        ${ph.url ? `<img src="${esc(ph.url)}" alt="" class="w-full h-full object-cover pointer-events-none">` : ''}
        ${ph.uploading ? `<div class="absolute inset-0 bg-white/60 flex items-end"><div class="h-1 w-full shimmer"></div></div>` : ''}
        ${i === 0 && !ph.uploading ? `<span class="absolute top-1.5 left-1.5 bg-noir-text text-white text-[10px] tracking-widest uppercase px-1.5 py-0.5">Cover</span>` : ''}
        ${!ph.uploading ? `
        <div class="photo-controls absolute top-1 right-1 flex gap-1">
          ${i > 0 ? `<button type="button" class="photo-btn w-7 h-7 bg-white/95 flex items-center justify-center hover:text-primary" data-photo-action="cover" title="Make cover" aria-label="Make photo ${i + 1} the cover"><span class="material-symbols-outlined text-[16px]">star</span></button>` : ''}
          <button type="button" class="photo-btn w-7 h-7 bg-white/95 flex items-center justify-center hover:text-error" data-photo-action="remove" title="Remove" aria-label="Remove photo ${i + 1}"><span class="material-symbols-outlined text-[16px]">close</span></button>
        </div>
        ${state.photos.length > 1 ? `
        <div class="photo-controls absolute bottom-1 inset-x-1 flex justify-between">
          <button type="button" class="photo-btn w-7 h-7 bg-white/95 flex items-center justify-center hover:text-primary disabled:invisible" data-photo-action="left" ${i === 0 ? 'disabled' : ''} title="Move earlier" aria-label="Move photo ${i + 1} earlier"><span class="material-symbols-outlined text-[16px]">chevron_left</span></button>
          <button type="button" class="photo-btn w-7 h-7 bg-white/95 flex items-center justify-center hover:text-primary disabled:invisible" data-photo-action="right" ${i === state.photos.length - 1 ? 'disabled' : ''} title="Move later" aria-label="Move photo ${i + 1} later"><span class="material-symbols-outlined text-[16px]">chevron_right</span></button>
        </div>` : ''}` : ''}
      </div>`).join('');
  }

  async function addFiles(files) {
    const images = [...files].filter((f) => f.type.startsWith('image/'));
    if (!images.length) return;
    clearError('images');
    const pending = images.map((file) => ({ id: uid(), url: URL.createObjectURL(file), uploading: true, isNew: true, file }));
    state.photos.push(...pending);
    renderPhotos();
    updateSaveState();
    await Promise.all(pending.map(async (ph) => {
      try {
        const url = await uploadPhoto(ph.file);
        URL.revokeObjectURL(ph.url);
        ph.url = url;
        ph.uploading = false;
        delete ph.file;
      } catch (err) {
        state.photos = state.photos.filter((x) => x !== ph);
        toast('Photo upload failed: ' + friendlyError(err), 'error');
      }
      renderPhotos();
      updateSaveState();
    }));
  }

  $('#photo-input').addEventListener('change', (e) => { addFiles(e.target.files); e.target.value = ''; });

  const dz = $('#dropzone');
  ['dragenter', 'dragover'].forEach((ev) => dz.addEventListener(ev, (e) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault(); dz.classList.add('drag-over');
  }));
  ['dragleave', 'drop'].forEach((ev) => dz.addEventListener(ev, () => dz.classList.remove('drag-over')));
  dz.addEventListener('drop', (e) => { if (e.dataTransfer.files.length) { e.preventDefault(); addFiles(e.dataTransfer.files); } });

  $('#photo-grid').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-photo-action]');
    if (!btn) return;
    const id = btn.closest('.photo').dataset.id;
    const idx = state.photos.findIndex((p) => p.id === id);
    if (btn.dataset.photoAction === 'remove') state.photos.splice(idx, 1);
    if (btn.dataset.photoAction === 'cover') state.photos.unshift(state.photos.splice(idx, 1)[0]);
    if (btn.dataset.photoAction === 'left' || btn.dataset.photoAction === 'right') {
      const to = idx + (btn.dataset.photoAction === 'left' ? -1 : 1);
      if (to >= 0 && to < state.photos.length) state.photos.splice(to, 0, state.photos.splice(idx, 1)[0]);
    }
    renderPhotos();
  });

  // Drag-to-reorder photos
  let dragId = null;
  $('#photo-grid').addEventListener('dragstart', (e) => {
    const el = e.target.closest('.photo');
    if (!el) return;
    dragId = el.dataset.id;
    el.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });
  $('#photo-grid').addEventListener('dragover', (e) => {
    const el = e.target.closest('.photo');
    if (!dragId || !el) return;
    e.preventDefault();
    $$('.photo', $('#photo-grid')).forEach((p) => p.classList.toggle('drop-target', p === el && p.dataset.id !== dragId));
  });
  $('#photo-grid').addEventListener('drop', (e) => {
    const el = e.target.closest('.photo');
    if (!dragId || !el) return;
    e.preventDefault();
    const from = state.photos.findIndex((p) => p.id === dragId);
    const to = state.photos.findIndex((p) => p.id === el.dataset.id);
    if (from > -1 && to > -1 && from !== to) state.photos.splice(to, 0, state.photos.splice(from, 1)[0]);
    dragId = null;
    renderPhotos();
  });
  $('#photo-grid').addEventListener('dragend', () => { dragId = null; renderPhotos(); });

  // ---------- drawer: category / tags / colours / switches ----------

  function renderCategorySeg() {
    $('#f-category').innerHTML = state.categories.map((c) =>
      `<button type="button" data-id="${esc(c.id)}" aria-pressed="${c.id === state.categoryId}">${esc(c.name)}</button>`).join('') ||
      '<span class="p-3 text-sm text-secondary">Add a category first (Categories tab).</span>';
  }
  $('#f-category').addEventListener('click', (e) => {
    const b = e.target.closest('[data-id]');
    if (!b) return;
    state.categoryId = b.dataset.id;
    // New product, sizes not hand-picked yet: suggest the right size run for the category
    if (!state.editing && !state.sizesTouched) {
      const cat = state.categories.find((c) => c.id === state.categoryId);
      state.sizes = cat && cat.slug === 'kids' ? SIZES_KIDS.slice(0, 5) : DEFAULT_ADULT.slice();
      renderSizes();
    }
    clearError('category');
    renderCategorySeg();
  });

  // ---------- drawer: sizes ----------

  function orderedSizes() {
    const order = [...SIZES_ADULT, ...SIZES_KIDS];
    return state.sizes.slice().sort((a, b) => {
      const ia = order.indexOf(a), ib = order.indexOf(b);
      return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
    });
  }

  function renderSizes() {
    const chip = (sz) => `<button type="button" class="chip min-w-[44px]" data-size="${esc(sz)}" aria-pressed="${state.sizes.includes(sz)}">${esc(sz)}</button>`;
    $('#f-sizes-adult').innerHTML = '<span class="text-xs text-secondary w-12">Adult</span>' + SIZES_ADULT.map(chip).join('');
    $('#f-sizes-kids').innerHTML = '<span class="text-xs text-secondary w-12">Kids</span>' + SIZES_KIDS.map(chip).join('');
    const custom = state.sizes.filter((s) => !SIZES_ADULT.includes(s) && !SIZES_KIDS.includes(s));
    $('#f-sizes-custom').innerHTML = custom.length ? '<span class="text-xs text-secondary w-12">Other</span>' + custom.map(chip).join('') : '';
  }

  $('#product-form').addEventListener('click', (e) => {
    const b = e.target.closest('[data-size]');
    if (!b) return;
    const sz = b.dataset.size;
    state.sizesTouched = true;
    state.sizes = state.sizes.includes(sz) ? state.sizes.filter((x) => x !== sz) : state.sizes.concat(sz);
    renderSizes();
  });
  function addCustomSize() {
    const input = $('#new-size');
    const sz = input.value.trim();
    if (!sz) return;
    if (!state.sizes.includes(sz)) state.sizes.push(sz);
    state.sizesTouched = true;
    input.value = '';
    renderSizes();
  }
  $('#add-size').addEventListener('click', addCustomSize);
  $('#new-size').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomSize(); } });

  function renderTags() {
    const all = new Set([...PRESET_TAGS, ...state.products.flatMap((p) => p.tags || []), ...state.tags]);
    $('#f-tags').innerHTML = [...all].map((t) =>
      `<button type="button" class="chip" data-tag="${esc(t)}" aria-pressed="${state.tags.has(t)}">${esc(tagLabel(t))}</button>`).join('');
  }
  $('#f-tags').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tag]');
    if (!b) return;
    const t = b.dataset.tag;
    state.tags.has(t) ? state.tags.delete(t) : state.tags.add(t);
    renderTags();
  });
  function addCustomTag() {
    const input = $('#new-tag');
    const t = slugify(input.value);
    if (!input.value.trim()) return;
    state.tags.add(t);
    input.value = '';
    renderTags();
  }
  $('#add-tag').addEventListener('click', addCustomTag);
  $('#new-tag').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomTag(); } });

  function colorRow(c = { name: '', hex: '#d6ccb8' }) {
    const row = document.createElement('div');
    row.className = 'color-row flex items-center gap-2';
    row.innerHTML = `
      <input type="color" class="w-11 h-11 p-1 bg-white border border-linen-stone cursor-pointer shrink-0" value="${esc(c.hex || '#d6ccb8')}" aria-label="Colour swatch">
      <input class="field" placeholder="Colour name, e.g. Rose Guava" maxlength="40" value="${esc(c.name || '')}">
      <button type="button" class="icon-btn shrink-0" data-remove-color aria-label="Remove colour"><span class="material-symbols-outlined">close</span></button>`;
    return row;
  }
  $('#add-color').addEventListener('click', () => {
    const row = colorRow();
    $('#f-colors').appendChild(row);
    row.querySelector('.field').focus();
  });
  $('#f-colors').addEventListener('click', (e) => { if (e.target.closest('[data-remove-color]')) e.target.closest('.color-row').remove(); });

  $$('#f-in-stock, #f-published, #f-featured').forEach((sw) => sw.addEventListener('click', () =>
    sw.setAttribute('aria-checked', sw.getAttribute('aria-checked') === 'true' ? 'false' : 'true')));

  // ---------- drawer: open / close ----------

  function openDrawer(product = null) {
    state.editing = product;
    state.uploadedThisSession = [];
    state.photos = (product ? product.images || [] : []).map((url) => ({ id: uid(), url, uploading: false, isNew: false }));
    state.tags = new Set(product ? product.tags || [] : []);
    state.sizes = product ? (product.sizes || []).slice() : [];
    state.sizesTouched = !!product;
    state.categoryId = product ? product.category_id : (state.categories.length === 1 ? state.categories[0].id : ($('#filter-category').value !== 'all' ? $('#filter-category').value : null));
    if (!product) {
      const cat = state.categories.find((c) => c.id === state.categoryId);
      state.sizes = cat && cat.slug === 'kids' ? SIZES_KIDS.slice(0, 5) : DEFAULT_ADULT.slice();
    }

    $('#drawer-title').textContent = product ? 'Edit product' : 'Add product';
    $('#save-product').textContent = product ? 'Save changes' : 'Save product';
    $('#f-name').value = product ? product.name : '';
    $('#f-price').value = product ? product.price : '';
    $('#f-note').value = product ? product.short_note || '' : '';
    $('#f-description').value = product ? product.description || '' : '';
    $('#f-fabric').value = product ? product.fabric || '' : '';
    $('#f-published').setAttribute('aria-checked', String(product ? product.is_published : true));
    $('#f-in-stock').setAttribute('aria-checked', String(product ? product.in_stock !== false : true));
    $('#f-featured').setAttribute('aria-checked', String(product ? product.is_featured : false));
    $('#fabric-options').innerHTML = [...new Set(['100% Pure Linen', 'Artisanal Batik', ...state.products.map((p) => p.fabric).filter(Boolean)])]
      .map((f) => `<option value="${esc(f)}">`).join('');
    $('#f-colors').innerHTML = '';
    (product && Array.isArray(product.colors) ? product.colors : []).forEach((c) => $('#f-colors').appendChild(colorRow(c)));
    $$('.field-error').forEach((el) => { el.hidden = true; });
    $$('#product-form .is-invalid').forEach((el) => el.classList.remove('is-invalid'));

    renderPhotos();
    renderCategorySeg();
    renderSizes();
    renderTags();
    updateSaveState();

    const drawer = $('#drawer');
    drawer.hidden = false;
    $('#product-form').scrollTop = 0;
    requestAnimationFrame(() => drawer.classList.add('open'));
    setTimeout(() => $('#f-name').focus(), 300);
  }

  // Used by the session guard: drop unsaved uploads while we still have permission to delete them.
  async function discardOpenEdits() {
    if ($('#drawer').hidden) return;
    const pending = state.uploadedThisSession.slice();
    state.uploadedThisSession = [];
    if (pending.length) await removeFromStorage(pending);
    $('#drawer').classList.remove('open');
    $('#drawer').hidden = true;
  }

  async function closeDrawer({ saved = false } = {}) {
    const drawer = $('#drawer');
    if (drawer.hidden) return;
    if (!saved && state.uploadedThisSession.length) {
      // Discard photos uploaded during this edit that were never saved to a product.
      removeFromStorage(state.uploadedThisSession);
    }
    state.uploadedThisSession = [];
    drawer.classList.remove('open');
    setTimeout(() => { drawer.hidden = true; }, 300);
  }

  $('#fab-add').addEventListener('click', () => $('#add-product').click());
  $('#add-product').addEventListener('click', () => {
    if (!state.categories.length) { toast('Create a category first (Categories tab).', 'info'); return; }
    openDrawer();
  });
  $('#drawer').addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeDrawer(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('#drawer').hidden && $('#confirm').hidden) closeDrawer();
  });

  function updateSaveState() {
    const uploading = state.photos.some((p) => p.uploading);
    const btn = $('#save-product');
    btn.disabled = uploading;
    btn.title = uploading ? 'Waiting for photos to finish uploading…' : '';
  }

  // ---------- drawer: validation & save ----------

  function fieldError(key, msg, inputEl) {
    const el = $(`.field-error[data-for="${key}"]`);
    el.textContent = msg;
    el.hidden = false;
    if (inputEl) inputEl.classList.add('is-invalid');
  }
  function clearError(key) {
    const el = $(`.field-error[data-for="${key}"]`);
    if (el) el.hidden = true;
  }
  $('#f-name').addEventListener('input', (e) => { e.target.classList.remove('is-invalid'); clearError('name'); });
  $('#f-price').addEventListener('input', (e) => { e.target.classList.remove('is-invalid'); clearError('price'); });

  function uniqueSlug(name, selfId) {
    const base = slugify(name);
    const taken = new Set(state.products.filter((p) => p.id !== selfId).map((p) => p.slug));
    let slug = base, n = 2;
    while (taken.has(slug)) slug = `${base}-${n++}`;
    return slug;
  }

  $('#product-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    $$('.field-error').forEach((el) => { el.hidden = true; });

    const name = $('#f-name').value.trim();
    const priceRaw = $('#f-price').value.trim();
    const price = Math.round(Number(priceRaw));
    let firstInvalid = null;
    const fail = (key, msg, el, focusEl) => { fieldError(key, msg, el); firstInvalid = firstInvalid || focusEl || el; };

    if (!state.photos.length) fail('images', 'Add at least one photo.', null, $('#dropzone'));
    if (!name) fail('name', 'Give the product a name.', $('#f-name'));
    if (!priceRaw || !Number.isFinite(price) || price < 0) fail('price', 'Enter a price in rupees, e.g. 6900.', $('#f-price'));
    if (!state.categoryId) fail('category', 'Choose a category.', null, $('#f-category'));
    if (firstInvalid) {
      firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (firstInvalid.focus && firstInvalid.tagName === 'INPUT') firstInvalid.focus({ preventScroll: true });
      return;
    }

    const colors = $$('.color-row', $('#f-colors'))
      .map((row) => ({ hex: row.querySelector('input[type=color]').value, name: row.querySelector('.field').value.trim() }))
      .filter((c) => c.name);

    const editing = state.editing;
    const payload = {
      name,
      slug: editing && editing.name === name ? editing.slug : uniqueSlug(name, editing && editing.id),
      price,
      category_id: state.categoryId,
      short_note: $('#f-note').value.trim() || null,
      description: $('#f-description').value.trim() || null,
      fabric: $('#f-fabric').value.trim() || null,
      tags: [...state.tags],
      sizes: orderedSizes(),
      colors,
      images: state.photos.map((p) => p.url),
      is_published: $('#f-published').getAttribute('aria-checked') === 'true',
      in_stock: $('#f-in-stock').getAttribute('aria-checked') === 'true',
      is_featured: $('#f-featured').getAttribute('aria-checked') === 'true'
    };

    const btn = $('#save-product');
    setBusy(btn, true, 'Saving');
    try {
      // If a column from a later migration (sizes, in_stock) isn't in the database yet,
      // retry without it so photos and other edits still save.
      const skipped = [];
      const write = async (build) => {
        let body = { ...payload };
        let res = await build(body);
        for (const col of Object.keys(MIGRATION_FOR)) {
          if (res.error && isMissingColumn(res.error, col)) {
            delete body[col];
            skipped.push(col);
            res = await build(body);
          }
        }
        if (res.error) throw res.error;
        return res.data;
      };

      let saved;
      if (editing) {
        saved = await write((body) => sb.from('products').update(body).eq('id', editing.id).select().single());
        // Delete photos that were removed from this product
        const removed = (editing.images || []).filter((u) => !payload.images.includes(u));
        removeFromStorage(removed);
        state.products = state.products.map((p) => (p.id === saved.id ? saved : p));
      } else {
        const minOrder = state.products.reduce((m, p) => Math.min(m, p.sort_order || 0), 0);
        saved = await write((body) => sb.from('products').insert({ ...body, sort_order: minOrder - 1 }).select().single());
        state.products.unshift(saved);
      }
      setBusy(btn, false);
      closeDrawer({ saved: true });
      renderProducts();
      renderCategories();
      toast(editing ? 'Changes saved' : `"${saved.name}" added${saved.is_published ? ' to the website' : ' as hidden'}`);
      skipped.forEach((col) => toast(`Saved without ${col === 'sizes' ? 'sizes' : 'stock status'}. Run supabase/migrations/${MIGRATION_FOR[col]} in the Supabase SQL Editor to enable it.`, 'info'));
    } catch (err) {
      setBusy(btn, false);
      toast(friendlyError(err), 'error');
    }
  });

  // ---------- categories ----------

  function renderCategories() {
    const counts = new Map();
    state.products.forEach((p) => counts.set(p.category_id, (counts.get(p.category_id) || 0) + 1));
    const cats = state.categories;
    $('#category-list').innerHTML = cats.length ? cats.map((c, i) => `
      <div class="cat-row flex items-center gap-2 px-3 py-2.5 border-b border-linen-stone last:border-b-0" data-id="${esc(c.id)}">
        <div class="flex flex-col">
          <button class="cat-move w-7 h-5 flex items-center justify-center text-secondary hover:text-noir-text disabled:opacity-20" data-cat-action="up" ${i === 0 ? 'disabled' : ''} aria-label="Move up"><span class="material-symbols-outlined text-[18px]">keyboard_arrow_up</span></button>
          <button class="cat-move w-7 h-5 flex items-center justify-center text-secondary hover:text-noir-text disabled:opacity-20" data-cat-action="down" ${i === cats.length - 1 ? 'disabled' : ''} aria-label="Move down"><span class="material-symbols-outlined text-[18px]">keyboard_arrow_down</span></button>
        </div>
        <input class="field !border-transparent hover:!border-linen-stone focus:!border-noir-text !py-2 flex-1" value="${esc(c.name)}" data-cat-name maxlength="40" aria-label="Category name">
        <span class="text-xs text-secondary whitespace-nowrap w-20 text-right">${counts.get(c.id) || 0} product${counts.get(c.id) === 1 ? '' : 's'}</span>
        <button class="icon-btn hover:!text-error" data-cat-action="delete" title="Delete category"><span class="material-symbols-outlined">delete</span></button>
      </div>`).join('') : '<p class="p-6 text-sm text-secondary text-center">No categories yet.</p>';
  }

  $('#category-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = $('#category-name');
    const name = input.value.trim();
    if (!name) { input.focus(); return; }
    let slug = slugify(name);
    if (state.categories.some((c) => c.slug === slug)) { toast('That category already exists.', 'info'); return; }
    const sort_order = state.categories.reduce((m, c) => Math.max(m, c.sort_order || 0), 0) + 1;
    const { data, error } = await sb.from('categories').insert({ name, slug, sort_order }).select().single();
    if (error) { toast(friendlyError(error), 'error'); return; }
    state.categories.push(data);
    input.value = '';
    renderCategories();
    renderCategoryFilter();
    toast(`"${name}" added — it now appears as a tab on the Lookbook`);
  });

  // Rename on blur / Enter. The slug (used in ?category= links) is kept stable.
  $('#category-list').addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('[data-cat-name]')) e.target.blur(); });
  $('#category-list').addEventListener('focusout', async (e) => {
    if (!e.target.matches('[data-cat-name]')) return;
    const id = e.target.closest('.cat-row').dataset.id;
    const cat = state.categories.find((c) => c.id === id);
    const name = e.target.value.trim();
    if (!cat || name === cat.name) return;
    if (!name) { e.target.value = cat.name; return; }
    const { error } = await sb.from('categories').update({ name }).eq('id', id);
    if (error) { e.target.value = cat.name; toast(friendlyError(error), 'error'); return; }
    cat.name = name;
    renderCategoryFilter();
    renderProducts();
    toast('Category renamed');
  });

  $('#category-list').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-cat-action]');
    if (!btn) return;
    const id = btn.closest('.cat-row').dataset.id;
    const idx = state.categories.findIndex((c) => c.id === id);
    const cat = state.categories[idx];
    const action = btn.dataset.catAction;

    if (action === 'up' || action === 'down') {
      const j = action === 'up' ? idx - 1 : idx + 1;
      const other = state.categories[j];
      if (!other) return;
      state.categories[idx] = other;
      state.categories[j] = cat;
      state.categories.forEach((c, k) => { c.sort_order = k + 1; });
      renderCategories();
      renderCategoryFilter();
      const results = await Promise.all([cat, other].map((c) => sb.from('categories').update({ sort_order: c.sort_order }).eq('id', c.id)));
      const failed = results.find((r) => r.error);
      if (failed) { toast(friendlyError(failed.error), 'error'); loadAll(); }
    }

    if (action === 'delete') {
      const count = state.products.filter((p) => p.category_id === id).length;
      if (count) {
        toast(`"${cat.name}" still has ${count} product${count === 1 ? '' : 's'}. Move or delete them first.`, 'info');
        return;
      }
      const ok = await confirmDialog({ title: `Delete "${cat.name}"?`, body: 'The tab will disappear from the Lookbook page.' });
      if (!ok) return;
      const { error } = await sb.from('categories').delete().eq('id', id);
      if (error) { toast(friendlyError(error), 'error'); return; }
      state.categories.splice(idx, 1);
      renderCategories();
      renderCategoryFilter();
      toast('Category deleted');
    }
  });

  // ---------- boot ----------

  (async function init() {
    if (!window.sb) {
      $('#config-warning').hidden = false;
      $('#login-submit').disabled = true;
      show('login');
      return;
    }
    const { data } = await sb.auth.getSession();
    await enterWithSession(data.session);
    // Signed out elsewhere (e.g. token revoked) — tidy up and show the login screen.
    sb.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' && state.user) endSession('Your session has ended. Please sign in again.');
    });
  })();
})();
