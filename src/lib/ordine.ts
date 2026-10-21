/** Ordine dei ragazzi in tutti gli elenchi: cognome, poi nome (il numero di maglia segue la divisa e cambia). */
export function perCognomeNome(a: { cognome: string; nome: string }, b: { cognome: string; nome: string }): number {
  return a.cognome.localeCompare(b.cognome, 'it') || a.nome.localeCompare(b.nome, 'it');
}
