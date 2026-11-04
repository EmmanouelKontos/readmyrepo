import { useMemo } from 'react';
import { DependencyEdge, RepoNode } from '../../types/atlas';
import { computeGraphLayout, edgePath } from './graphLayout';
import { useGraphFocus } from './useGraphFocus';

type Layout = ReturnType<typeof computeGraphLayout>;
type Focus = ReturnType<typeof useGraphFocus>;

interface GraphCanvasProps {
  layout: Layout;
  edges: DependencyEdge[];
  focus: Focus;
  zoomPct: number;
  matchesFilter: (node: RepoNode) => boolean;
  onOpen: (node: RepoNode) => void;
}

function issueTone(node: RepoNode): string | null {
  if (node.maxSeverity === 'critical') return 'var(--tone-danger)';
  if (node.maxSeverity === 'high') return 'var(--tone-warning)';
  if (node.issueCount > 0) return 'var(--tone-info)';
  return null;
}

type EdgeRole = 'out' | 'in' | 'idle';

const MARKERS: Array<[string, string]> = [
  ['arrow-idle', 'var(--text-muted)'],
  ['arrow-out', 'var(--text-primary)'],
  ['arrow-in', 'var(--accent-brand)'],
  ['arrow-cycle', 'var(--tone-danger)'],
];

