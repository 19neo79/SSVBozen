import type { Context } from '@netlify/functions';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL as string;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

// Chiamate dirette alle API REST/Auth di Supabase invece del client @supabase/supabase-js:
// il client completo inizializza anche il canale Realtime (WebSocket), che sull'runtime
// Node delle Netlify Functions manca del WebSocket nativo e fa crashare la funzione.
async function supabaseFetch(path: string, init: RequestInit) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
  return res;
}

export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Metodo non consentito' }), { status: 405 });
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: 'Configurazione server incompleta' }), { status: 500 });
  }

  const authHeader = req.headers.get('authorization') || '';
  const callerToken = authHeader.replace(/^Bearer\s+/i, '');
  if (!callerToken) {
    return new Response(JSON.stringify({ error: 'Non autenticato' }), { status: 401 });
  }

  const callerRes = await supabaseFetch('/auth/v1/user', {
    headers: { Authorization: `Bearer ${callerToken}` },
  });
  if (!callerRes.ok) {
    return new Response(JSON.stringify({ error: 'Sessione non valida' }), { status: 401 });
  }
  const caller = (await callerRes.json()) as { id: string };

  const profileRes = await supabaseFetch(`/rest/v1/profiles?id=eq.${caller.id}&select=ruolo`, {
    method: 'GET',
  });
  const profileRows = (await profileRes.json()) as { ruolo?: string }[];
  if (!profileRes.ok || profileRows[0]?.ruolo !== 'admin') {
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

  const createRes = await supabaseFetch('/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: nome ? { nome } : undefined,
    }),
  });
  const created = (await createRes.json()) as { id?: string; msg?: string; error_description?: string; message?: string };
  if (!createRes.ok || !created.id) {
    const message = created.msg || created.error_description || created.message || 'Creazione utente fallita';
    return new Response(JSON.stringify({ error: message }), { status: 400 });
  }

  if (ruolo === 'admin') {
    await supabaseFetch(`/rest/v1/profiles?id=eq.${created.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ ruolo: 'admin' }),
    });
  }

  return new Response(JSON.stringify({ id: created.id, email, ruolo }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};
