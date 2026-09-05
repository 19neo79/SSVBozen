# SSV Bozen Volley — Gestione Squadre

App di gestione per il gruppo Under 14-15 di SSV Bozen Volley: rosa, palestre, avversari,
allenamenti (con generazione ricorrente lun/mer/ven), partite di weekend, foglio settimanale
stampabile e una pagina pubblica senza login pensata per essere condivisa su WhatsApp.

Stack: React + Vite + TypeScript, Supabase (Auth + Postgres + RLS), deploy su Netlify.

## Setup locale

```bash
npm install
cp .env.example .env.local   # poi inserisci URL e publishable key del progetto Supabase
npm run dev
```

Le variabili d'ambiente richieste (vedi `.env.example`):

- `VITE_SUPABASE_URL` — URL del progetto Supabase
- `VITE_SUPABASE_PUBLISHABLE_KEY` — chiave pubblica (sicura da esporre nel browser, protetta dalle policy RLS)

## Ruoli e accessi

- **allenatore**: Allenamenti, Weekend, Piano settimanale, Statistiche, Rosa (sola lettura).
- **admin**: tutto quanto sopra più Rosa modificabile, Palestre, Avversari, Impostazioni.

Un admin può creare nuovi utenti direttamente da **Impostazioni → Utenti e ruoli → + Nuovo
utente** (email, password iniziale, ruolo) e promuovere/retrocedere gli utenti esistenti dalla
stessa pagina. In alternativa restano disponibili Supabase Dashboard → Authentication → Add user
(nasce come `allenatore`, va promosso via SQL) o direttamente via SQL Editor:

```sql
update profiles set ruolo = 'admin' where id = '<uuid-utente>';
```

### Creazione utenti da Impostazioni (Netlify Function)

La creazione utenti dalla UI usa una Netlify Function (`netlify/functions/create-user.mts`) che
gira lato server con la **service role key** di Supabase — non deve mai finire nel bundle del
frontend. Richiede una variabile d'ambiente aggiuntiva, solo su Netlify (non in `.env.local`,
altrimenti Vite la includerebbe nel codice del browser):

- `SUPABASE_SERVICE_ROLE_KEY` — da Supabase Dashboard → Settings → API Keys → "Secret keys" (NON
  la publishable key). Impostala in **Site settings → Environment variables** su Netlify, senza il
  prefisso `VITE_`.

La funzione verifica lato server che chi chiama sia un admin autenticato prima di creare l'utente.

## Pagina pubblica

`/programma` non richiede login e mostra solo il piano della settimana corrente (allenamenti +
partite), leggendo dalle viste `public_*` già presenti nello schema. Pensata per essere linkata
nel gruppo WhatsApp dei genitori.

## Sicurezza del database

Lo schema Supabase esisteva già (tabelle, RLS, viste pubbliche) prima di questo progetto. Durante
lo sviluppo sono stati individuati e corretti due problemi (vedi
`supabase/migrations/20260905_security_fixes.sql`, applicato manualmente via SQL Editor):

1. La policy `profiles_update_self` permetteva a un utente di cambiare il proprio `ruolo` (quindi
   auto-promuoversi ad admin). Aggiunta una clausola `WITH CHECK` che blocca la modifica del ruolo
   da parte dell'utente stesso, più una policy dedicata che permette solo agli admin di cambiare i
   ruoli altrui.
2. Le viste pubbliche (`public_roster_basic`, `public_venues_basic`, `public_trainings`,
   `public_matches`, `public_campi_avversari_basic`) avevano permessi di scrittura
   (`INSERT/UPDATE/DELETE/TRUNCATE`) concessi a `anon`/`authenticated` oltre a `SELECT`. Essendo
   viste di proprietà del owner delle tabelle, bypassano le RLS delle tabelle sottostanti: un
   visitatore anonimo della pagina pubblica avrebbe potuto modificare i dati. Ora hanno solo
   `SELECT`.

Se in futuro ricrei lo schema da zero, applica anche questa migrazione.

## Build e deploy (Netlify)

```bash
npm run build   # tsc -b && vite build, output in dist/
```

`netlify.toml` è già configurato con il redirect SPA (`/* → /index.html`) necessario per il
routing lato client. Su Netlify, imposta le variabili d'ambiente in **Site settings → Environment
variables** prima del primo deploy:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (vedi sopra — necessaria solo per la creazione utenti da UI)
