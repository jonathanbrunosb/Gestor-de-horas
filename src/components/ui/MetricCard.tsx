import type { ReactNode } from 'react';

export type MetricTone = 'info' | 'success' | 'warning' | 'danger' | 'neutral';

interface MetricCardProps {
  title: string;
  value: string;
  note?: string;
  icon?: ReactNode;
  tone?: MetricTone;
}

export function MetricCard({ title, value, note, icon, tone = 'neutral' }: MetricCardProps) {
  return (
    <div className={`card metric-card ${tone}`}>
      <div className="metric-head">
        <span className="metric-title">{title}</span>
        {icon && <span className="metric-icon">{icon}</span>}
      </div>
      <div className="metric-value">{value}</div>
      {note && <div className="metric-note">{note}</div>}
    </div>
  );
}
