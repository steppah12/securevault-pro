// supabase/functions/_shared/cors.ts
//
// Browsers require an Edge Function to explicitly opt in to being called
// from a different origin (your Vercel domain) via CORS headers, and to
// answer the OPTIONS "preflight" request the browser sends first for any
// POST with a custom Authorization header. Supabase Edge Functions do NOT
// add these automatically — every function that will be called directly
// from the browser needs this.
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
