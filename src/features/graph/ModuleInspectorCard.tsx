import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Code2, RefreshCcw, ShieldCheck } from 'lucide-react';
import { AuditFinding, RepoNode } from '../../types/atlas';
import { SEVERITY_TONE, SeverityBadge } from '../../components/ui/SeverityBadge';

interface ModuleInspectorCardProps {
  selectedNode: RepoNode | undefined;
  findings: AuditFinding[];
  onSelectNodeId: (id: string) => void;
  onInspectCode: (node: RepoNode) => void;
}

const LAYER_LABEL: Record<RepoNode['layer'], string> = {
  entry: 'Entry',
  feature: 'Feature',
  ui: 'UI',
  service: 'Service',
  data: 'Types & data',
  config: 'Config',
};

function LinkList({ title, ids, empty, direction, onSelect }: { title: string; ids: string[]; empty: string; direction: 'out' | 'in'; onSelect: (id: string) => void }) {
  const Icon = direction === 'out' ? ArrowUpRight : ArrowDownLeft;
  return (
    <div className="space-y-1.5">
      <h4 className="eyebrow flex items-center justify-between">
        <span>{title}</span>
        <span className="count">{ids.length}</span>
      </h4>
      {ids.length === 0 ? (
        <p className="text-[0.8125rem] text-muted">{empty}</p>
      ) : (
        <div className="flex flex-wrap gap-1">
          {ids.map((id) => (
            <button key={id} type="button" onClick={() => onSelect(id)} className="btn btn-secondary btn-sm font-mono-code text-secondary" title={id}>
              <Icon size={12} strokeWidth={1.75} className="text-muted" aria-hidden="true" />
              {id.split('/').pop()}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ModuleInspectorCard({ selectedNode, findings, onSelectNodeId, onInspectCode }: ModuleInspectorCardProps) {
  if (!selectedNode) return null;
  const moduleFindings = findings.filter((f) => f.filePath === selectedNode.path);
  const stats: Array<[string, string]> = [
    ['Lines', selectedNode.linesOfCode.toLocaleString()],
    ['Tokens', `~${selectedNode.estimatedTokens.toLocaleString()}`],
    ['Exports', String(selectedNode.exportsCount)],
  ];

  return (
    <aside aria-label="Selected module" className="xl:col-span-4 surface flex flex-col">
      <div key={selectedNode.id} className="atlas-fade-in flex flex-col flex-1">
        <div className="px-4 py-3 divider-b flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-0.5">
            <p className="eyebrow">{LAYER_LABEL[selectedNode.layer]} layer</p>
            <h3 className="font-mono-code text-[0.8125rem] font-medium break-all leading-snug">{selectedNode.path}</h3>
          </div>
          <SeverityBadge severity={selectedNode.maxSeverity} />
        </div>

        <dl className="grid grid-cols-3 divider-b">
          {stats.map(([label, value], i) => (
            <div key={label} className="px-4 py-3" style={i > 0 ? { borderLeft: '1px solid var(--border-hairline)' } : undefined}>
              <dt className="text-[0.75rem] text-muted">{label}</dt>
              <dd className="font-mono-code text-[0.9375rem] tabular-nums mt-0.5">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="p-4 space-y-5 flex-1">
          {(selectedNode.isGodFile || selectedNode.inCycle) && (
            <div className="space-y-1.5">
              {selectedNode.isGodFile && (
                <p className="tone-callout tone-warning flex items-center gap-2 px-3 py-2 text-[0.8125rem]">
                  <AlertTriangle size={14} strokeWidth={1.75} className="tone-text shrink-0" aria-hidden="true" />
                  {selectedNode.codeLines ?? selectedNode.linesOfCode} code lines — over the {selectedNode.sizeLimit ?? 220}-line limit
                </p>
              )}
              {selectedNode.inCycle && (
                <p className="tone-callout tone-danger flex items-center gap-2 px-3 py-2 text-[0.8125rem]">
                  <RefreshCcw size={14} strokeWidth={1.75} className="tone-text shrink-0" aria-hidden="true" />
                  Part of a circular import
                </p>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <h4 className="eyebrow flex items-center justify-between">
              <span>Findings</span>
              <span className="count">{moduleFindings.length}</span>
            </h4>
            {moduleFindings.length === 0 ? (
              <p className="flex items-center gap-2 text-[0.8125rem] text-secondary">
                <ShieldCheck size={14} strokeWidth={1.75} className="tone-success tone-text" aria-hidden="true" />
                No issues in this file
              </p>
            ) : (
              <ul className="-mx-2">
                {moduleFindings.slice(0, 4).map((f) => (
                  <li key={f.id}>
                    <button type="button" onClick={() => onInspectCode(selectedNode)} className="row-interactive w-full text-left px-2 py-1.5 flex items-start gap-2.5 cursor-pointer">
                      <span className={`tone-dot mt-[7px] ${SEVERITY_TONE[f.severity]}`} aria-hidden="true" />
                      <span className="min-w-0">
                        <span className="block text-[0.8125rem] leading-snug">{f.title}</span>
                        <span className="block font-mono-code text-[0.71875rem] text-muted">{f.ruleId} · line {f.lineNumber}</span>
                      </span>
                    </button>
                  </li>
                ))}
                {moduleFindings.length > 4 && <li className="px-2 pt-1 text-[0.75rem] text-muted">+{moduleFindings.length - 4} more in the source view</li>}
              </ul>
            )}
          </div>

          <LinkList title="Imports" ids={selectedNode.imports} empty="No local imports" direction="out" onSelect={onSelectNodeId} />
          <LinkList title="Imported by" ids={selectedNode.importedBy} empty="Nothing imports this module" direction="in" onSelect={onSelectNodeId} />
        </div>

        <div className="p-4 divider-t">
          <button type="button" onClick={() => onInspectCode(selectedNode)} className="btn btn-secondary w-full">
            <Code2 size={14} strokeWidth={1.75} aria-hidden="true" />
            Open source
          </button>
        </div>
      </div>
    </aside>
  );
}
