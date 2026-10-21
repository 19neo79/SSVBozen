# Gestione divise SSV Bozen Maschile — progetto

Data: 21/10/2026 · Stato: da approvare

## Obiettivo

Una sezione **Divise** per sapere quali divise ha la società, di che taglia sono, a quale set (gruppo) appartengono e
quale ragazzo ce l'ha. Con un clic si esporta l'elenco, filtrato per gruppo, in Excel o come testo per WhatsApp.

Richiesto da Manuel (admin). Uso tipico:
1. inserire le divise in magazzino, anche **senza gruppo**;
2. guardare il **riepilogo per taglia** (quante S, M, L…);
3. distribuirle nei tre gruppi e assegnarle ai ragazzi;
4. esportare l'elenco per gruppo.

## Cosa è una divisa

Un pezzo unico: **maglia con numero + pantaloncino della stessa taglia**, assegnati insieme.

| Campo | Valori | Obbligatorio |
|---|---|---|
| Gruppo | U17 · U14-15 · U12-13 · *(vuoto = da assegnare)* | no |
| Numero | intero 0–99 | sì |
| Taglia | XS · S · M · L · XL · XXL · 3XL | sì |
| Da libero | sì / no (maglia di colore diverso) | sì, default no |
| Giocatore | dalla rosa, oppure nome scritto a mano | no (vuoto = divisa libera) |
| Note | testo libero ("pantaloncino rovinato"…) | no |

I tre gruppi esistono **solo in questa sezione** e non cambiano le categorie U14/U15 del resto dell'app.
Il gruppo è il set a cui appartiene la maglia, non il campionato in cui gioca il ragazzo: chi gioca in più
campionati usa sempre la stessa divisa.

## Regole

- **Ogni ragazzo ha al massimo una divisa normale e una da libero.** Nient'altro è ammesso.
  - Ragazzo della rosa: vincolo nel database (`unique (roster_id, libero)`).
  - Nome scritto a mano: confronto senza maiuscole né spazi superflui, controllato nell'app e nel database
    (indice univoco su `lower(trim(giocatore_nome)), libero` per le divise senza `roster_id`).
  - Se nel form scegli un ragazzo che ha già una divisa dello stesso tipo, l'app mostra
    "Lorenzo ha già la n. 7, taglia M, U14-15" e propone **Sposta qui**: la vecchia divisa torna libera.
- **Numeri doppi**: due divise con lo stesso numero, stesso gruppo e stesso tipo (normale/libero) → **avviso**,
  non blocco. Senza gruppo non c'è nessun avviso: all'inizio il magazzino può avere numeri ripetuti.
- **Ragazzo tolto dalla rosa**: la divisa conserva il nome (salvato insieme al collegamento) e viene segnata
  "non più in rosa", così si sa che va restituita.
- **Chi può accedere: solo gli admin.** Menu, pagina (`RequireAdmin`) e database (RLS `my_role() = 'admin'`
  per lettura e scrittura, nessun accesso per anon e allenatori).

## La pagina `/app/divise`

### Riepilogo (in alto)
Una tabella con le **taglie sulle righe** e i **gruppi sulle colonne**: U17 · U14-15 · U12-13 · Da assegnare · Totale.
Ogni cella mostra il totale e, se ci sono, quante sono da libero (es. "8 · 2 lib.").
Sotto la tabella:
- assegnate / libere;
- **"Ragazzi della rosa senza divisa: N"**, cliccabile per vedere chi sono.

### Elenco
- **Filtri:** gruppo (inclusi "Da assegnare" e "Tutti"), taglia, normale/libero, assegnata/libera, più una ricerca
  per nome o numero.
- **Ogni riga mostra:** numero grande, taglia, gruppo, etichetta "Libero", giocatore oppure "Libera", note
  abbreviate, avviso se il numero è doppio.
- **Ordine:** gruppo, poi libero, poi numero.
- **Clic su una riga** → popup di modifica.
- **Selezione multipla con caselle:** **Sposta in gruppo…** (U17 / U14-15 / U12-13 / Da assegnare),
  **Togli giocatore**, **Elimina** (con conferma).

