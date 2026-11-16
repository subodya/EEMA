// Chamathkara Lankan Fashion — shared site header behaviour (used on every public page).
// Handles: mobile menu, search panel, scroll elevation. Markup lives in each page's #site-header.
(function () {
  // Floating WhatsApp button: when the footer's bottom row scrolls into view, lift the button
  // so it sits just above that row instead of covering it.
  const waFloat = document.querySelector('.wa-float');
  const footBase = document.querySelector('.eema-footer .ft-base');
  if (waFloat && footBase) {
    let ticking = false;
    const place = () => {
      ticking = false;
      const overlap = window.innerHeight - footBase.getBoundingClientRect().top;
      waFloat.style.setProperty('--wa-lift', Math.max(0, Math.round(overlap - 8)) + 'px');
    };
    const queue = () => { if (!ticking) { ticking = true; requestAnimationFrame(place); } };
    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue);
    place();
  }

  const header = document.getElementById('site-header');
  if (!header) return;

  const menuBtn = document.getElementById('mobile-menu-toggle');
  const drawer = document.getElementById('mobile-menu-drawer');
  const searchBtns = document.querySelectorAll('[data-search-toggle]');
  const searchPanel = document.getElementById('nav-search-panel');
  const searchForm = document.getElementById('nav-search-form');
  const searchInput = document.getElementById('nav-search-input');

  // ---------- mobile menu ----------
  function setMenu(open) {
    if (!menuBtn || !drawer) return;
    drawer.hidden = !open;
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    header.classList.toggle('menu-open', open);
    // The menu fills the screen below the header, so the page behind it must not scroll
    document.documentElement.classList.toggle('hd-locked', open);
    if (open) {
      header.style.setProperty('--hd-bottom', Math.round(header.getBoundingClientRect().bottom) + 'px');
      setSearch(false);
    }
  }
  if (menuBtn && drawer) {
    menuBtn.addEventListener('click', () => setMenu(drawer.hidden));
    drawer.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
    window.addEventListener('resize', () => { if (window.innerWidth >= 1024 && !drawer.hidden) setMenu(false); });
  }

  // ---------- search ----------
  const onLookbook = /lookbook\.html$/i.test(location.pathname);
  function setSearch(open) {
    if (!searchPanel) return;
    searchPanel.hidden = !open;
    searchBtns.forEach((b) => b.setAttribute('aria-expanded', String(open)));
    if (open) {
      setMenu(false);
      if (searchInput) setTimeout(() => searchInput.focus(), 30);
    }
  }
  searchBtns.forEach((b) => b.addEventListener('click', () => setSearch(searchPanel && searchPanel.hidden)));

  if (searchInput) searchInput.value = new URLSearchParams(location.search).get('search') || '';

  if (searchForm && searchInput) {
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = searchInput.value.trim();
      // On the lookbook, filter in place instead of reloading
      if (onLookbook && window.EEMA && typeof window.EEMA.setSearch === 'function') {
        window.EEMA.setSearch(q);
        setSearch(false);
        const grid = document.getElementById('catalog-grid-view');
        if (grid) grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      location.href = q ? '/collections?search=' + encodeURIComponent(q) : '/collections';
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (searchPanel && !searchPanel.hidden) setSearch(false);
    if (drawer && !drawer.hidden) { setMenu(false); menuBtn.focus(); }
  });

  // ---------- scroll: condensed header + shadow once the announcement bar has scrolled away ----------
  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 60);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();
