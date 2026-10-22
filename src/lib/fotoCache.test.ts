import { describe, expect, it } from 'vitest';
import { DURATA_URL_SEC, aggiornaCache, dividiPercorsi } from './fotoCache';

const ORA = 1_000_000_000_000;
const ORA_MS = 60 * 60 * 1000;

describe('dividiPercorsi', () => {
  it('riusa i link validi ancora per più di un\'ora e chiede gli altri', () => {
    const cache = {
      'a/volto.jpg': { url: 'https://x/a', scade: ORA + 5 * ORA_MS },
      'b/volto.jpg': { url: 'https://x/b', scade: ORA + 30 * 60 * 1000 },
    };
    expect(dividiPercorsi(cache, ['a/volto.jpg', 'b/volto.jpg', 'c/volto.jpg'], ORA)).toEqual({
      pronti: { 'a/volto.jpg': 'https://x/a' },
      daChiedere: ['b/volto.jpg', 'c/volto.jpg'],
    });
  });
});

describe('aggiornaCache', () => {
  it('aggiunge i nuovi link con scadenza a 24 ore e toglie quelli scaduti', () => {
    const cache = { vecchio: { url: 'https://x/v', scade: ORA - 1 }, buono: { url: 'https://x/b', scade: ORA + ORA_MS * 10 } };
    expect(aggiornaCache(cache, [{ path: 'nuovo', url: 'https://x/n' }], ORA)).toEqual({
      buono: { url: 'https://x/b', scade: ORA + ORA_MS * 10 },
      nuovo: { url: 'https://x/n', scade: ORA + DURATA_URL_SEC * 1000 },
    });
  });
});
