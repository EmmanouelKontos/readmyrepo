import { MousePointerClick } from 'lucide-react';
import { DependencyEdge, RepoNode } from '../../types/atlas';

interface GraphOverviewCardProps {
  nodes: RepoNode[];
  edges: DependencyEdge[];
  onSelect: (id: string) => void;
}

function RankedList({ title, rows, onSelect }: { title: string; rows: Array<{ node: RepoNode; value: string }>; onSelect: (id: string) => void }) {
  if (rows.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <h4 className="eyebrow">{title}</h4>
      <ul className="-mx-2">
        {rows.map(({ node, value }) => (
          <li key={node.id}>
            <button type="button" onClick={() => onSelect(node.id)} title={node.path} className="row-interactive w-full px-2 py-1.5 flex items-center justify-between gap-3 cursor-pointer text-left">
              <span className="font-mono-code text-[0.875rem] truncate">{node.name}</span>
              <span className="font-mono-code text-[0.8125rem] text-muted tabular-nums shrink-0">{value}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Inspector content while no module is selected: where to look first. */
export function GraphOverviewCard({ nodes, edges, onSelect }: GraphOverviewCardProps) {
  const runtimeEdges = edges.filter((e) => !e.typeOnly).length;
  const cycles = nodes.filter((n) => n.inCycle).length;
  const hubs = [...nodes]
    .filter((n) => n.importedBy.length > 0)
    .sort((a, b) => b.importedBy.length - a.importedBy.length || a.name.localeCompare(b.name))
    .slice(0, 5)
    .map((node) => ({ node, value: `used by ${node.importedBy.length}` }));
  const largest = [...nodes]
    .sort((a, b) => (b.codeLines ?? b.linesOfCode) - (a.codeLines ?? a.linesOfCode))
    .slice(0, 3)
    .map((node) => ({ node, value: `${(node.codeLines ?? node.linesOfCode).toLocaleString()} lines` }));
  const stats: Array<[string, string]> = [
    ['Files', String(nodes.length)],
    ['Links', String(runtimeEdges)],
    ['In loops', String(cycles)],
  ];

  return (
    <aside aria-label="Map overview" className="xl:col-span-3 surface flex flex-col min-w-0">
      <div className="atlas-fade-in flex flex-col flex-1">
        <div className="px-4 py-3 divider-b space-y-0.5">
          <p className="eyebrow">Overview</p>
          <h3 className="text-[0.9375rem] font-medium leading-snug">No file selected</h3>
        </div>

        <dl className="grid grid-cols-3 divider-b">
          {stats.map(([label, value], i) => (
            <div key={label} className="px-4 py-3" style={i > 0 ? { borderLeft: '1px solid var(--border-hairline)' } : undefined}>
              <dt className="text-[0.8125rem] text-muted">{label}</dt>
              <dd className="font-mono-code text-[1rem] tabular-nums mt-0.5">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="p-4 space-y-5 flex-1">
          <RankedList title="Most used by other files" rows={hubs} onSelect={onSelect} />
          <RankedList title="Largest files" rows={largest} onSelect={onSelect} />
        </div>

        <p className="p-4 divider-t flex items-start gap-2 text-[0.8125rem] text-muted">
          <MousePointerClick size={14} strokeWidth={1.75} className="shrink-0 mt-px" aria-hidden="true" />
          <span>
            Click a file to see what it uses and what uses it. Arrow keys move between files, <kbd className="kbd">Enter</kbd> selects, <kbd className="kbd">Esc</kbd> clears.
          </span>
        </p>
      </div>
    </aside>
  );
}
