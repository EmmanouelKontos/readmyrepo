import React, { useEffect, useMemo, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { AuditFinding, DependencyEdge, RepoNode } from '../../types/atlas';
import { ModuleInspectorCard } from './ModuleInspectorCard';
import { computeGraphLayout, edgePath } from './graphLayout';

interface ArchitectureMapProps {
  nodes: RepoNode[];
  edges: DependencyEdge[];
  findings: AuditFinding[];
  onInspectCode: (node: RepoNode) => void;
}

type HighlightFilter = 'all' | 'issues' | 'cycles' | 'god';

const ZOOM_STEPS = [80, 90, 100, 115, 130];

function nodeIssueTone(node: RepoNode): string | null {
  if (node.maxSeverity === 'critical') return 'var(--tone-danger)';
  if (node.maxSeverity === 'high') return 'var(--tone-warning)';
  if (node.issueCount > 0) return 'var(--tone-info)';
  return null;
}

export function ArchitectureMap({ nodes, edges, findings, onInspectCode }: ArchitectureMapProps) {
  const [selectedId, setSelectedId] = useState<string>(nodes[0]?.id ?? '');
  const [highlightFilter, setHighlightFilter] = useState<HighlightFilter>('all');
  const [zoomIdx, setZoomIdx] = useState(2);

  useEffect(() => {
    setSelectedId(nodes[0]?.id ?? '');
    setHighlightFilter('all');
    setZoomIdx(2);
  }, [nodes]);

  const selectedNode = useMemo(() => nodes.find((n) => n.id === selectedId) ?? nodes[0], [nodes, selectedId]);
  const layout = useMemo(() => computeGraphLayout(nodes), [nodes]);
  const zoomPct = ZOOM_STEPS[zoomIdx];

  const matchesFilter = (node: RepoNode) =>
    highlightFilter === 'issues' ? node.issueCount > 0 : highlightFilter === 'cycles' ? node.inCycle : highlightFilter === 'god' ? node.isGodFile : true;

  const filterOptions: Array<[HighlightFilter, string, number]> = [
    ['all', 'All', nodes.length],
    ['issues', 'With issues', nodes.filter((n) => n.issueCount > 0).length],
    ['cycles', 'In cycles', nodes.filter((n) => n.inCycle).length],
    ['god', 'Large files', nodes.filter((n) => n.isGodFile).length],
  ];

  function handleNodeKey(e: React.KeyboardEvent, node: RepoNode) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (selectedId === node.id) onInspectCode(node);
      else setSelectedId(node.id);
    }
  }

  return (
    <div className="atlas-panel-animate grid grid-cols-1 xl:grid-cols-12 gap-3 items-stretch">
      <div className="xl:col-span-8 surface flex flex-col min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 divider-b">
          <div className="min-w-0">
            <h2 className="heading-section">Dependency map</h2>
            <p className="text-[0.75rem] text-muted">Select a module to trace its imports. Double-click or press Enter again to open it.</p>
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
              <button type="button" onClick={() => setZoomIdx(2)} className="btn btn-ghost btn-sm font-mono-code w-12 px-0 tabular-nums" title="Reset zoom">
                {zoomPct}%
              </button>
              <button type="button" onClick={() => setZoomIdx((i) => Math.min(ZOOM_STEPS.length - 1, i + 1))} disabled={zoomIdx === ZOOM_STEPS.length - 1} aria-label="Zoom in" className="btn btn-ghost btn-icon btn-sm">
                <Plus size={13} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-auto p-3 flex-1">
          <svg
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            role="group"
            aria-label="Module dependency graph"
            className="h-auto select-none block"
            style={{ width: `${zoomPct}%`, minWidth: `${Math.round(760 * (zoomPct / 100))}px`, transition: 'width 200ms var(--ease-out)' }}
          >
            <defs>
              <marker id="arrow-normal" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 Z" style={{ fill: 'var(--text-muted)' }} /></marker>
              <marker id="arrow-active" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 Z" style={{ fill: 'var(--text-primary)' }} /></marker>
              <marker id="arrow-cycle" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 Z" style={{ fill: 'var(--tone-danger)' }} /></marker>
            </defs>

            {layout.lanes.map((lane) => (
              <g key={lane.key}>
                <rect x={lane.x} y={0} width={lane.width} height={layout.height} rx={8} style={{ fill: 'var(--bg-elevated)', opacity: 0.55 }} />
                <text x={lane.x + 12} y={26} fontSize="11" fontWeight="500" letterSpacing="0.04em" style={{ fill: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {lane.label}
                  <tspan dx="6" className="font-mono-code" style={{ fill: 'var(--text-muted)', opacity: 0.7 }}>{lane.count}</tspan>
                </text>
              </g>
            ))}

            {edges.map((edge) => {
              const from = layout.coords.get(edge.from);
              const to = layout.coords.get(edge.to);
              if (!from || !to) return null;
              const isRelated = Boolean(selectedNode && (edge.from === selectedNode.id || edge.to === selectedNode.id));
              const stroke = edge.isCircular ? 'var(--tone-danger)' : isRelated ? 'var(--text-primary)' : 'var(--text-muted)';
              return (
                <path
                  key={`${edge.from}->${edge.to}`}
                  d={edgePath(from, to, layout.colStep)}
                  fill="none"
                  pathLength={isRelated && !edge.isCircular ? 1 : undefined}
                  className={`atlas-svg-edge ${isRelated && !edge.isCircular ? 'atlas-edge-draw' : ''}`}
                  style={{
                    stroke,
                    strokeWidth: isRelated || edge.isCircular ? 1.5 : 1,
                    strokeOpacity: isRelated ? 0.9 : edge.isCircular ? 0.75 : 0.3,
                    strokeDasharray: edge.isCircular ? '4 3' : undefined,
                    ['--edge-len' as string]: 1,
                  }}
                  markerEnd={edge.isCircular ? 'url(#arrow-cycle)' : isRelated ? 'url(#arrow-active)' : 'url(#arrow-normal)'}
                />
              );
            })}

            {Array.from(layout.coords.values()).map(({ x, y, width, height, node }) => {
              const isSelected = selectedNode?.id === node.id;
              const isConnected = Boolean(selectedNode && (selectedNode.imports.includes(node.id) || selectedNode.importedBy.includes(node.id)));
              const issueTone = nodeIssueTone(node);
              const stroke = isSelected ? 'var(--text-primary)' : node.inCycle ? 'var(--tone-danger)' : isConnected ? 'var(--text-secondary)' : 'var(--border-strong)';
              const maxChars = Math.max(8, Math.floor((width - (issueTone ? 32 : 22)) / 7.25));
              const label = node.name.length > maxChars ? `${node.name.slice(0, maxChars - 1)}…` : node.name;
              return (
                <g
                  key={node.id}
                  transform={`translate(${x}, ${y})`}
                  onClick={() => setSelectedId(node.id)}
                  onDoubleClick={() => onInspectCode(node)}
                  onKeyDown={(e) => handleNodeKey(e, node)}
                  tabIndex={0}
                  role="button"
                  aria-pressed={isSelected}
                  aria-label={`${node.path}, ${node.linesOfCode} lines, ${node.issueCount} issues`}
                  opacity={matchesFilter(node) ? 1 : 0.28}
                  className="atlas-svg-node cursor-pointer"
                >
                  <rect width={width} height={height} rx={7} style={{ fill: 'var(--bg-surface)', stroke, strokeWidth: isSelected ? 1.5 : 1, strokeOpacity: isSelected || isConnected || node.inCycle ? 1 : 0.9 }} />
                  {issueTone && <circle cx={13} cy={21} r={3} style={{ fill: issueTone }} />}
                  <text x={issueTone ? 22 : 12} y={25} fontSize="12" fontWeight="500" className="font-mono-code" style={{ fill: 'var(--text-primary)' }}>{label}</text>
                  <text x={12} y={43} fontSize="11" className="font-mono-code" style={{ fill: 'var(--text-muted)' }}>
                    <tspan style={node.isGodFile ? { fill: 'var(--tone-warning)' } : undefined}>{node.linesOfCode} lines</tspan>
                    {node.issueCount > 0 ? ` · ${node.issueCount} ${node.issueCount === 1 ? 'issue' : 'issues'}` : ''}
                  </text>
                  <title>{node.path}</title>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 px-4 py-2.5 divider-t text-[0.75rem] text-muted">
          <span className="inline-flex items-center gap-1.5"><span className="inline-block w-4 h-px" style={{ background: 'var(--text-primary)' }} />Selected path</span>
          <span className="inline-flex items-center gap-1.5"><span className="inline-block w-4 border-t border-dashed" style={{ borderColor: 'var(--tone-danger)' }} />Circular import</span>
          <span className="inline-flex items-center gap-1.5"><span className="tone-dot tone-danger" />Critical</span>
          <span className="inline-flex items-center gap-1.5"><span className="tone-dot tone-warning" />High</span>
          <span className="inline-flex items-center gap-1.5"><span className="tone-dot tone-info" />Medium / low</span>
          <span className="inline-flex items-center gap-1.5 tone-warning" title="Code lines over 220 for UI components, 400 for logic modules, 800 for C/C++/Rust/Go"><span className="tone-text font-mono-code">412 lines</span>over size limit</span>
        </div>
      </div>

      <ModuleInspectorCard selectedNode={selectedNode} findings={findings} onSelectNodeId={setSelectedId} onInspectCode={onInspectCode} />
    </div>
  );
}
