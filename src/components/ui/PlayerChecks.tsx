import type { RosterPlayer } from '../../types/database';

interface PlayerChecksProps {
  players: RosterPlayer[];
  selected: string[];
  onChange: (ids: string[]) => void;
  emptyMessage?: string;
}

export function PlayerChecks({ players, selected, onChange, emptyMessage }: PlayerChecksProps) {
  const sorted = [...players].sort((a, b) => (a.numero ?? 99) - (b.numero ?? 99));

  if (sorted.length === 0) {
    return <span className="muted">{emptyMessage || 'Nessun giocatore in rosa — aggiungili prima nella Rosa.'}</span>;
  }

  function toggle(id: string) {
    if (selected.includes(id)) onChange(selected.filter((x) => x !== id));
    else onChange([...selected, id]);
  }

  return (
    <div className="checks">
      {sorted.map((p) => (
        <label className="chk" key={p.id}>
          <input type="checkbox" checked={selected.includes(p.id)} onChange={() => toggle(p.id)} />
          {p.numero ?? ''} {p.cognome} {p.nome}
        </label>
      ))}
    </div>
  );
}

export function SelectAllButton({
  players,
  selected,
  onChange,
}: {
  players: RosterPlayer[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  function toggleAll() {
    if (selected.length === players.length) onChange([]);
    else onChange(players.map((p) => p.id));
  }
  return (
    <button type="button" className="btn ghost small" onClick={toggleAll}>
      Seleziona/deseleziona tutti
    </button>
  );
}
