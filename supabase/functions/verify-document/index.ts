// supabase/functions/verify-document/index.ts
// Recomputes SHA-256 from the current storage bytes + HMAC from the secret,
// and compares against what's stored on the row. Lets the UI show a live
// "Verified" / "TAMPERED" state instead of trusting a static flag forever.
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
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: userData, error: userErr } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userErr || !userData.user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { documentId } = await req.json();
    const { data: doc } = await supabase.from('documents').select('*').eq('id', documentId).single();
    if (!doc) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: fileBlob, error: dlErr } = await supabase.storage.from('documents').download(doc.file_path);
    if (dlErr || !fileBlob) return new Response(JSON.stringify({ valid: false, reason: 'File missing' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const bytes = await fileBlob.arrayBuffer();
    const currentHash = await sha256Hex(bytes);
    const expectedSig = await hmacHex(`${documentId}:${currentHash}`, HMAC_SECRET);

    const valid = currentHash === doc.sha256_hash && expectedSig === doc.hmac_signature;
    return new Response(JSON.stringify({ valid, currentHash, storedHash: doc.sha256_hash }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
