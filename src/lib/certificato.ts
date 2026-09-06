export type CertStatus = 'assente' | 'scaduto' | 'in-scadenza' | 'valido';

/** Stato del certificato medico: scaduto, in scadenza entro soonDays giorni, valido, o assente. */
export function certStatusFor(certificato: string | null, today: Date = new Date(), soonDays = 30): CertStatus {
  if (!certificato) return 'assente';
  const cd = new Date(certificato + 'T00:00:00');
  const soon = new Date(today);
  soon.setDate(soon.getDate() + soonDays);
  if (cd < today) return 'scaduto';
  if (cd < soon) return 'in-scadenza';
  return 'valido';
}
