import { describe, expect, it } from 'vitest';
import type { Divisa, GruppoDivisa, RosterPlayer } from '../types/database';
import { isoToItalian, todayISO } from './dates';
import { filtraPerGruppi, testoWhatsAppDivise } from './esportaDivise';

let progressivo = 0;
function d(over: Partial<Divisa>): Divisa {
  progressivo += 1;
  return {
    id: `d${progressivo}`, gruppo: null, numero: 1, taglia: 'M', libero: false, roster_id: null,
    giocatore_nome: null, note: null, created_at: '', updated_at: '', ...over,
  };
}

const rosa = [{ id: 'r1', nome: 'Mario', cognome: 'Rossi' } as RosterPlayer];

describe('filtraPerGruppi', () => {
  it('tiene solo i gruppi scelti, "da assegnare" compreso', () => {
    const lista = [d({ gruppo: 'U17' }), d({ gruppo: 'U12-13' }), d({ gruppo: null })];
    expect(filtraPerGruppi(lista, new Set<GruppoDivisa | null>(['U17', null])).map((x) => x.gruppo)).toEqual(['U17', null]);
  });
});

describe('testoWhatsAppDivise', () => {
  it('raggruppa per gruppo, segna libero, liberi e note; gruppo vuoto e gruppi non scelti', () => {
    const lista = [
      d({ gruppo: 'U17', numero: 7, taglia: 'M', roster_id: 'r1', giocatore_nome: 'Mario Rossi' }),
      d({ gruppo: 'U17', numero: 3, taglia: 'S', libero: true, giocatore_nome: 'Luca Bianchi', note: 'pantaloncino rovinato' }),
      d({ gruppo: 'U17', numero: 12, taglia: 'L' }),
      d({ gruppo: 'U17', numero: 9, taglia: 'XL', roster_id: 'r9', giocatore_nome: 'Paolo Neri' }),
      d({ gruppo: 'U12-13', numero: 1 }),
    ];
    const testo = testoWhatsAppDivise(lista, rosa, new Set<GruppoDivisa | null>(['U17', null]));
    expect(testo).toBe(
      [
        `*Divise SSV Bozen Maschile* · ${isoToItalian(todayISO())}`,
        '',
        '*U17* (4)',
        '7 · M · Mario Rossi',
        '9 · XL · Paolo Neri (non più in rosa)',
        '12 · L · libera',
        '3 · S · LIBERO · Luca Bianchi — pantaloncino rovinato',
        '',
        '*Da assegnare* (0)',
        'nessuna divisa',
      ].join('\n'),
    );
  });
});
