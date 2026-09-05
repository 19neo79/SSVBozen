import type { Context } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL as string;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Metodo non consentito' }), { status: 405 });
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: 'Configurazione server incompleta' }), { status: 500 });
  }

  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) {
    return new Response(JSON.stringify({ error: 'Non autenticato' }), { status: 401 });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: callerData, error: callerError } = await admin.auth.getUser(token);
  if (callerError || !callerData?.user) {
    return new Response(JSON.stringify({ error: 'Sessione non valida' }), { status: 401 });
  }

  const { data: callerProfile, error: profileError } = await admin
    .from('profiles')
    .select('ruolo')
    .eq('id', callerData.user.id)
    .single();
  if (profileError || callerProfile?.ruolo !== 'admin') {
    return new Response(JSON.stringify({ error: 'Solo un admin può creare nuovi utenti' }), { status: 403 });
  }

  let body: { email?: string; password?: string; nome?: string; ruolo?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Corpo della richiesta non valido' }), { status: 400 });
  }

  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';
  const nome = (body.nome || '').trim();
  const ruolo = body.ruolo === 'admin' ? 'admin' : 'allenatore';

  if (!email || !email.includes('@')) {
    return new Response(JSON.stringify({ error: 'Email non valida' }), { status: 400 });
  }
  if (password.length < 6) {
    return new Response(JSON.stringify({ error: 'La password deve avere almeno 6 caratteri' }), { status: 400 });
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: nome ? { nome } : undefined,
  });
  if (createError || !created?.user) {
    return new Response(JSON.stringify({ error: createError?.message || 'Creazione utente fallita' }), { status: 400 });
  }

  if (ruolo === 'admin') {
    await admin.from('profiles').update({ ruolo: 'admin' }).eq('id', created.user.id);
  }

  return new Response(JSON.stringify({ id: created.user.id, email, ruolo }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};
