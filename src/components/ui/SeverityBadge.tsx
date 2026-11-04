import { AuditCategory, AuditSeverity } from '../../types/atlas';

const SEVERITY_STYLES: Record<AuditSeverity | 'clean', string> = {
  critical:
    'bg-red-500/12 text-red-700 dark:text-red-300 border-red-500/30',
  high:
    'bg-amber-500/12 text-amber-800 dark:text-amber-300 border-amber-500/30',
  medium:
    'bg-yellow-500/12 text-yellow-800 dark:text-yellow-300 border-yellow-500/30',
  low:
    'bg-stone-500/12 text-stone-700 dark:text-stone-300 border-stone-500/25',
  clean:
    'bg-emerald-500/12 text-emerald-800 dark:text-emerald-300 border-emerald-500/30',
};

export function SeverityBadge({ severity }: { severity: AuditSeverity | 'clean' }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-mono-code font-semibold capitalize rounded-md border ${SEVERITY_STYLES[severity]}`}
    >
      {severity}
    </span>
  );
}

const CATEGORY_STYLES: Record<AuditCategory, string> = {
  security:
    'bg-rose-500/10 text-rose-800 dark:text-rose-300 border-rose-500/25',
  performance:
    'bg-sky-500/10 text-sky-800 dark:text-sky-300 border-sky-500/25',
  architecture:
    'bg-orange-500/10 text-orange-800 dark:text-orange-300 border-orange-500/25',
};

export function CategoryBadge({ category }: { category: AuditCategory }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium capitalize rounded-md border ${CATEGORY_STYLES[category]}`}
    >
      {category}
    </span>
  );
}
