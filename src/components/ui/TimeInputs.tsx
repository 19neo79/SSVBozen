const ORE = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTI = ['00', '15', '30', '45'];

function snapToStep(mm: string): string {
  const n = Number(mm) || 0;
  const steps = [0, 15, 30, 45];
  let best = 0;
  let diff = 999;
  steps.forEach((s) => {
    const d = Math.abs(s - n);
    if (d < diff) {
      diff = d;
      best = s;
    }
  });
  return String(best).padStart(2, '0');
}

interface TimeRangeInputProps {
  value: string; // "HH:MM–HH:MM"
  onChange: (value: string) => void;
}

export function TimeRangeInput({ value, onChange }: TimeRangeInputProps) {
  let start = '18:00';
  let end = '19:30';
  if (value) {
    const parts = value.split(/[–-]/).map((s) => s.trim()).filter(Boolean);
    if (parts[0]) start = parts[0];
    if (parts[1]) end = parts[1];
  }
  const [sh, sm] = start.split(':');
  const [eh, em] = end.split(':');
  const h1 = ORE.includes(sh) ? sh : '18';
  const m1 = MINUTI.includes(sm) ? sm : snapToStep(sm || '0');
  const h2 = ORE.includes(eh) ? eh : '19';
  const m2 = MINUTI.includes(em) ? em : snapToStep(em || '0');

  function set(part: 'h1' | 'm1' | 'h2' | 'm2', v: string) {
    const next = { h1, m1, h2, m2, [part]: v };
    onChange(`${next.h1}:${next.m1}–${next.h2}:${next.m2}`);
  }

  return (
    <div className="time-range">
      <select value={h1} onChange={(e) => set('h1', e.target.value)}>
        {ORE.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
      <span className="time-sep">:</span>
      <select value={m1} onChange={(e) => set('m1', e.target.value)}>
        {MINUTI.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
      <span className="time-dash">–</span>
      <select value={h2} onChange={(e) => set('h2', e.target.value)}>
        {ORE.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
      <span className="time-sep">:</span>
      <select value={m2} onChange={(e) => set('m2', e.target.value)}>
        {MINUTI.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}

interface TimeSingleInputProps {
  value: string; // "HH:MM"
  onChange: (value: string) => void;
}

export function TimeSingleInput({ value, onChange }: TimeSingleInputProps) {
  const time = value || '10:00';
  const [h, m] = time.split(':');
  const h1 = ORE.includes(h) ? h : '10';
  const m1 = MINUTI.includes(m) ? m : snapToStep(m || '0');

  function set(part: 'h1' | 'm1', v: string) {
    const next = { h1, m1, [part]: v };
    onChange(`${next.h1}:${next.m1}`);
  }

  return (
    <div className="time-range">
      <select value={h1} onChange={(e) => set('h1', e.target.value)}>
        {ORE.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
      <span className="time-sep">:</span>
      <select value={m1} onChange={(e) => set('m1', e.target.value)}>
        {MINUTI.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}
