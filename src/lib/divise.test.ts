import { describe, expect, it } from 'vitest';
import type { Divisa, RosterPlayer } from '../types/database';
import {
  creaBlocco,
  divisaInConflitto,
  erroreBlocco,
  nomeGiocatore,
  normalizzaNome,
  numeriDoppi,
  ordinaDivise,
  riepilogo,
  rosaSenzaDivisa,
  selezioneVisibile,
} from './divise';

let progressivo = 0;
function d(over: Partial<Divisa>): Divisa {
  progressivo += 1;
  return {
    id: `d${progressivo}`,
    gruppo: null,
    numero: 1,
    taglia: 'M',
    libero: false,
    roster_id: null,
    giocatore_nome: null,
    note: null,
    created_at: '',
    updated_at: '',
    ...over,
  };
}

function ragazzo(id: string, nome: string, cognome: string): RosterPlayer {
  return { id, nome, cognome } as RosterPlayer;
}

describe('normalizzaNome', () => {
  it('ignora maiuscole e spazi superflui', () => {
    expect(normalizzaNome('  Lorenzo   RICCADONNA ')).toBe('lorenzo riccadonna');
  });
});

describe('riepilogo', () => {
  it('conta per taglia e gruppo, con i liberi a parte', () => {
    const r = riepilogo([d({ taglia: 'M' }), d({ taglia: 'M', libero: true }), d({ taglia: 'L', gruppo: 'U17', giocatore_nome: 'A B' })]);
    expect(r.righe).toHaveLength(7);
    expect(r.righe.find((x) => x.taglia === 'M')!.celle.nessuno).toEqual({ totale: 2, libero: 1 });
    expect(r.righe.find((x) => x.taglia === 'L')!.celle.U17.totale).toBe(1);
    expect(r.righe.find((x) => x.taglia === 'L')!.celle.totale.totale).toBe(1);
    expect(r.totali.totale.totale).toBe(3);
    expect(r.totali.nessuno.libero).toBe(1);
    expect(r.assegnate).toBe(1);
    expect(r.libere).toBe(2);
  });
});

describe('numeriDoppi', () => {
  it('segnala lo stesso numero nello stesso gruppo e tipo', () => {
    const a = d({ gruppo: 'U17', numero: 7 });
    const b = d({ gruppo: 'U17', numero: 7 });
    expect(numeriDoppi([a, b])).toEqual(new Set([a.id, b.id]));
  });
  it('normale e libero con lo stesso numero non sono doppi', () => {
    expect(numeriDoppi([d({ gruppo: 'U17', numero: 7 }), d({ gruppo: 'U17', numero: 7, libero: true })]).size).toBe(0);
  });
  it('senza gruppo non segnala nulla', () => {
    expect(numeriDoppi([d({ numero: 7 }), d({ numero: 7 })]).size).toBe(0);
  });
});

describe('divisaInConflitto', () => {
  it('riconosce lo stesso nome scritto a mano in modo diverso', () => {
    const esistente = d({ giocatore_nome: 'Mario Rossi' });
    expect(divisaInConflitto([esistente], { id: null, roster_id: null, giocatore_nome: ' mario  ROSSI', libero: false })).toBe(esistente);
  });
  it('la divisa da libero non è in conflitto con quella normale', () => {
    const esistente = d({ giocatore_nome: 'Mario Rossi' });
    expect(divisaInConflitto([esistente], { id: null, roster_id: null, giocatore_nome: 'Mario Rossi', libero: true })).toBeUndefined();
  });
  it('la divisa stessa non è in conflitto con sé', () => {
    const esistente = d({ roster_id: 'r1', giocatore_nome: 'Mario Rossi' });
    expect(divisaInConflitto([esistente], { id: esistente.id, roster_id: 'r1', giocatore_nome: 'Mario Rossi', libero: false })).toBeUndefined();
  });
  it('riconosce lo stesso ragazzo della rosa', () => {
    const esistente = d({ roster_id: 'r1', giocatore_nome: 'Mario Rossi' });
    expect(divisaInConflitto([esistente], { id: null, roster_id: 'r1', giocatore_nome: 'Mario Rossi', libero: false })).toBe(esistente);
  });
  it('nome scritto a mano e poi lo stesso ragazzo scelto dalla rosa sono la stessa persona', () => {
    const aMano = d({ giocatore_nome: 'Mario Rossi' });
    expect(divisaInConflitto([aMano], { id: null, roster_id: 'r1', giocatore_nome: 'Mario Rossi', libero: false })).toBe(aMano);
  });
  it('ragazzo uscito dalla rosa e poi scritto a mano sono la stessa persona', () => {
    const fuoriRosa = d({ roster_id: 'r9', giocatore_nome: 'Mario Rossi' });
    expect(divisaInConflitto([fuoriRosa], { id: null, roster_id: null, giocatore_nome: 'mario rossi', libero: false })).toBe(fuoriRosa);
  });
  it('due ragazzi diversi della rosa con lo stesso nome non sono in conflitto', () => {
    const altro = d({ roster_id: 'r2', giocatore_nome: 'Mario Rossi' });
    expect(divisaInConflitto([altro], { id: null, roster_id: 'r1', giocatore_nome: 'Mario Rossi', libero: false })).toBeUndefined();
  });
  it('senza giocatore non c\'è conflitto', () => {
    expect(divisaInConflitto([d({})], { id: null, roster_id: null, giocatore_nome: null, libero: false })).toBeUndefined();
  });
});

