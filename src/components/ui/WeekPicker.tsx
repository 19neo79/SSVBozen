import type { ReactNode } from 'react';
import { fmtDateShort } from '../../lib/dates';

interface WeekPickerProps {
  rangeStart: string;
  rangeEnd: string;
  value: string;
  isCurrentWeek: boolean;
  onShift: (deltaDays: number) => void;
  onReset: () => void;
  onPick: (iso: string) => void;
  className?: string;
  children?: ReactNode;
}

export function WeekPicker({
  rangeStart, rangeEnd, value, isCurrentWeek, onShift, onReset, onPick, className, children,
}: WeekPickerProps) {
  const hasActions = !isCurrentWeek || !!children;
  return (
    <div className={className ? `week-picker ${className}` : 'week-picker'}>
      <div className="week-nav">
        <button type="button" className="btn ghost small" onClick={() => onShift(-7)}>← Settimana precedente</button>
        <div className="week-range">{fmtDateShort(rangeStart)} — {fmtDateShort(rangeEnd)}</div>
        <button type="button" className="btn ghost small" onClick={() => onShift(7)}>Settimana successiva →</button>
      </div>
      {hasActions && (
        <div className="week-picker-actions">
          {!isCurrentWeek && <button type="button" className="btn small" onClick={onReset}>Torna a questa settimana</button>}
          {children}
        </div>
      )}
      <div className="week-picker-alt">
        <label htmlFor="week-picker-date">Oppure scegli un giorno qualsiasi</label>
        <input id="week-picker-date" type="date" value={value} onChange={(e) => onPick(e.target.value)} />
      </div>
    </div>
  );
}
