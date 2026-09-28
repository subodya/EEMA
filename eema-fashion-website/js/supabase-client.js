// Creates the shared Supabase client as `window.sb`.
// Load order: supabase-js CDN → supabase-config.js → this file.
// A page can set window.EEMA_AUTH_STORAGE = 'session' before this file (admin.html does)
// so the login lives only in that browser tab: closing the tab/browser signs you out.
(function () {
  const cfg = window.EEMA_CONFIG || {};
  const configured = cfg.SUPABASE_URL && !cfg.SUPABASE_URL.includes('YOUR-PROJECT-REF');
  if (!window.supabase || !configured) {
    console.warn('[EEMA] Supabase is not configured — edit js/supabase-config.js');
    window.sb = null;
    return;
  }

  const options = {};
  if (window.EEMA_AUTH_STORAGE === 'session') {
    options.auth = { storage: window.sessionStorage, persistSession: true, autoRefreshToken: true };
    // Remove any long-lived login saved by older versions (they used localStorage).
    try {
      Object.keys(localStorage)
        .filter((k) => /^sb-.+-auth-token$/.test(k))
        .forEach((k) => localStorage.removeItem(k));
    } catch (e) { /* storage unavailable */ }
  }
  window.sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, options);
})();
