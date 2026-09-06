export type MotivoAssenza = 'infortunio' | 'malattia' | 'scuola' | 'impegni_familiari' | 'non_giustificata' | 'altro';

export const MOTIVI_ASSENZA: { value: MotivoAssenza; label: string }[] = [
  { value: 'infortunio', label: 'Infortunio' },
  { value: 'malattia', label: 'Malattia' },
  { value: 'scuola', label: 'Scuola' },
  { value: 'impegni_familiari', label: 'Impegni familiari' },
  { value: 'non_giustificata', label: 'Non giustificata' },
  { value: 'altro', label: 'Altro' },
];

export function motivoLabel(m: string | undefined): string {
  if (!m) return 'Non specificato';
  return MOTIVI_ASSENZA.find((x) => x.value === m)?.label || 'Non specificato';
}

/** Un'assenza si considera giustificata se e' stato indicato un motivo diverso da "non_giustificata". */
export function isGiustificata(m: string | undefined): boolean {
  return !!m && m !== 'non_giustificata';
}
