import { useEffect, useId, useMemo, useState } from 'react';
import { Check, ChevronRight, Code2, Copy, Search, ShieldCheck } from 'lucide-react';
import { AuditCategory, AuditFinding, AuditSeverity } from '../../types/atlas';
import { SeverityBadge } from '../../components/ui/SeverityBadge';
import { copyTextSafe } from '../../lib/clipboard';
import { InlineCodeText } from '../../components/ui/InlineCodeText';

interface AuditTableProps {
  findings: AuditFinding[];
  initialFilter?: 'all' | AuditCategory;
  onSelectFilePath: (filePath: string) => void;
}

const SEVERITY_RANK: Record<AuditSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const FILTERS: Array<['all' | AuditCategory, string]> = [
  ['all', 'All'],
  ['security', 'Security'],
  ['performance', 'Performance'],
  ['architecture', 'Architecture'],
];

export function AuditTable({ findings, initialFilter = 'all', onSelectFilePath }: AuditTableProps) {
  const [filter, setFilter] = useState<'all' | AuditCategory>(initialFilter);
  const [searchQuery, setSearchQuery] = useState('');
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const searchInputId = useId();

  useEffect(() => setFilter(initialFilter), [initialFilter]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return findings
      .filter((f) => (filter === 'all' || f.category === filter) && (!q || [f.ruleId, f.title, f.filePath, f.explanation].some((s) => s.toLowerCase().includes(q))))
      .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || a.filePath.localeCompare(b.filePath) || a.lineNumber - b.lineNumber);
  }, [findings, filter, searchQuery]);

  function toggle(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCopyPrompt(finding: AuditFinding) {
    await copyTextSafe(finding.aiFixPrompt);
    setCopiedId(finding.id);
    window.setTimeout(() => setCopiedId((cur) => (cur === finding.id ? null : cur)), 1800);
  }

  const allOpen = filtered.length > 0 && filtered.every((f) => openIds.has(f.id));

  return (
    <div className="atlas-panel-animate surface">
      <div className="px-4 pt-3.5 pb-3 divider-b space-y-0.5">
        <h2 className="heading-section">Findings</h2>
        <p className="text-[0.75rem] text-muted measure-readable">
          Problems spotted in the code, most serious first. Open one to see why it matters, how to fix it, and a ready-made prompt for
          your AI assistant.
        </p>
      </div>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 px-4 py-3 divider-b">
        <div className="segmented segmented-sm self-start" role="group" aria-label="Filter by category">
          {FILTERS.map(([cat, label]) => (
            <button key={cat} type="button" aria-pressed={filter === cat} onClick={() => setFilter(cat)}>
              {label}
              <span className="count">{cat === 'all' ? findings.length : findings.filter((f) => f.category === cat).length}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <label htmlFor={searchInputId} className="visually-hidden">Filter findings</label>
          <div className="field w-full md:w-64">
            <Search size={14} strokeWidth={1.75} className="text-muted" aria-hidden="true" />
            <input id={searchInputId} type="search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Filter by rule, file or text" className="text-[0.8125rem]" />
          </div>
          {filtered.length > 0 && (
            <button type="button" onClick={() => setOpenIds(allOpen ? new Set() : new Set(filtered.map((f) => f.id)))} className="btn btn-ghost btn-sm shrink-0">
              {allOpen ? 'Collapse all' : 'Expand all'}
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="px-6 py-16 text-center space-y-2">
          <ShieldCheck size={22} strokeWidth={1.5} className="mx-auto tone-success tone-text" aria-hidden="true" />
          <h3 className="heading-section">{findings.length === 0 ? 'No findings' : 'Nothing matches'}</h3>
          <p className="text-[0.8125rem] text-secondary">
            {findings.length === 0 ? 'Every security, performance and architecture check passed.' : 'Try a different filter or search term.'}
          </p>
          {(searchQuery || filter !== 'all') && findings.length > 0 && (
            <button type="button" onClick={() => { setSearchQuery(''); setFilter('all'); }} className="btn btn-secondary btn-sm mt-2">Clear filters</button>
          )}
        </div>
      ) : (
        <ul aria-label="Findings">
          {filtered.map((f, i) => {
            const isOpen = openIds.has(f.id);
            const panelId = `finding-panel-${f.id}`;
            return (
              <li key={f.id} style={i > 0 ? { borderTop: '1px solid var(--border-hairline)' } : undefined}>
                <button
                  type="button"
                  onClick={() => toggle(f.id)}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  className="w-full grid grid-cols-[auto_1fr_auto] md:grid-cols-[5.5rem_1fr_minmax(0,18rem)_auto] items-center gap-3 px-4 py-3 text-left cursor-pointer transition-colors hover:bg-[var(--bg-elevated)]"
                >
                  <span className="md:w-[5.5rem]"><SeverityBadge severity={f.severity} /></span>
                  <span className="min-w-0">
                    <span className="block text-[0.875rem] font-medium leading-snug">{f.title}</span>
                    <span className="block font-mono-code text-[0.71875rem] text-muted mt-0.5">
                      {f.ruleId} · {f.category}
                      <span className="md:hidden"> · {f.filePath.split('/').pop()}:{f.lineNumber}</span>
                    </span>
                  </span>
                  <span className="hidden md:block font-mono-code text-[0.75rem] text-muted truncate text-right" title={`${f.filePath}:${f.lineNumber}`}>
                    {f.filePath}:{f.lineNumber}
                  </span>
                  <ChevronRight size={15} strokeWidth={1.75} className="disclosure-chevron text-muted" aria-hidden="true" />
                </button>

                <div id={panelId} className="disclosure-panel" data-open={isOpen} inert={!isOpen}>
                  <div>
                    <div className="px-4 pb-4 md:pl-[calc(5.5rem+1.75rem)] space-y-3">
                      <div className="measure-readable">
                        <p className="eyebrow mb-1">Why it matters</p>
                        <p className="text-[0.8125rem] text-secondary"><InlineCodeText text={f.explanation} /></p>
                      </div>
                      <div className="surface-quiet px-3 py-2.5 measure-readable">
                        <p className="eyebrow mb-1">How to fix</p>
                        <p className="text-[0.8125rem]"><InlineCodeText text={f.remediation} /></p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <button type="button" onClick={() => onSelectFilePath(f.filePath)} className="btn btn-secondary btn-sm">
                          <Code2 size={13} strokeWidth={1.75} aria-hidden="true" />
                          Open file
                        </button>
                        <button type="button" onClick={() => void handleCopyPrompt(f)} className="btn btn-ghost btn-sm" aria-label={`Copy AI fix prompt for ${f.ruleId}`} title="Paste into Claude, Cursor, Copilot or another AI coding assistant">
                          {copiedId === f.id ? <Check size={13} strokeWidth={1.75} className="tone-success tone-text" aria-hidden="true" /> : <Copy size={13} strokeWidth={1.75} aria-hidden="true" />}
                          {copiedId === f.id ? 'Copied' : 'Copy prompt for AI'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
