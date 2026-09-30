export function StatCard({ label, value, sub, valueClass, cardClass }: { label: string; value: string | number; sub?: string; valueClass?: string; cardClass?: string }) {
  return (
    <div className={cardClass ? `stat-card ${cardClass}` : 'stat-card'}>
      <div className={valueClass ? `stat-value ${valueClass}` : 'stat-value'}>{value}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}