describe('blocchi', () => {
  it('rifiuta un intervallo al contrario', () => {
    expect(erroreBlocco({ gruppo: null, da: 5, a: 3, taglia: 'M', libero: false })).not.toBeNull();
  });
  it('rifiuta numeri oltre il 99', () => {
    expect(erroreBlocco({ gruppo: null, da: 0, a: 100, taglia: 'M', libero: false })).not.toBeNull();
  });
  it('rifiuta numeri non interi', () => {
    expect(erroreBlocco({ gruppo: null, da: 1.5, a: 3, taglia: 'M', libero: false })).not.toBeNull();
  });
  it('accetta 1–14 e crea 14 divise', () => {
    const b = { gruppo: null, da: 1, a: 14, taglia: 'M' as const, libero: false };
    expect(erroreBlocco(b)).toBeNull();
    const righe = creaBlocco(b);
    expect(righe).toHaveLength(14);
    expect(righe.map((r) => r.numero)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    expect(righe[0]).toEqual({ gruppo: null, numero: 1, taglia: 'M', libero: false });
  });
});

describe('ordinaDivise', () => {
  it('ordina per gruppo, poi normali prima dei liberi, poi numero', () => {
    const lista = [
      d({ gruppo: 'U12-13', numero: 1 }),
      d({ gruppo: null, numero: 1 }),
      d({ gruppo: 'U17', numero: 9 }),
      d({ gruppo: 'U17', numero: 2, libero: true }),
      d({ gruppo: 'U17', numero: 3 }),
    ];
    expect(ordinaDivise(lista).map((x) => `${x.gruppo ?? '-'} ${x.numero}${x.libero ? 'L' : ''}`)).toEqual(['U17 3', 'U17 9', 'U17 2L', 'U12-13 1', '- 1']);
  });
});

describe('nomeGiocatore', () => {
  const rosa = [ragazzo('r1', 'Lorenzo', 'Riccadonna')];
  it('usa il nome attuale della rosa', () => {
    expect(nomeGiocatore(d({ roster_id: 'r1', giocatore_nome: 'Vecchio Nome' }), rosa)).toEqual({ nome: 'Lorenzo Riccadonna', fuoriRosa: false });
  });
  it('segna chi non è più in rosa', () => {
    expect(nomeGiocatore(d({ roster_id: 'r9', giocatore_nome: 'Mario Rossi' }), rosa)).toEqual({ nome: 'Mario Rossi', fuoriRosa: true });
  });
  it('nome scritto a mano', () => {
    expect(nomeGiocatore(d({ giocatore_nome: 'Luca Bianchi' }), rosa)).toEqual({ nome: 'Luca Bianchi', fuoriRosa: false });
  });
  it('divisa libera', () => {
    expect(nomeGiocatore(d({}), rosa)).toEqual({ nome: null, fuoriRosa: false });
  });
});

describe('rosaSenzaDivisa', () => {
  it('chi ha una divisa con il nome scritto a mano non è senza divisa', () => {
    const rosa = [ragazzo('r1', 'Lorenzo', 'Riccadonna'), ragazzo('r3', 'Aldo', 'Bianchi')];
    expect(rosaSenzaDivisa(rosa, [d({ giocatore_nome: 'lorenzo  riccadonna' })]).map((r) => r.id)).toEqual(['r3']);
  });
  it('chi ha solo la divisa da libero ha comunque una divisa', () => {
    const rosa = [ragazzo('r2', 'Zeno', 'Verdi'), ragazzo('r1', 'Lorenzo', 'Riccadonna'), ragazzo('r3', 'Aldo', 'Bianchi')];
    const divise = [d({ roster_id: 'r1', libero: true, giocatore_nome: 'Lorenzo Riccadonna' })];
    expect(rosaSenzaDivisa(rosa, divise).map((r) => r.id)).toEqual(['r3', 'r2']);
  });
});

describe('selezioneVisibile', () => {
  it('le azioni multiple valgono solo per le divise selezionate ancora visibili', () => {
    const a = d({}), b = d({}), c = d({});
    expect(selezioneVisibile(new Set([a.id, b.id, 'cancellata']), [b, c])).toEqual([b.id]);
  });
});
