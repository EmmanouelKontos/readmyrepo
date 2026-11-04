import { useEffect, useId, useState } from 'react';
import { Check, Code2, Copy, Search, ShieldCheck } from 'lucide-react';
import { AuditCategory, AuditFinding } from '../../types/atlas';
import { CategoryBadge, SeverityBadge } from '../../components/ui/SeverityBadge';
import { copyTextSafe } from '../../lib/clipboard';

interface AuditTableProps {
  findings: AuditFinding[];
  initialFilter?: 'all' | AuditCategory;
  onSelectFilePath: (filePath: string) => void;
}

export function AuditTable({
  findings,
  initialFilter = 'all',
  onSelectFilePath,
}: AuditTableProps) {
  const [filter, setFilter] = useState<'all' | AuditCategory>(initialFilter);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const searchInputId = useId();

  useEffect(() => {
    setFilter(initialFilter);
  }, [initialFilter]);

  const q = searchQuery.trim().toLowerCase();
  const filtered = findings.filter((f) => {
    const matchesCat = filter === 'all' || f.category === filter;
    const matchesQuery =
      !q ||
      f.ruleId.toLowerCase().includes(q) ||
      f.title.toLowerCase().includes(q) ||
      f.filePath.toLowerCase().includes(q) ||
      f.explanation.toLowerCase().includes(q);
    return matchesCat && matchesQuery;
  });

  async function handleCopyPrompt(finding: AuditFinding) {
    await copyTextSafe(finding.aiFixPrompt);
    setCopiedId(finding.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div className="atlas-panel-animate space-y-4">
      <div
        className="p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3"
        style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-hairline)' }}
      >
        <div className="flex flex-wrap items-center gap-1.5">
          {(['all', 'security', 'performance', 'architecture'] as const).map((cat) => {
            const count = cat === 'all' ? findings.length : findings.filter((f) => f.category === cat).length;
            const active = filter === cat;
            return (
              <button
                key={cat}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(cat)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold capitalize cursor-pointer transition-colors"
                style={{
                  backgroundColor: active ? 'var(--accent-brand)' : 'var(--bg-elevated)',
                  color: active ? '#FFFFFF' : 'var(--text-secondary)',
                  border: '1px solid var(--border-hairline)',
                }}
              >
                {cat} <span className="font-mono-code ml-1">({count})</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          <label htmlFor={searchInputId} className="visually-hidden">
            Filter audit findings by rule, file path, or keyword
          </label>
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg w-full md:w-64"
            style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-strong)' }}
          >
            <Search size={14} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
            <input
              id={searchInputId}
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter rule, file, or issue..."
              className="bg-transparent text-xs w-full focus:outline-none"
            />
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div
          className="p-12 rounded-xl text-center"
          style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-hairline)' }}
        >
          <ShieldCheck size={32} className="mx-auto mb-2.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          <h3 className="heading-section">Zero Matching Findings</h3>
          <p className="text-sm mt-1 mx-auto measure-readable" style={{ color: 'var(--text-secondary)' }}>
            All static security, performance, and modularity checks passed for the current filter.
          </p>
        </div>
      ) : (
        <div tabIndex={0} role="region" aria-labelledby="audit-table-caption" className="table-wrapper">
          <table className="audit-table">
            <caption id="audit-table-caption" className="visually-hidden">
              Security, performance, and architecture audit findings
            </caption>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-hairline)', color: 'var(--text-secondary)' }}>
                <th scope="col" className="py-3.5 px-4 text-left text-xs font-mono-code font-semibold">Rule &amp; Finding</th>
                <th scope="col" className="py-3.5 px-3 text-left text-xs font-mono-code font-semibold">Category</th>
                <th scope="col" className="py-3.5 px-3 text-left text-xs font-mono-code font-semibold">Severity</th>
                <th scope="col" className="py-3.5 px-3 text-left text-xs font-mono-code font-semibold">Location</th>
                <th scope="col" className="py-3.5 px-4 text-left text-xs font-mono-code font-semibold">Diagnosis &amp; Remediation</th>
                <th scope="col" className="py-3.5 px-4 text-right text-xs font-mono-code font-semibold">AI Fix Prompt</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((finding) => (
                <tr key={finding.id} style={{ borderBottom: '1px solid var(--border-hairline)' }}>
                  <th scope="row" className="py-4 px-4 align-top max-w-xs">
                    <span
                      className="font-mono-code text-xs font-semibold px-1.5 py-0.5 rounded inline-block mb-1"
                      style={{ backgroundColor: 'var(--accent-brand-soft)', color: 'var(--accent-brand)' }}
                    >
                      {finding.ruleId}
                    </span>
                    <div className="font-semibold text-sm leading-snug">{finding.title}</div>
                  </th>
                  <td className="py-4 px-3 align-top"><CategoryBadge category={finding.category} /></td>
                  <td className="py-4 px-3 align-top"><SeverityBadge severity={finding.severity} /></td>
                  <td className="py-4 px-3 align-top">
                    <button
                      type="button"
                      onClick={() => onSelectFilePath(finding.filePath)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-mono-code text-xs font-medium text-left cursor-pointer transition-colors sm:whitespace-nowrap max-w-full"
                      style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--accent-brand)', border: '1px solid var(--border-hairline)' }}
                    >
                      <Code2 size={13} className="shrink-0" aria-hidden="true" />
                      <span className="truncate">{finding.filePath}:{finding.lineNumber}</span>
                    </button>
                  </td>
                  <td className="py-4 px-4 align-top max-w-md">
                    <p className="text-xs leading-relaxed measure-readable" style={{ color: 'var(--text-secondary)' }}>
                      {finding.explanation}
                    </p>
                    <p className="text-xs font-semibold mt-1.5 leading-relaxed">
                      Recommended Fix: <span className="font-normal">{finding.remediation}</span>
                    </p>
                  </td>
                  <td className="py-4 px-4 align-top text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => handleCopyPrompt(finding)}
                      aria-label={`Copy AI fix prompt for ${finding.ruleId} in ${finding.filePath}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                      style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }}
                    >
                      {copiedId === finding.id ? (
                        <>
                          <Check size={13} className="text-emerald-600" aria-hidden="true" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy size={13} aria-hidden="true" />
                          <span>Copy AI Fix</span>
                        </>
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
