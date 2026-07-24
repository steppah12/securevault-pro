// supabase/functions/sign-document/index.ts
//
// Deploy: supabase functions deploy sign-document
// Secret:  supabase secrets set DOCUMENT_HMAC_SECRET=$(openssl rand -hex 32)
//
// Called right after a client finishes uploading a file to the 'documents'
// storage bucket. It re-downloads the bytes SERVER-SIDE (so the client
// can't just lie about a hash), computes a real SHA-256 digest, then an
// HMAC-SHA256 signature over that digest using a secret the browser never
// sees. This is the fix for the prototype's "signature", which was a
// 32-bit rolling hash of the filename/timestamp — cosmetic, not
// integrity-checking, and trivially forgeable.
//
// Verification later (see verify-document function) recomputes the hash
// from current storage bytes and the HMAC from the stored hash, and
// compares — if either the file or the recorded hash was tampered with,
// verification fails.

import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const HMAC_SECRET = Deno.env.get('DOCUMENT_HMAC_SECRET')!;

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmacHex(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  // The browser sends this automatically before the real POST, to ask
  // permission. Must be answered with the CORS headers and no body, or
  // the browser blocks the real request and it never reaches us at all.
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Identify the caller from their JWT (passed through from the client)
    // so we can verify they actually own the document before signing it.
    const { data: userData, error: userErr } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userErr || !userData.user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { documentId } = await req.json();
    if (!documentId) return new Response(JSON.stringify({ error: 'documentId required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: doc, error: docErr } = await supabase.from('documents').select('*').eq('id', documentId).single();
    if (docErr || !doc) return new Response(JSON.stringify({ error: 'Document not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (doc.owner !== userData.user.id) return new Response(JSON.stringify({ error: 'Not the document owner' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: fileBlob, error: dlErr } = await supabase.storage.from('documents').download(doc.file_path);
    if (dlErr || !fileBlob) return new Response(JSON.stringify({ error: 'Could not read uploaded file' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const bytes = await fileBlob.arrayBuffer();
    const hash = await sha256Hex(bytes);
    const signature = await hmacHex(`${documentId}:${hash}`, HMAC_SECRET);

    const { error: updateErr } = await supabase
      .from('documents')
      .update({ sha256_hash: hash, hmac_signature: signature, signature_status: 'Verified' })
      .eq('id', documentId);
    if (updateErr) throw updateErr;

    return new Response(JSON.stringify({ sha256: hash, signature, status: 'Verified' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
