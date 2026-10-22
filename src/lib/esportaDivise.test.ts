import { describe, expect, it } from 'vitest';
import type { Divisa, GruppoDivisa, RosterPlayer } from '../types/database';
import { isoToItalian, todayISO } from './dates';
import { filtraPerGruppi, nomeFileDivise, righeRiepilogoExcel, testoWhatsAppDivise } from './esportaDivise';

let progressivo = 0;
function d(over: Partial<Divisa>): Divisa {
  progressivo += 1;
  return {
    id: `d${progressivo}`, gruppo: null, numero: 1, taglia: 'M', libero: false, pantaloncino: false, roster_id: null,
    giocatore_nome: null, note: null, consegnata_il: null, created_at: '', updated_at: '', ...over,
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
      d({ gruppo: 'U17', numero: 7, taglia: 'M', roster_id: 'r1', giocatore_nome: 'Mario Rossi', pantaloncino: true, consegnata_il: '2026-10-22T10:35:00Z' }),
      d({ gruppo: 'U17', numero: 3, taglia: 'S', libero: true, giocatore_nome: 'Luca Bianchi', note: 'pantaloncino rovinato', pantaloncino: true }),
      d({ gruppo: 'U17', numero: 12, taglia: 'L' }),
      d({ gruppo: 'U17', numero: 9, taglia: 'XL', roster_id: 'r9', giocatore_nome: 'Paolo Neri', pantaloncino: true }),
      d({ gruppo: 'U12-13', numero: 1 }),
    ];
    const testo = testoWhatsAppDivise(lista, rosa, new Set<GruppoDivisa | null>(['U17', null]));
    expect(testo).toBe(
      [
        `*Divise SSV Bozen Maschile* · ${isoToItalian(todayISO())}`,
        'Maglie 4 · Pantaloncini 3',
        '',
        '*U17* (4 maglie, 3 pantaloncini)',
        '7 · M · Mario Rossi · consegnata 22/10',
        '9 · XL · Paolo Neri (non più in rosa)',
        '12 · L · libera · senza pantaloncino',
        '3 · S · LIBERO · Luca Bianchi — pantaloncino rovinato',
        '',
        '*Da assegnare* (0 maglie, 0 pantaloncini)',
        'nessuna divisa',
      ].join('\n'),
    );
  });
});

describe('righeRiepilogoExcel', () => {
  it('mostra solo le colonne dei gruppi scelti, più il totale', () => {
    const righe = righeRiepilogoExcel(
      [d({ gruppo: 'U17', taglia: 'M', libero: true }), d({ gruppo: 'U17', taglia: 'M', pantaloncino: true }), d({ gruppo: 'U12-13', taglia: 'M' })],
      new Set<GruppoDivisa | null>(['U17']),
    );
    expect(righe[0]).toEqual(['Taglia', 'U17 maglie', 'di cui libero', 'U17 pantaloncini', 'Totale maglie', 'di cui libero', 'Totale pantaloncini']);
    expect(righe.find((r) => r[0] === 'M')).toEqual(['M', 2, 1, 1, 2, 1, 1]);
    expect(righe[righe.length - 1]).toEqual(['Totale', 2, 1, 1, 2, 1, 1]);
    expect(righe).toHaveLength(6);
  });
});

describe('nomeFileDivise', () => {
  it('nomi leggibili per i gruppi scelti', () => {
    expect(nomeFileDivise(new Set<GruppoDivisa | null>(['U17', null]))).toBe(`Divise_U17_Da_assegnare_${todayISO()}.xlsx`);
    expect(nomeFileDivise(new Set<GruppoDivisa | null>(['U17', 'U14-15', 'U12-13', null]))).toBe(`Divise_Tutte_${todayISO()}.xlsx`);
  });
});
