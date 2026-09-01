import type { BadgeTone } from '../../types/domain';

interface BadgeProps {
  label: string;
  tone?: BadgeTone;
}

export function Badge({ label, tone = 'neutral' }: BadgeProps) {
  return <span className={`badge ${tone}`}>{label}</span>;
}

const STATUS_TONE: Record<string, BadgeTone> = {
  Regular: 'success',
  Atenção: 'warning',
  Crítico: 'danger',
  'Folga programada': 'info',
  Inativo: 'inactive',
  Ativo: 'success'
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge label={status} tone={STATUS_TONE[status] ?? 'neutral'} />;
}
