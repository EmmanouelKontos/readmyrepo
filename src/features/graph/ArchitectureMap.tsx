import { useCallback, useMemo, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { AuditFinding, DependencyEdge, RepoNode } from '../../types/atlas';
import { ModuleInspectorCard } from './ModuleInspectorCard';
import { GraphOverviewCard } from './GraphOverviewCard';
import { GraphCanvas } from './GraphCanvas';
import { computeGraphLayout, GRAPH_WIDTH } from './graphLayout';
import { useElementWidth } from '../../hooks/useElementWidth';
import { useGraphFocus } from './useGraphFocus';

interface ArchitectureMapProps {
  nodes: RepoNode[];
  edges: DependencyEdge[];
  findings: AuditFinding[];
  onInspectCode: (node: RepoNode) => void;
}

type HighlightFilter = 'all' | 'issues' | 'cycles' | 'god';

const ZOOM_STEPS = [80, 90, 100, 115, 130];
const DEFAULT_ZOOM = 2;

function LegendLine({ color, dashed, label }: { color: string; dashed?: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg width="18" height="6" aria-hidden="true">
        <line x1="1" y1="3" x2="17" y2="3" style={{ stroke: color, strokeWidth: 1.5, strokeDasharray: dashed ? '4 3' : undefined }} />
      </svg>
      {label}
    </span>
  );
}

export function ArchitectureMap({ nodes, edges, findings, onInspectCode }: ArchitectureMapProps) {
  const [highlightFilter, setHighlightFilter] = useState<HighlightFilter>('all');
  const [zoomIdx, setZoomIdx] = useState(DEFAULT_ZOOM);
  const zoomPct = ZOOM_STEPS[zoomIdx];
  const [scrollRef, scrollWidth] = useElementWidth<HTMLDivElement>();
  // Lay out for the real panel width (divided by zoom), so 100% means text at its true size and
  // zooming in makes everything larger instead of squeezing more columns in.
  const layoutWidth = (scrollWidth || GRAPH_WIDTH) / (zoomPct / 100);
  const layout = useMemo(() => computeGraphLayout(nodes, layoutWidth), [nodes, layoutWidth]);
  const focus = useGraphFocus(nodes, layout.coords, onInspectCode);

  const matchesFilter = useCallback(
    (node: RepoNode) =>
      highlightFilter === 'issues' ? node.issueCount > 0 : highlightFilter === 'cycles' ? node.inCycle : highlightFilter === 'god' ? node.isGodFile : true,
    [highlightFilter]
  );

  const filterOptions: Array<[HighlightFilter, string, number]> = [
    ['all', 'All', nodes.length],
    ['issues', 'With issues', nodes.filter((n) => n.issueCount > 0).length],
    ['cycles', 'In loops', nodes.filter((n) => n.inCycle).length],
    ['god', 'Oversized', nodes.filter((n) => n.isGodFile).length],
  ];

  return (
    <div className="atlas-panel-animate grid grid-cols-1 xl:grid-cols-12 gap-3 items-stretch">
      <div className="xl:col-span-9 surface flex flex-col min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 divider-b">
          <div className="min-w-0">
            <h2 className="heading-section">Dependency map</h2>
            <p className="text-[0.8125rem] text-muted">Each box is a file and each arrow points to a file it uses. Hover to preview, click to pin, double-click to read the code.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 max-w-full">
            <div className="segmented segmented-sm max-w-full overflow-x-auto" role="group" aria-label="Highlight modules">
              {filterOptions.map(([key, label, count]) => (
                <button key={key} type="button" aria-pressed={highlightFilter === key} onClick={() => setHighlightFilter(key)} disabled={key !== 'all' && count === 0}>
                  {label}
                  <span className="count">{count}</span>
                </button>
              ))}
            </div>
            <div className="flex items-center" role="group" aria-label="Zoom">
              <button type="button" onClick={() => setZoomIdx((i) => Math.max(0, i - 1))} disabled={zoomIdx === 0} aria-label="Zoom out" className="btn btn-ghost btn-icon btn-sm">
                <Minus size={13} strokeWidth={1.75} aria-hidden="true" />
              </button>
              <button type="button" onClick={() => setZoomIdx(DEFAULT_ZOOM)} className="btn btn-ghost btn-sm font-mono-code w-12 px-0 tabular-nums" title="Reset zoom">
                {zoomPct}%
              </button>
              <button type="button" onClick={() => setZoomIdx((i) => Math.min(ZOOM_STEPS.length - 1, i + 1))} disabled={zoomIdx === ZOOM_STEPS.length - 1} aria-label="Zoom in" className="btn btn-ghost btn-icon btn-sm">
                <Plus size={13} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>

        <div ref={scrollRef} className="atlas-graph-scroll overflow-auto p-3 flex-1">
          <GraphCanvas layout={layout} edges={edges} focus={focus} zoomPct={zoomPct} matchesFilter={matchesFilter} onOpen={onInspectCode} />
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 px-4 py-2.5 divider-t text-[0.8125rem] text-muted">
          <LegendLine color="var(--text-primary)" label="Uses" />
          <LegendLine color="var(--accent-brand)" label="Used by" />
          <LegendLine color="var(--tone-danger)" dashed label="Import loop" />
          <span className="inline-flex items-center gap-1.5"><span className="tone-dot tone-danger" />Critical</span>
          <span className="inline-flex items-center gap-1.5"><span className="tone-dot tone-warning" />High</span>
          <span className="inline-flex items-center gap-1.5"><span className="tone-dot tone-info" />Medium or low</span>
          <span className="inline-flex items-center gap-1.5 tone-warning" title="Over 220 lines of code for UI components, 400 for logic files, 800 for C, C++, Rust and Go">
            <span className="tone-text font-mono-code">412 lines</span>over size limit
          </span>
        </div>
      </div>

      {focus.selectedNode ? (
        <ModuleInspectorCard selectedNode={focus.selectedNode} findings={findings} onSelectNodeId={focus.selectAndReveal} onInspectCode={onInspectCode} onClose={focus.clearSelection} />
      ) : (
        <GraphOverviewCard nodes={nodes} edges={edges} onSelect={focus.selectAndReveal} />
      )}
    </div>
  );
}
