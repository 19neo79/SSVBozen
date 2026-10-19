export const EVENTO_NUOVA_VERSIONE = 'ssv-nuova-versione';

let registrazione: ServiceWorkerRegistration | null = null;

function avvisa() {
  window.dispatchEvent(new Event(EVENTO_NUOVA_VERSIONE));
}

/**
 * Registra il service worker e controlla gli aggiornamenti all'apertura, quando l'app torna visibile
 * e ogni ora. Il nuovo service worker resta in attesa finché non riceve SKIP_WAITING: avvisiamo la
 * pagina invece di ricaricare d'imperio, così non si perdono i moduli in compilazione.
 */
export function registraAggiornamenti() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).then((reg) => {
      registrazione = reg;
      if (reg.waiting && navigator.serviceWorker.controller) avvisa();
      reg.addEventListener('updatefound', () => {
        const nuovo = reg.installing;
        nuovo?.addEventListener('statechange', () => {
          if (nuovo.state === 'installed' && navigator.serviceWorker.controller) avvisa();
        });
      });
      const controlla = () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {});
      };
      document.addEventListener('visibilitychange', controlla);
      setInterval(controlla, 60 * 60 * 1000);
    }).catch(() => {});
  });
}

/** Attiva la versione in attesa e ricarica la pagina appena prende il controllo. */
export function applicaAggiornamento() {
  const inAttesa = registrazione?.waiting;
  if (!inAttesa) {
    window.location.reload();
    return;
  }
  navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true });
  inAttesa.postMessage({ type: 'SKIP_WAITING' });
}
