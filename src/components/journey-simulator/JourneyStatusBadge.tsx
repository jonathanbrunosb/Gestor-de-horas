import { Badge } from '../ui/Badge';
import type { BadgeTone } from '../../types/domain';
import type { JourneyEntryStatus } from '../../types/journeySimulator';

const TONE: Record<JourneyEntryStatus, BadgeTone> = {
  regular: 'success',
  attention: 'warning',
  risk: 'danger'
};

interface JourneyStatusBadgeProps {
  status: JourneyEntryStatus;
  label: string;
}

/** Badge de status da validação de próxima entrada — verde/amarelo/vermelho conforme regular/atenção/risco. */
export function JourneyStatusBadge({ status, label }: JourneyStatusBadgeProps) {
  return <Badge label={label} tone={TONE[status]} />;
}
