import { CategoriaTag } from './CategoriaTag';
import { isGiustificata, MOTIVI_ASSENZA } from '../../lib/assenze';
import type { RosterPlayer } from '../../types/database';

export type AttendanceState = 'presente' | 'assente' | 'unset';

interface AttendanceRowProps {
  player: RosterPlayer;
  state: AttendanceState;
  ritardo: boolean;
  motivo: string | undefined;
  onSetState: (state: AttendanceState) => void;
  onToggleRitardo: (checked: boolean) => void;
  onSetMotivo: (motivo: string) => void;
}

export function AttendanceRow({
  player, state, ritardo, motivo, onSetState, onToggleRitardo, onSetMotivo,
}: AttendanceRowProps) {
  const stateClass = state === 'presente'
    ? 'is-presente'
    : state === 'assente'
      ? (isGiustificata(motivo) ? 'is-assente-giustificata' : 'is-assente-non-giustificata')
      : '';
  return (
    <div className={`attendance-row${stateClass ? ` ${stateClass}` : ''}`}>
      <div className="attendance-name">
        {player.numero ?? ''} {player.cognome} {player.nome}
        <CategoriaTag dataNascita={player.data_nascita} soloU15={player.solo_u15} />
      </div>
      <div className="attendance-controls">
        {state !== 'assente' && (
          <label className="chk small">
            <input
              type="checkbox"
              checked={state === 'presente'}
              onChange={(e) => onSetState(e.target.checked ? 'presente' : 'unset')}
            />
            Presente
          </label>
        )}
        {state !== 'presente' && (
          <label className="chk small">
            <input
              type="checkbox"
              checked={state === 'assente'}
              onChange={(e) => onSetState(e.target.checked ? 'assente' : 'unset')}
            />
            Assente
          </label>
        )}
        {state === 'presente' && (
          <label className="chk small">
            <input type="checkbox" checked={ritardo} onChange={(e) => onToggleRitardo(e.target.checked)} />
            Ritardo
          </label>
        )}
        {state === 'assente' && (
          <select className="attendance-motivo" value={motivo || ''} onChange={(e) => onSetMotivo(e.target.value)}>
            <option value="">Motivo assenza…</option>
            {MOTIVI_ASSENZA.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}
