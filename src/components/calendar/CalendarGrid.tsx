import { WEEKDAYS } from '../../lib/constants';
import { daysInMonth, isWeekendDate, toISODate } from '../../utils/dates';
import type { LeaveWithRelations } from '../../types/domain';

export interface CalendarDayInfo {
  iso: string;
  leaves: LeaveWithRelations[];
  hasCriticalAlert: boolean;
  isCycleClosing: boolean;
}

interface CalendarGridProps {
  month: Date;
  leavesByDay: Map<string, LeaveWithRelations[]>;
  criticalDays: Set<string>;
  cycleClosingDays: Set<string>;
  selectedDate: string;
  onSelectDate: (iso: string) => void;
  compact?: boolean;
}

function buildTooltip(day: CalendarDayInfo): string {
  if (!day.leaves.length) return '';
  const lines = day.leaves.map((leave) => {
    const name = leave.collaborator?.name ?? 'Colaborador';
    const company = leave.company?.short_name ?? '-';
    return `${name} (${company}) — ${leave.reason}`;
  });
  return lines.join('\n');
}

export function CalendarGrid({ month, leavesByDay, criticalDays, cycleClosingDays, selectedDate, onSelectDate, compact }: CalendarGridProps) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstWeekday = new Date(year, monthIndex, 1).getDay();
  const totalDays = daysInMonth(month);
  const todayIso = toISODate(new Date());

  const cells: Array<{ iso: string; day: number } | null> = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let day = 1; day <= totalDays; day++) {
    cells.push({ iso: toISODate(new Date(year, monthIndex, day)), day });
  }

  return (
    <div>
      <div className={`calendar ${compact ? 'compact' : ''}`}>
        {WEEKDAYS.map((wd) => (
          <div key={wd} className="weekday">
            {wd}
          </div>
        ))}
        {cells.map((cell, idx) => {
          if (!cell) return <div key={`empty-${idx}`} className="day empty" />;
          const leaves = leavesByDay.get(cell.iso) ?? [];
          const date = new Date(`${cell.iso}T00:00:00`);
          const weekend = isWeekendDate(date);
          const isToday = cell.iso === todayIso;
          const critical = criticalDays.has(cell.iso);
          const cycleClosing = cycleClosingDays.has(cell.iso) && !leaves.length;
          const classes = ['day'];
          if (weekend) classes.push('weekend');
          if (isToday) classes.push('today');
          if (leaves.length) classes.push('has-leave');
          else if (cycleClosing) classes.push('cycle-leave');
          if (critical) classes.push('critical');
          if (cell.iso === selectedDate) classes.push('today');

          const tooltip = buildTooltip({ iso: cell.iso, leaves, hasCriticalAlert: critical, isCycleClosing: cycleClosing });

          return (
            <button
              key={cell.iso}
              type="button"
              className={classes.join(' ')}
              title={tooltip || undefined}
              onClick={() => onSelectDate(cell.iso)}
              style={{ textAlign: 'left' }}
            >
              <span className="day-num">{cell.day}</span>
              {leaves.length > 0 && <span className="day-note">{leaves.length === 1 ? leaves[0].collaborator?.name ?? 'Folga' : `${leaves.length} folgas`}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
