// EEMA Fashion — shared site header behaviour (used on every public page).
// Handles: mobile menu, search panel, scroll elevation. Markup lives in each page's #site-header.
(function () {
  // Phones: the floating "Chat with our stylist" pill shrinks to its round WhatsApp icon
  // so it never covers page content.
  if (!document.getElementById('eema-float-chat-css')) {
    const st = document.createElement('style');
    st.id = 'eema-float-chat-css';
    st.textContent = '@media (max-width: 767px) { body > aside.fixed.bottom-6 { right: 16px; bottom: calc(16px + env(safe-area-inset-bottom, 0px)); } body > aside.fixed.bottom-6 > a { padding: 8px !important; } body > aside.fixed.bottom-6 > a > span:first-child { display: none !important; } body > aside.fixed.bottom-6 > a > span:last-child { width: 40px; height: 40px; margin: 0; } }';
    document.head.appendChild(st);
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
    if (open) setSearch(false);
  }
  if (menuBtn && drawer) {
    menuBtn.addEventListener('click', () => setMenu(drawer.hidden));
    drawer.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
    window.addEventListener('resize', () => { if (window.innerWidth >= 1280) setMenu(false); });
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
      location.href = q ? 'lookbook.html?search=' + encodeURIComponent(q) : 'lookbook.html';
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (searchPanel && !searchPanel.hidden) setSearch(false);
    if (drawer && !drawer.hidden) { setMenu(false); menuBtn.focus(); }
  });

  // ---------- scroll elevation ----------
  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 12);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();