### Pulsanti
- **+ Divisa**: popup con i campi della tabella sopra.
  - Il giocatore si sceglie con un campo che suggerisce i ragazzi della rosa; accanto a chi ha già una divisa
    compare il numero.
  - Se il ragazzo non è in rosa, il nome si scrive a mano.
- **+ A blocchi**: gruppo (facoltativo), dal numero, al numero, taglia, da libero.
  - Mostra l'anteprima ("Creo 14 divise: n. 1–14, taglia M, da assegnare"), poi crea tutto in un colpo.
- **Esporta**: popup con la scelta dei gruppi (caselle, incluso "Da assegnare") e due uscite:
  - **Excel (.xlsx)**: un foglio *Divise* con le colonne Gruppo, Numero, Taglia, Libero, Giocatore, Note, e un
    foglio *Riepilogo* con la tabella taglie × gruppi;
  - **WhatsApp**: testo raggruppato per gruppo, una riga per divisa ("7 · M · Lorenzo Riccadonna"; le maglie da
    libero sono segnate), con pulsante Copia e anteprima.

## Dati

Nuova tabella `divise` (migrazione `20261021_divise.sql`):

```
id uuid pk default gen_random_uuid()
gruppo text null check (gruppo in ('U17','U14-15','U12-13'))
numero int not null check (numero between 0 and 99)
taglia text not null check (taglia in ('XS','S','M','L','XL','XXL','3XL'))
libero boolean not null default false
roster_id uuid null references roster(id) on delete set null
giocatore_nome text null      -- sempre valorizzato quando c'è un giocatore (anche dalla rosa)
note text null
created_at timestamptz default now()
updated_at timestamptz default now()
unique (roster_id, libero)
unique index su (lower(trim(giocatore_nome)), libero) where roster_id is null and giocatore_nome is not null
```

RLS: select/insert/update/delete solo `my_role() = 'admin'`; `revoke all on divise from anon`.

Con `on delete set null` sul collegamento alla rosa, quando un ragazzo viene eliminato la divisa resta con il suo
nome e senza `roster_id`. Se esiste già una divisa a mano con lo stesso nome e tipo, il vincolo dei nomi può
impedire la cancellazione dalla rosa. Caso rarissimo: l'app lo segnala con un messaggio chiaro.

## File

| File | Contenuto |
|---|---|
| `supabase/migrations/20261021_divise.sql` | tabella, vincoli, RLS |
| `src/types/database.ts` | tipi `Divisa`, `GruppoDivisa`, `TagliaDivisa` |
| `src/lib/divise.ts` | costanti (gruppi, taglie), `riepilogo()`, `numeriDoppi()`, `normalizzaNome()`, `divisaDiGiocatore()`, `creaBlocco()` |
| `src/lib/esportaDivise.ts` | `scaricaExcelDivise()`, `testoWhatsAppDivise()` (stesso stile di `esportaAtleti.ts`) |
| `src/hooks/useDivise.ts` | lettura, salvataggio, salvataggio a blocchi, spostamento di gruppo, eliminazione (React Query, come `useRoster.ts`) |
| `src/pages/DivisePage.tsx` | pagina: riepilogo, filtri, elenco, selezione |
| `src/components/FormDivisa.tsx`, `BloccoDivise.tsx`, `EsportaDivise.tsx` | i tre popup |
| `src/App.tsx`, `ProtectedLayout.tsx`, `src/index.css` | rotta con `RequireAdmin`, voce di menu solo admin, stili |

## Verifiche

- `npx tsc -p tsconfig.app.json` e `npm run build`.
- **Prova nel browser con dati di prova, cancellati alla fine:**
  - inserimento singolo e a blocchi;
  - riepilogo corretto;
  - spostamento di gruppo multiplo;
  - avviso per i numeri doppi;
  - regola una normale + una da libero (blocco e "Sposta qui");
  - ragazzo eliminato dalla rosa → il nome resta;
  - esportazione Excel (file letto e controllato) e WhatsApp.
- **Permessi:** con l'utente anonimo una query su `divise` non restituisce righe.
- Prima di pubblicare: **esempio della pagina da mostrare a Manuel**.

## Fuori da questo progetto

Cauzioni, date di consegna e restituzione, storico dei passaggi, taglie da bambino, import da Excel.
Si possono aggiungere dopo.
