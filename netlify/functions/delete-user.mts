import type { Context } from '@netlify/functions';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL as string;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

async function supabaseFetch(path: string, init: RequestInit) {
  return fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
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
    return new Response(JSON.stringify({ error: 'Solo un admin può eliminare utenti' }), { status: 403 });
  }

  let body: { id?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Corpo della richiesta non valido' }), { status: 400 });
  }

  const targetId = (body.id || '').trim();
  if (!targetId) {
    return new Response(JSON.stringify({ error: 'ID utente mancante' }), { status: 400 });
  }
  if (targetId === caller.id) {
    return new Response(JSON.stringify({ error: 'Non puoi eliminare il tuo stesso account' }), { status: 400 });
  }

  const deleteRes = await supabaseFetch(`/auth/v1/admin/users/${targetId}`, { method: 'DELETE' });
  if (!deleteRes.ok) {
    const errBody = (await deleteRes.json().catch(() => ({}))) as { msg?: string; message?: string };
    return new Response(JSON.stringify({ error: errBody.msg || errBody.message || 'Eliminazione fallita' }), { status: 400 });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};
