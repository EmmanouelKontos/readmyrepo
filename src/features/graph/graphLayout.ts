import { ArchitecturalLayer, RepoNode } from '../../types/atlas';

export interface NodeBox {
  x: number;
  y: number;
  width: number;
  height: number;
  node: RepoNode;
}

export const LAYER_ORDER: { key: ArchitecturalLayer; label: string }[] = [
  { key: 'entry', label: 'Entry' },
  { key: 'feature', label: 'Features' },
  { key: 'ui', label: 'UI' },
  { key: 'service', label: 'Services' },
  { key: 'data', label: 'Types & data' },
  { key: 'config', label: 'Config' },
];

export const GRAPH_WIDTH = 1080;
const SIDE_PAD = 16;
const HEADER_H = 52;
const CARD_H = 56;
const ROW_GAP = 72;
const LANE_GAP = 16;
/** Narrowest card column we allow when wrapping a busy layer into several columns. */
const MIN_SUBCOL_W = 168;

/**
 * Rows needed so every layer fits in the available width: busy layers wrap into extra
 * card columns instead of growing one very tall lane.
 */
function fitRows(counts: number[], maxColumns: number): number {
  const tallest = Math.max(1, ...counts);
  for (let rows = 1; rows < tallest; rows++) {
    if (counts.reduce((sum, n) => sum + Math.max(1, Math.ceil(n / rows)), 0) <= maxColumns) return rows;
  }
  return tallest;
}

export function computeGraphLayout(nodes: RepoNode[]) {
  const activeLayers = LAYER_ORDER.filter((l) => nodes.some((n) => n.layer === l.key));
  const members = activeLayers.map((l) => nodes.filter((n) => n.layer === l.key));
  const counts = members.map((m) => m.length);
  const avail = GRAPH_WIDTH - SIDE_PAD * 2 - LANE_GAP * Math.max(0, activeLayers.length - 1);
  const maxColumns = Math.max(activeLayers.length, Math.floor(avail / MIN_SUBCOL_W));
  const rows = fitRows(counts, maxColumns);
  const subCols = counts.map((n) => Math.max(1, Math.ceil(n / rows)));
  const totalSubCols = subCols.reduce((a, b) => a + b, 0) || 1;
  const subColW = avail / totalSubCols;
  const cardW = Math.round(Math.min(200, subColW - 20));

  const coords = new Map<string, NodeBox>();
  const lanes: Array<{ key: ArchitecturalLayer; label: string; x: number; width: number; count: number }> = [];
  let laneX = SIDE_PAD;
  activeLayers.forEach((layer, i) => {
    const laneW = subColW * subCols[i];
    members[i].forEach((node, idx) => {
      const col = Math.floor(idx / rows);
      const row = idx % rows;
      const x = Math.round(laneX + col * subColW + (subColW - cardW) / 2);
      coords.set(node.id, { x, y: HEADER_H + 12 + row * ROW_GAP, width: cardW, height: CARD_H, node });
    });
    lanes.push({ ...layer, x: laneX, width: laneW, count: counts[i] });
    laneX += laneW + LANE_GAP;
  });

  const height = Math.max(320, HEADER_H + 12 + rows * ROW_GAP + 8);
  return { lanes, coords, colStep: subColW, cardW, width: GRAPH_WIDTH, height, headerH: HEADER_H };
}

/** Smooth cubic path between two node boxes, routing around same-column and long same-row links. */
export function edgePath(from: NodeBox, to: NodeBox, colStep: number): string {
  const sameCol = from.x === to.x;
  const goingRight = to.x > from.x;
  const longSameRow = !sameCol && Math.abs(to.x - from.x) > colStep * 1.2 && Math.abs(to.y - from.y) < 4;
  if (longSameRow) {
    const x1 = from.x + from.width / 2 + (goingRight ? 20 : -20);
    const x2 = to.x + to.width / 2 + (goingRight ? -20 : 20);
    const y = from.y - 1;
    const lift = 18 + Math.min(14, Math.abs(x2 - x1) * 0.03);
    return `M ${x1} ${y} C ${x1} ${y - lift}, ${x2} ${y - lift}, ${x2} ${y - 2}`;
  }
  if (sameCol) {
    const x1 = from.x + from.width;
    const y1 = from.y + from.height / 2;
    const x2 = to.x + to.width;
    const y2 = to.y + to.height / 2;
    const bulge = 22 + Math.min(30, Math.abs(y2 - y1) * 0.12);
    return `M ${x1} ${y1} C ${x1 + bulge} ${y1}, ${x2 + bulge} ${y2}, ${x2 + 1} ${y2}`;
  }
  const x1 = goingRight ? from.x + from.width : from.x;
  const x2 = goingRight ? to.x - 2 : to.x + to.width + 2;
  const y1 = from.y + from.height / 2;
  const y2 = to.y + to.height / 2;
  const dx = Math.max(36, Math.abs(x2 - x1) * 0.45);
  return `M ${x1} ${y1} C ${goingRight ? x1 + dx : x1 - dx} ${y1}, ${goingRight ? x2 - dx : x2 + dx} ${y2}, ${x2} ${y2}`;
}
