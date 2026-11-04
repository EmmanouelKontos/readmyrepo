import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Code2, GitCommit, ShieldCheck } from 'lucide-react';
import { AuditFinding, RepoNode } from '../../types/atlas';
import { SeverityBadge } from '../../components/ui/SeverityBadge';

interface ModuleInspectorCardProps {
  selectedNode: RepoNode | undefined;
  findings: AuditFinding[];
  onSelectNodeId: (id: string) => void;
  onInspectCode: (node: RepoNode) => void;
}

export function ModuleInspectorCard({
  selectedNode,
  findings,
  onSelectNodeId,
  onInspectCode,
}: ModuleInspectorCardProps) {
  if (!selectedNode) return null;

  const moduleFindings = findings.filter((f) => f.filePath === selectedNode.path);

  return (
    <aside
      aria-label="Selected module inspector"
      className="lg:col-span-4 rounded-xl p-5 flex flex-col justify-between"
      style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-hairline)' }}
    >
      <div className="space-y-4">
        <div
          className="flex items-start justify-between gap-3 pb-3.5"
          style={{ borderBottom: '1px solid var(--border-hairline)' }}
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span
                className="font-mono-code text-xs font-semibold px-2 py-0.5 rounded capitalize"
                style={{ backgroundColor: 'var(--accent-brand-soft)', color: 'var(--accent-brand)' }}
              >
                {selectedNode.layer} layer
              </span>
              <span className="font-mono-code text-xs" style={{ color: 'var(--text-muted)' }}>
                {selectedNode.name}
              </span>
            </div>
            <h3 className="font-mono-code font-semibold text-sm break-all leading-snug">
              {selectedNode.path}
            </h3>
          </div>
          <SeverityBadge severity={selectedNode.maxSeverity} />
        </div>

        <div
          className="grid grid-cols-3 gap-2.5 p-3 rounded-xl font-mono-code"
          style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-hairline)' }}
        >
          <div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Size</div>
            <div className="text-sm font-semibold mt-0.5 tabular-nums">{selectedNode.linesOfCode} LOC</div>
          </div>
          <div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>AI Context</div>
            <div className="text-sm font-semibold mt-0.5 tabular-nums">~{selectedNode.estimatedTokens} tok</div>
          </div>
          <div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Exports</div>
            <div className="text-sm font-semibold mt-0.5 tabular-nums">{selectedNode.exportsCount} sym</div>
          </div>
        </div>

        {(selectedNode.isGodFile || selectedNode.inCycle) && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-1.5">
            {selectedNode.isGodFile && (
              <p className="flex items-center gap-2 font-medium text-amber-800 dark:text-amber-300">
                <AlertTriangle size={14} className="shrink-0" aria-hidden="true" />
                <span>Oversized God Module ({selectedNode.linesOfCode} LOC exceeds 220-line cap)</span>
              </p>
            )}
            {selectedNode.inCycle && (
              <p className="flex items-center gap-2 font-medium text-red-700 dark:text-red-300">
                <GitCommit size={14} className="shrink-0" aria-hidden="true" />
                <span>Involved in a bidirectional circular dependency cycle</span>
              </p>
            )}
          </div>
        )}

        <div>
          <h4 className="text-xs font-semibold tracking-tight mb-2 flex items-center justify-between" style={{ color: 'var(--text-secondary)' }}>
            <span>Module Audit Findings</span>
            <span className="font-mono-code">{moduleFindings.length}</span>
          </h4>
          {moduleFindings.length === 0 ? (
            <div
              className="flex items-center gap-2 p-2.5 rounded-lg text-xs"
              style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
            >
              <ShieldCheck size={15} className="text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
              <span>Zero static security, performance, or modularity issues in this file.</span>
            </div>
          ) : (
            <ul className="space-y-1.5">
              {moduleFindings.slice(0, 3).map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => onInspectCode(selectedNode)}
                    className="w-full text-left p-2.5 rounded-lg text-xs transition-colors cursor-pointer flex items-start justify-between gap-2"
                    style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-hairline)' }}
                  >
                    <div className="min-w-0">
                      <span className="font-mono-code font-semibold mr-1.5" style={{ color: 'var(--accent-brand)' }}>
                        {f.ruleId} (L{f.lineNumber})
                      </span>
                      <span className="font-medium">{f.title}</span>
                    </div>
                    <SeverityBadge severity={f.severity} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-3 text-xs">
          <div>
            <h4 className="font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Direct Outgoing Imports ({selectedNode.imports.length})
            </h4>
            {selectedNode.imports.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>Leaf module (no local imports)</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {selectedNode.imports.map((imp) => (
                  <button
                    key={imp}
                    type="button"
                    onClick={() => onSelectNodeId(imp)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-mono-code text-xs cursor-pointer transition-colors"
                    style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--accent-brand)', border: '1px solid var(--border-hairline)' }}
                  >
                    <ArrowUpRight size={12} aria-hidden="true" />
                    <span>{imp.split('/').pop()}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <h4 className="font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Imported By Dependents ({selectedNode.importedBy.length})
            </h4>
            {selectedNode.importedBy.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>Root entry point or unreferenced</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {selectedNode.importedBy.map((by) => (
                  <button
                    key={by}
                    type="button"
                    onClick={() => onSelectNodeId(by)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-mono-code text-xs cursor-pointer transition-colors"
                    style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-hairline)' }}
                  >
                    <ArrowDownLeft size={12} aria-hidden="true" />
                    <span>{by.split('/').pop()}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onInspectCode(selectedNode)}
        className="mt-5 w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold text-white cursor-pointer transition-opacity hover:opacity-95"
        style={{ backgroundColor: 'var(--accent-brand)' }}
      >
        <Code2 size={16} strokeWidth={1.75} aria-hidden="true" />
        <span>Inspect Source Code &amp; Line Flags</span>
      </button>
    </aside>
  );
}
