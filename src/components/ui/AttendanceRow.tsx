import { CategoriaTag } from './CategoriaTag';
import { MOTIVI_ASSENZA } from '../../lib/assenze';
import type { RosterPlayer } from '../../types/database';

interface AttendanceRowProps {
  player: RosterPlayer;
  presente: boolean;
  ritardo: boolean;
  motivo: string | undefined;
  onTogglePresente: (checked: boolean) => void;
  onToggleRitardo: (checked: boolean) => void;
  onSetMotivo: (motivo: string) => void;
}

export function AttendanceRow({
  player, presente, ritardo, motivo, onTogglePresente, onToggleRitardo, onSetMotivo,
}: AttendanceRowProps) {
  return (
    <div className="attendance-row">
      <div className="attendance-name">
        {player.numero ?? ''} {player.cognome} {player.nome}
        <CategoriaTag dataNascita={player.data_nascita} soloU15={player.solo_u15} />
      </div>
      <div className="attendance-controls">
        <label className="chk small">
          <input type="checkbox" checked={presente} onChange={(e) => onTogglePresente(e.target.checked)} />
          Presente
        </label>
        <label className={`chk small${presente ? '' : ' disabled'}`}>
          <input type="checkbox" checked={ritardo} disabled={!presente} onChange={(e) => onToggleRitardo(e.target.checked)} />
          Ritardo
        </label>
        {!presente && (
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
