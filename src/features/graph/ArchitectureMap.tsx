import { useEffect, useMemo, useState } from 'react';
import { Eye, Layers, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { ArchitecturalLayer, AuditFinding, DependencyEdge, RepoNode } from '../../types/atlas';
import { ModuleInspectorCard } from './ModuleInspectorCard';

interface ArchitectureMapProps {
  nodes: RepoNode[];
  edges: DependencyEdge[];
  findings: AuditFinding[];
  onInspectCode: (node: RepoNode) => void;
}

type HighlightFilter = 'all' | 'issues' | 'cycles' | 'god';

const LAYER_ORDER: { key: ArchitecturalLayer; step: string; label: string }[] = [
  { key: 'entry', step: '01', label: 'Entry & Routes' },
  { key: 'feature', step: '02', label: 'Feature Views' },
  { key: 'ui', step: '03', label: 'UI Primitives' },
  { key: 'service', step: '04', label: 'Services & API' },
  { key: 'data', step: '05', label: 'Types & Schema' },
  { key: 'config', step: '06', label: 'Configuration' },
];

export function ArchitectureMap({ nodes, edges, findings, onInspectCode }: ArchitectureMapProps) {
  const [selectedId, setSelectedId] = useState<string>(nodes[0]?.id ?? '');
  const [highlightFilter, setHighlightFilter] = useState<HighlightFilter>('all');
  const [zoomPct, setZoomPct] = useState<number>(100);

  useEffect(() => {
    setSelectedId(nodes[0]?.id ?? '');
    setHighlightFilter('all');
    setZoomPct(100);
  }, [nodes]);

  const selectedNode = useMemo(() => nodes.find((n) => n.id === selectedId) ?? nodes[0], [nodes, selectedId]);

  const positioned = useMemo(() => {
    const activeLayers = LAYER_ORDER.filter((l) => nodes.some((n) => n.layer === l.key));
    const coords = new Map<string, { x: number; y: number; width: number; height: number; node: RepoNode }>();
    const count = Math.max(1, activeLayers.length);
    const svgWidth = 1080;
    const sidePad = 24;
    const cardW = count <= 4 ? 204 : count === 5 ? 182 : 156;
    const cardH = 68;
    const rowGap = 92;
    const colStep = count > 1 ? (svgWidth - sidePad * 2 - cardW) / (count - 1) : 0;

    activeLayers.forEach((layer, colIdx) => {
      const colX = Math.round(sidePad + colIdx * colStep);
      nodes.filter((n) => n.layer === layer.key).forEach((node, rowIdx) => {
        coords.set(node.id, { x: colX, y: 72 + rowIdx * rowGap, width: cardW, height: cardH, node });
      });
    });

    const maxRows = Math.max(1, ...activeLayers.map((l) => nodes.filter((n) => n.layer === l.key).length));
    return { activeLayers, coords, colStep, sidePad, cardW, svgWidth, svgHeight: Math.max(390, maxRows * rowGap + 88) };
  }, [nodes]);

  const matchesFilter = (node: RepoNode) =>
    highlightFilter === 'issues' ? node.issueCount > 0 : highlightFilter === 'cycles' ? node.inCycle : highlightFilter === 'god' ? node.isGodFile : true;

  const filterOptions: Array<[HighlightFilter, string]> = [
    ['all', `All (${nodes.length})`],
    ['issues', `Issues (${nodes.filter((n) => n.issueCount > 0).length})`],
    ['cycles', `Cycles (${nodes.filter((n) => n.inCycle).length})`],
    ['god', `>220 LOC (${nodes.filter((n) => n.isGodFile).length})`],
  ];

  return (
    <div className="atlas-panel-animate grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
      <div className="lg:col-span-8 rounded-xl p-5 flex flex-col justify-between" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-hairline)' }}>
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4" style={{ borderBottom: '1px solid var(--border-hairline)' }}>
            <div>
              <div className="flex items-center gap-2">
                <Layers size={16} style={{ color: 'var(--accent-brand)' }} aria-hidden="true" />
                <h2 className="heading-section">Layered Architecture Topology</h2>
              </div>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                Click any module node to trace its upstream callers and downstream imports, or double-click to inspect source.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {filterOptions.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setHighlightFilter(key)}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors"
                  style={{
                    backgroundColor: highlightFilter === key ? 'var(--accent-brand)' : 'var(--bg-elevated)',
                    color: highlightFilter === key ? '#FFFFFF' : 'var(--text-secondary)',
                    border: '1px solid var(--border-hairline)',
                  }}
                >
                  {label}
                </button>
              ))}

              <div className="flex items-center gap-0.5 ml-1 p-0.5 rounded-lg" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-hairline)' }}>
                <button type="button" onClick={() => setZoomPct((z) => Math.max(80, z - 10))} aria-label="Zoom out graph" className="p-1 rounded cursor-pointer"><ZoomOut size={13} aria-hidden="true" /></button>
                <span className="font-mono-code text-[0.7rem] px-1.5">{zoomPct}%</span>
                <button type="button" onClick={() => setZoomPct((z) => Math.min(130, z + 10))} aria-label="Zoom in graph" className="p-1 rounded cursor-pointer"><ZoomIn size={13} aria-hidden="true" /></button>
                {zoomPct !== 100 && <button type="button" onClick={() => setZoomPct(100)} aria-label="Reset zoom" className="p-1 rounded cursor-pointer"><RotateCcw size={12} aria-hidden="true" /></button>}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto pb-2">
            <svg width={positioned.svgWidth} height={positioned.svgHeight} viewBox={`0 0 ${positioned.svgWidth} ${positioned.svgHeight}`} role="img" aria-label="Interactive repository module dependency graph" className="w-full h-auto select-none transition-transform duration-200 origin-top-left" style={{ width: `${zoomPct}%` }}>
              <defs>
                <marker id="arrow-normal" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><polygon points="0 0, 7 3.5, 0 7" fill="#8C8A84" /></marker>
                <marker id="arrow-cycle" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><polygon points="0 0, 7 3.5, 0 7" fill="#DC2626" /></marker>
                <marker id="arrow-active" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><polygon points="0 0, 7 3.5, 0 7" fill="#D97757" /></marker>
              </defs>

              {positioned.activeLayers.map((layer, idx) => {
                const colX = Math.round(positioned.sidePad + idx * positioned.colStep);
                const count = nodes.filter((n) => n.layer === layer.key).length;
                return (
                  <g key={layer.key}>
                    <text x={colX} y={24} fontSize="11.5" fontWeight="700" fill="currentColor" opacity="0.84" className="font-mono-code">
                      {layer.step} · {layer.label} ({count})
                    </text>
                    <line x1={colX} y1={36} x2={colX + positioned.cardW} y2={36} stroke="currentColor" strokeOpacity="0.16" />
                  </g>
                );
              })}

              {edges.map((edge) => {
                const fromBox = positioned.coords.get(edge.from);
                const toBox = positioned.coords.get(edge.to);
                if (!fromBox || !toBox) return null;
                const isRelated = Boolean(selectedNode && (edge.from === selectedNode.id || edge.to === selectedNode.id));
                const sameCol = fromBox.x === toBox.x;
                const goingRight = toBox.x >= fromBox.x;
                const multiColSpan = Math.abs(toBox.x - fromBox.x) > Math.max(200, positioned.colStep * 1.15);
                const isTopRowSpan = multiColSpan && Math.abs(fromBox.y - toBox.y) < 20;
                const x1 = isTopRowSpan ? fromBox.x + fromBox.width * 0.65 : sameCol || goingRight ? fromBox.x + fromBox.width : fromBox.x;
                const y1 = isTopRowSpan ? fromBox.y : fromBox.y + fromBox.height / 2;
                const x2 = isTopRowSpan ? toBox.x + toBox.width * 0.35 : sameCol ? toBox.x + toBox.width : goingRight ? toBox.x : toBox.x + toBox.width;
                const y2 = isTopRowSpan ? toBox.y : toBox.y + toBox.height / 2;
                const dx = Math.max(42, Math.abs(x2 - x1) * 0.42);
                const pathD = isTopRowSpan
                  ? `M ${x1} ${y1} C ${x1} ${y1 - 30}, ${x2} ${y2 - 30}, ${x2} ${y2}`
                  : sameCol
                  ? `M ${x1} ${y1} C ${x1 + 36} ${y1}, ${x2 + 36} ${y2}, ${x2} ${y2}`
                  : `M ${x1} ${y1} C ${goingRight ? x1 + dx : x1 - dx} ${y1}, ${goingRight ? x2 - dx : x2 + dx} ${y2}, ${x2} ${y2}`;
                const stroke = edge.isCircular ? '#DC2626' : isRelated ? '#D97757' : '#8C8A84';
                const marker = edge.isCircular ? 'url(#arrow-cycle)' : isRelated ? 'url(#arrow-active)' : 'url(#arrow-normal)';

                return (
                  <path
                    key={`${edge.from}->${edge.to}`}
                    d={pathD}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={edge.isCircular || isRelated ? 2.2 : 1.3}
                    strokeOpacity={edge.isCircular || isRelated ? 0.95 : 0.28}
                    markerEnd={marker}
                    className={edge.isCircular || isRelated ? 'atlas-edge-animated' : undefined}
                  />
                );
              })}

              {Array.from(positioned.coords.values()).map(({ x, y, width, height, node }) => {
                const isSelected = selectedNode?.id === node.id;
                const isConnected = selectedNode && (selectedNode.imports.includes(node.id) || selectedNode.importedBy.includes(node.id));
                const borderStroke = node.inCycle ? '#DC2626' : isSelected ? '#D97757' : node.maxSeverity === 'critical' ? '#EF4444' : node.maxSeverity === 'high' ? '#F59E0B' : 'currentColor';

                return (
                  <g key={node.id} transform={`translate(${x}, ${y})`} onClick={() => setSelectedId(node.id)} onDoubleClick={() => onInspectCode(node)} opacity={matchesFilter(node) ? 1 : 0.32} className="atlas-svg-node cursor-pointer">
                    <rect width={width} height={height} rx={10} fill="var(--bg-elevated)" stroke={borderStroke} strokeOpacity={isSelected || isConnected || node.inCycle || node.issueCount > 0 ? 0.95 : 0.22} strokeWidth={isSelected ? 2.4 : isConnected ? 1.7 : 1.2} />
                    <text x={12} y={24} fontSize="12.5" fontWeight="600" fill="currentColor" className="font-mono-code">
                      {node.name.length > 21 ? `${node.name.slice(0, 20)}…` : node.name}
                    </text>
                    <text x={12} y={46} fontSize="11" fill="currentColor" opacity="0.68" className="font-mono-code">
                      {node.linesOfCode} LOC · {node.issueCount === 0 ? 'Clean' : `${node.issueCount} ${node.issueCount === 1 ? 'issue' : 'issues'}`}
                    </text>
                    {(node.inCycle || node.isGodFile) && (
                      <circle cx={width - 14} cy={18} r={4.5} fill={node.inCycle ? '#DC2626' : '#F59E0B'}>
                        <title>{node.inCycle ? 'Circular Dependency' : 'Oversized God Module (>220 LOC)'}</title>
                      </circle>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 mt-2 text-xs" style={{ borderTop: '1px solid var(--border-hairline)', color: 'var(--text-secondary)' }}>
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 inline-block" style={{ backgroundColor: 'var(--accent-brand)' }} /><span>Animated Active Path</span></span>
            <span className="flex items-center gap-1.5 text-red-600 dark:text-red-400 font-medium"><span className="w-3 h-0.5 bg-red-500 inline-block" /><span>Circular Import Cycle</span></span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /><span>Oversized Module (&gt;220 LOC)</span></span>
          </div>
          <span className="flex items-center gap-1 font-mono-code text-xs" style={{ color: 'var(--text-muted)' }}>
            <Eye size={13} aria-hidden="true" /> Double-click any node to inspect code
          </span>
        </div>
      </div>

      <ModuleInspectorCard selectedNode={selectedNode} findings={findings} onSelectNodeId={setSelectedId} onInspectCode={onInspectCode} />
    </div>
  );
}
