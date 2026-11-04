import { AuditCategory, AuditSeverity } from '../../types/atlas';

export const SEVERITY_TONE: Record<AuditSeverity | 'clean', string> = {
  critical: 'tone-danger',
  high: 'tone-warning',
  medium: 'tone-info',
  low: 'tone-neutral',
  clean: 'tone-success',
};

const SEVERITY_LABEL: Record<AuditSeverity | 'clean', string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  clean: 'Clean',
};

export function SeverityBadge({ severity }: { severity: AuditSeverity | 'clean' }) {
  return (
    <span className={`chip tone-chip ${SEVERITY_TONE[severity]}`}>
      <span className="tone-dot" aria-hidden="true" />
      {SEVERITY_LABEL[severity]}
    </span>
  );
}

const CATEGORY_LABEL: Record<AuditCategory, string> = {
  security: 'Security',
  performance: 'Performance',
  architecture: 'Architecture',
};

export function CategoryBadge({ category }: { category: AuditCategory }) {
  return <span className="chip">{CATEGORY_LABEL[category]}</span>;
}
