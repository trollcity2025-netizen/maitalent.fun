// src/lib/env.ts
// Environment variable helper with proper defaults and validation

const API_URL = import.meta.env.VITE_SUPABASE_URL || '';
const API_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Validate that we have values in non-development builds
if (import.meta.env.PROD && (!API_URL || !API_KEY)) {
  console.warn('[Environment] Missing Supabase credentials in production build');
}

export { API_URL, API_KEY };