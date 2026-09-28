// EEMA Fashion — Supabase connection settings (TEMPLATE).
// Copy this file to js/supabase-config.js and fill in the values from
// Supabase Dashboard → Project Settings → API. js/supabase-config.js is git-ignored.
// On GitHub Pages, the deploy workflow creates it from the repository secrets
// SUPABASE_URL and SUPABASE_ANON_KEY.
// Only ever use the anon/publishable key here — NEVER the service_role key.
window.EEMA_CONFIG = {
  SUPABASE_URL: 'https://YOUR-PROJECT-REF.supabase.co',
  SUPABASE_ANON_KEY: 'YOUR-ANON-PUBLIC-KEY',
  STORAGE_BUCKET: 'product-images',
  WHATSAPP_NUMBER: '94779052928',
  FACEBOOK_URL: 'https://www.facebook.com/people/Eema-Fashion/61553131572724/',

  // Admin panel session limits
  ADMIN_IDLE_MINUTES: 20,      // sign out after this long with no taps/typing (a 1-minute warning shows first)
  ADMIN_MAX_SESSION_HOURS: 8   // sign out this long after signing in, even if active
};
