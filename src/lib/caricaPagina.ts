import { lazy, type ComponentType } from 'react';

const CHIAVE = 'ssv-ricarica-dopo-aggiornamento';

/**
 * Pagina caricata solo quando serve. Se dopo una pubblicazione il pezzo vecchio non esiste più
 * (la scheda era aperta sulla versione precedente), ricarica una volta la pagina per prendere quella nuova.
 */
export function caricaPagina<T extends ComponentType<object>>(importa: () => Promise<{ default: T }>) {
  return lazy(async () => {
    try {
      const modulo = await importa();
      sessionStorage.removeItem(CHIAVE);
      return modulo;
    } catch (e) {
      if (!sessionStorage.getItem(CHIAVE)) {
        sessionStorage.setItem(CHIAVE, '1');
        window.location.reload();
        return new Promise<never>(() => {});
      }
      throw e;
    }
  });
}
