import { createClient } from '@supabase/supabase-js';

// Force HTTPS for development
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.startsWith('https') 
  ? import.meta.env.VITE_SUPABASE_URL 
  : `https://${import.meta.env.VITE_SUPABASE_URL}`.trim();

const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[Supabase] Missing credentials in .env file');
  console.error('  URL:', supabaseUrl);
  console.error('  Key:', supabaseAnonKey);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

// Auth state change handling
supabase.auth.onAuthStateChange((event, session) => {
  console.log('[Auth] State changed:', event);

  if (session) {
    console.log(' → User:', session.user?.email || 'No email');
  } else {
    console.log(' → Session ended');
  }
});