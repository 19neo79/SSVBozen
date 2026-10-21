import { describe, expect, it } from 'vitest';
import { perCognomeNome } from './ordine';

describe('perCognomeNome', () => {
  it('ordina per cognome, poi per nome, senza guardare il numero di maglia', () => {
    const lista = [
      { cognome: 'Rossi', nome: 'Mario', numero: 1 },
      { cognome: 'Bianchi', nome: 'Luca', numero: 9 },
      { cognome: 'Rossi', nome: 'Andrea', numero: 2 },
      { cognome: 'Àlber', nome: 'Zeno', numero: null },
    ];
    expect([...lista].sort(perCognomeNome).map((p) => `${p.cognome} ${p.nome}`)).toEqual(['Àlber Zeno', 'Bianchi Luca', 'Rossi Andrea', 'Rossi Mario']);
  });
});
