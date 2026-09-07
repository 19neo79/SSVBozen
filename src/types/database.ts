export type Ruolo = 'allenatore' | 'admin';
export type Categoria = 'U14' | 'U15';
export type CasaTrasferta = 'Casa' | 'Trasferta';
export type Giorno = 'lun' | 'mer' | 'ven';

export interface Profile {
  id: string;
  nome: string | null;
  email: string | null;
  ruolo: Ruolo;
  created_at: string;
}

export interface Venue {
  id: string;
  nome: string;
  indirizzo: string | null;
  cap: string | null;
  citta: string | null;
  provincia: string | null;
  avversario_id: string | null;
  created_at: string;
}

export interface Avversario {
  id: string;
  nome: string;
  categoria: Categoria;
  responsabile: string | null;
  telefono_responsabile: string | null;
  email_responsabile: string | null;
  created_at: string;
}

export interface RosterPlayer {
  id: string;
  nome: string;
  cognome: string;
  numero: number | null;
  data_nascita: string | null;
  codice_fiscale: string | null;
  ruolo: string | null;
  telefono_atleta: string | null;
  nome_papa: string | null;
  telefono_papa: string | null;
  nome_mamma: string | null;
  telefono_mamma: string | null;
  certificato: string | null;
  created_at: string;
}

export interface Training {
  id: string;
  data: string;
  orario: string;
  venue_id: string | null;
  palestra_custom: string | null;
  convocati: string[];
  presenze: string[];
  ritardi: string[];
  motivi_assenza: Record<string, string>;
  created_at: string;
}

export interface Match {
  id: string;
  data: string;
  orario: string;
  casa_trasferta: CasaTrasferta;
  categoria: Categoria;
  avversario: string;
  avversario_id: string | null;
  venue_id: string | null;
  luogo_custom: string | null;
  convocati: string[];
  presenze: string[];
  ritardi: string[];
  motivi_assenza: Record<string, string>;
  created_at: string;
}

export interface Settings {
  id: number;
  club_name: string;
  logo_url: string | null;
}

export interface RecurringDefault {
  giorno: Giorno;
  orario: string | null;
  venue_id: string | null;
  palestra_custom: string | null;
}

// ---------- public (unauthenticated) views ----------

export interface PublicSettingsBasic {
  club_name: string;
  logo_url: string | null;
}

export interface PublicRosterBasic {
  id: string;
  nome: string;
  cognome: string;
  numero: number | null;
}

export interface PublicVenueBasic {
  id: string;
  nome: string;
  indirizzo: string | null;
  cap: string | null;
  citta: string | null;
  provincia: string | null;
}

export interface PublicTraining {
  id: string;
  data: string;
  orario: string;
  venue_id: string | null;
  palestra_custom: string | null;
  convocati: string[];
}

export interface PublicMatch {
  id: string;
  data: string;
  orario: string;
  casa_trasferta: CasaTrasferta;
  categoria: Categoria;
  avversario: string;
  venue_id: string | null;
  luogo_custom: string | null;
  convocati: string[];
}