export function GraphCanvas({ layout, edges, focus, zoomPct, matchesFilter, onOpen }: GraphCanvasProps) {
  const { focusId, selectedId, drawFor, outgoing, incoming } = focus;

  const routed = useMemo(
    () =>
      edges.flatMap((edge) => {
        const from = layout.coords.get(edge.from);
        const to = layout.coords.get(edge.to);
        return from && to ? [{ edge, d: edgePath(from, to, layout.colStep), dimmedByFilter: !matchesFilter(from.node) || !matchesFilter(to.node) }] : [];
      }),
    [edges, layout, matchesFilter]
  );

  const roleOf = (edge: DependencyEdge): EdgeRole => (edge.from === focusId ? 'out' : edge.to === focusId ? 'in' : 'idle');
  // Highlighted edges render last so they sit above the idle mesh.
  const ordered = focusId ? [...routed].sort((a, b) => Number(roleOf(a.edge) !== 'idle') - Number(roleOf(b.edge) !== 'idle')) : routed;

  return (
    <svg
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      role="group"
      aria-label="Module dependency graph. Arrow keys move between modules, Enter selects, Escape clears."
      className="atlas-graph h-auto select-none block"
      data-focused={focusId ? 'true' : undefined}
      onClick={focus.clearSelection}
      width={Math.round(layout.width * (zoomPct / 100))}
      height={Math.round(layout.height * (zoomPct / 100))}
    >
      <defs>
        {MARKERS.map(([id, fill]) => (
          <marker key={id} id={id} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0 0 L6 3 L0 6 Z" style={{ fill }} />
          </marker>
        ))}
      </defs>

      {layout.lanes.map((lane) => (
        <g key={lane.key}>
          <title>{`${lane.label}: ${lane.description}`}</title>
          <rect x={lane.x} y={0} width={lane.width} height={layout.height} rx={8} style={{ fill: 'var(--bg-elevated)', opacity: 0.55 }} />
          <text x={lane.x + 12} y={28} fontSize="12" fontWeight="600" letterSpacing="0.04em" style={{ fill: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            {lane.label}
            <tspan dx="6" className="font-mono-code" style={{ fill: 'var(--text-muted)', opacity: 0.7 }}>{lane.count}</tspan>
          </text>
        </g>
      ))}

      <g className="atlas-graph-edges">
        {ordered.map(({ edge, d, dimmedByFilter }) => {
          const role = roleOf(edge);
          const active = role !== 'idle';
          // Paths draw in once, right after a selection is committed — never on hover or when a preview ends.
          const drawIn = active && drawFor !== null && drawFor === focusId;
          const stroke = edge.isCircular ? 'var(--tone-danger)' : role === 'out' ? 'var(--text-primary)' : role === 'in' ? 'var(--accent-brand)' : 'var(--text-muted)';
          const opacity = active ? 0.95 : focusId ? (edge.isCircular ? 0.22 : 0.06) : dimmedByFilter ? 0.1 : edge.isCircular ? 0.75 : 0.3;
          return (
            <path
              key={`${edge.from}->${edge.to}`}
              d={d}
              fill="none"
              pathLength={drawIn && !edge.isCircular ? 1 : undefined}
              className={`atlas-svg-edge ${drawIn && !edge.isCircular ? 'atlas-edge-draw' : ''}`}
              style={{ stroke, opacity, strokeWidth: active ? 1.6 : 1, strokeDasharray: edge.isCircular ? '4 3' : undefined }}
              markerEnd={`url(#${edge.isCircular ? 'arrow-cycle' : `arrow-${role}`})`}
            />
          );
        })}
      </g>

      {Array.from(layout.coords.values()).map(({ x, y, width, height, node }, i) => {
        const isSelected = selectedId === node.id;
        const isFocus = focusId === node.id;
        const isNeighbour = outgoing.has(node.id) || incoming.has(node.id);
        const tone = issueTone(node);
        const stroke = isSelected || isFocus
          ? 'var(--text-primary)'
          : node.inCycle
            ? 'var(--tone-danger)'
            : isNeighbour
              ? incoming.has(node.id) ? 'color-mix(in srgb, var(--accent-brand) 45%, var(--border-strong))' : 'var(--text-secondary)'
              : 'var(--border-strong)';
        const textX = tone ? 25 : 14;
        // Geist Mono advances ~0.6em per character (13px → ~7.8px)
        const maxChars = Math.max(8, Math.floor((width - textX - 10) / 7.8));
        const label = node.name.length > maxChars ? `${node.name.slice(0, maxChars - 1)}…` : node.name;
        // The pinned module stays solid while another one is previewed, so you never lose your place.
        const opacity = !matchesFilter(node) ? 0.28 : focusId && !isFocus && !isNeighbour && !isSelected ? 0.4 : 1;
        return (
          <g
            key={node.id}
            ref={focus.registerNode(node.id)}
            transform={`translate(${x}, ${y})`}
            onClick={(e) => { e.stopPropagation(); focus.setSelectedId(node.id); }}
            onDoubleClick={(e) => { e.stopPropagation(); onOpen(node); }}
            onPointerEnter={() => focus.setPreviewId(node.id)}
            onPointerLeave={() => focus.setPreviewId(null)}
            onFocus={() => focus.setPreviewId(node.id)}
            onBlur={() => focus.setPreviewId(null)}
            onKeyDown={(e) => focus.handleNodeKeyDown(e, node)}
            tabIndex={focus.tabStopId === node.id ? 0 : -1}
            role="button"
            aria-pressed={isSelected}
            aria-label={`${node.path}, ${node.linesOfCode} lines, ${node.imports.length} imports, imported by ${node.importedBy.length}, ${node.issueCount} issues`}
            opacity={opacity}
            className="atlas-svg-node cursor-pointer"
            data-selected={isSelected || undefined}
          >
            <g className="atlas-node-body" style={{ ['--i' as string]: Math.min(i, 40) }}>
              <rect className="atlas-node-card" width={width} height={height} rx={7} style={{ stroke, strokeWidth: isSelected ? 1.5 : 1 }} />
              <rect className="atlas-node-bar" x={4} y={13} width={2.5} height={height - 26} rx={1.25} />
              {tone && <circle cx={15} cy={23} r={3.5} style={{ fill: tone }} />}
              <text x={textX} y={27.5} fontSize="13" fontWeight="500" className="font-mono-code" style={{ fill: 'var(--text-primary)' }}>{label}</text>
              <text x={14} y={47} fontSize="12" className="font-mono-code" style={{ fill: 'var(--text-secondary)' }}>
                <tspan style={node.isGodFile ? { fill: 'var(--tone-warning)' } : undefined}>{node.linesOfCode} lines</tspan>
                {node.issueCount > 0 ? ` · ${node.issueCount} ${node.issueCount === 1 ? 'issue' : 'issues'}` : ''}
              </text>
            </g>
            <title>{node.path}</title>
          </g>
        );
      })}
    </svg>
  );
}
