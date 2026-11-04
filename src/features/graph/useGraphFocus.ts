import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RepoNode } from '../../types/atlas';
import { NodeBox } from './graphLayout';

type Direction = 'up' | 'down' | 'left' | 'right';

const ARROW: Record<string, Direction> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };

/** Nearest box in a direction, preferring alignment on the cross axis (spatial grid navigation). */
function neighbourInDirection(from: NodeBox, boxes: NodeBox[], dir: Direction): NodeBox | null {
  const cx = from.x + from.width / 2;
  const cy = from.y + from.height / 2;
  let best: NodeBox | null = null;
  let bestScore = Infinity;
  for (const b of boxes) {
    if (b === from) continue;
    const dx = b.x + b.width / 2 - cx;
    const dy = b.y + b.height / 2 - cy;
    const primary = dir === 'left' ? -dx : dir === 'right' ? dx : dir === 'up' ? -dy : dy;
    if (primary <= 1) continue;
    const cross = dir === 'left' || dir === 'right' ? Math.abs(dy) : Math.abs(dx);
    const score = primary + cross * 2.5;
    if (score < bestScore) {
      bestScore = score;
      best = b;
    }
  }
  return best;
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Selection + transient focus (hover / keyboard) for the dependency map.
 * `focusId` drives the neighbourhood highlight: a hovered module previews its links,
 * otherwise the selected one is shown.
 */
export function useGraphFocus(nodes: RepoNode[], coords: Map<string, NodeBox>, onOpen: (node: RepoNode) => void) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const nodeRefs = useRef(new Map<string, SVGGElement>());
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  // A rescan keeps the selection when the module still exists.
  useEffect(() => {
    setSelectedId((id) => (id && byId.has(id) ? id : null));
    setPreviewId(null);
  }, [byId]);

  // Short window after a selection change in which its paths play the draw-in animation.
  const [drawFor, setDrawFor] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedId) return;
    setDrawFor(selectedId);
    const t = window.setTimeout(() => setDrawFor(null), 460);
    return () => window.clearTimeout(t);
  }, [selectedId]);

  const focusId = previewId ?? selectedId;
  const focusNode = focusId ? byId.get(focusId) : undefined;
  const outgoing = useMemo(() => new Set(focusNode?.imports ?? []), [focusNode]);
  const incoming = useMemo(() => new Set(focusNode?.importedBy ?? []), [focusNode]);

  /** Select a module and bring it into view (used by the inspector's link chips). */
  const selectAndReveal = useCallback((id: string) => {
    setSelectedId(id);
    setPreviewId(null);
    requestAnimationFrame(() => {
      nodeRefs.current.get(id)?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedId(null);
    setPreviewId(null);
  }, []);

  function handleNodeKeyDown(e: React.KeyboardEvent, node: RepoNode) {
    const dir = ARROW[e.key];
    if (dir) {
      e.preventDefault();
      const from = coords.get(node.id);
      const next = from ? neighbourInDirection(from, Array.from(coords.values()), dir) : null;
      if (next) nodeRefs.current.get(next.node.id)?.focus();
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (selectedId === node.id) onOpen(node);
      else setSelectedId(node.id);
    } else if (e.key === 'Escape' && selectedId) {
      e.preventDefault();
      clearSelection();
    }
  }

  const registerNode = useCallback((id: string) => (el: SVGGElement | null) => {
    if (el) nodeRefs.current.set(id, el);
    else nodeRefs.current.delete(id);
  }, []);

  /** Roving tabindex: one tab stop for the whole map. */
  const tabStopId = selectedId ?? nodes[0]?.id ?? null;

  return {
    selectedId,
    drawFor,
    selectedNode: selectedId ? byId.get(selectedId) : undefined,
    focusId,
    outgoing,
    incoming,
    tabStopId,
    setSelectedId,
    setPreviewId,
    selectAndReveal,
    clearSelection,
    handleNodeKeyDown,
    registerNode,
  };
}
