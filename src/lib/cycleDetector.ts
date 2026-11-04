import { ArchitecturalLayer, AuditFinding, DependencyEdge, RepoNode } from '../types/atlas';

const FORBIDDEN_UPWARD_IMPORTS: Partial<Record<ArchitecturalLayer, ArchitecturalLayer[]>> = {
  ui: ['feature', 'service', 'entry'],
  data: ['ui', 'feature', 'entry'],
};

/** Shared helpers (`lib/utils`, `cn()`, formatters) are fine to import from UI; data-access modules are not. */
function isDataAccessModule(path: string): boolean {
  const lower = path.toLowerCase();
  return /(^|\/)(services?|api|server|db|database|store|stores|clients?|repositories|queries|actions)\//.test(lower) || /(service|client|api|repository|store|queries)\.(t|j)sx?$/.test(lower);
}

/**
 * Runtime-relevant edges only: type-only TS imports are erased, Rust module graphs may legally
 * cycle, and Go files reference each other freely inside one package (cross-package cycles don't compile).
 */
function countsForCycles(edge: DependencyEdge): boolean {
  return !edge.typeOnly && !edge.from.endsWith('.rs') && !edge.from.endsWith('.go');
}

/** Tarjan's strongly connected components (iterative-safe for the ≤ few hundred nodes we analyze). */
function stronglyConnected(ids: string[], adj: Map<string, string[]>): string[][] {
  let index = 0;
  const idx = new Map<string, number>();
  const low = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const out: string[][] = [];

  const visit = (v: string) => {
    idx.set(v, index);
    low.set(v, index++);
    stack.push(v);
    onStack.add(v);
    for (const w of adj.get(v) ?? []) {
      if (!idx.has(w)) {
        visit(w);
        low.set(v, Math.min(low.get(v)!, low.get(w)!));
      } else if (onStack.has(w)) {
        low.set(v, Math.min(low.get(v)!, idx.get(w)!));
      }
    }
    if (low.get(v) === idx.get(v)) {
      const comp: string[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        comp.push(w);
      } while (w !== v);
      if (comp.length > 1) out.push(comp);
    }
  };

  for (const id of ids) if (!idx.has(id)) visit(id);
  return out;
}

/** Shortest cycle through `start` inside a component (BFS), used for a readable finding title. */
function shortestCycle(start: string, members: Set<string>, adj: Map<string, string[]>): string[] {
  const prev = new Map<string, string>();
  const queue = [start];
  const seen = new Set([start]);
  while (queue.length) {
    const cur = queue.shift()!;
    for (const next of adj.get(cur) ?? []) {
      if (!members.has(next)) continue;
      if (next === start) {
        const path = [cur];
        while (path[0] !== start) path.unshift(prev.get(path[0])!);
        return path;
      }
      if (!seen.has(next)) {
        seen.add(next);
        prev.set(next, cur);
        queue.push(next);
      }
    }
  }
  return [start];
}

export function detectGraphCyclesAndInversions(
  nodesMap: Map<string, RepoNode>,
  edges: DependencyEdge[],
  archFindings: AuditFinding[],
  pathClassified: Set<string> = new Set(nodesMap.keys())
): number {
  const adj = new Map<string, string[]>();
  for (const id of nodesMap.keys()) adj.set(id, []);
  for (const e of edges) if (countsForCycles(e)) adj.get(e.from)?.push(e.to);

  const components = stronglyConnected(Array.from(nodesMap.keys()), adj);
  const componentOf = new Map<string, number>();

  components.forEach((comp, ci) => {
    const members = new Set(comp);
    for (const id of comp) {
      componentOf.set(id, ci);
      nodesMap.get(id)!.inCycle = true;
    }
    const start = [...comp].sort()[0];
    const cycle = shortestCycle(start, members, adj);
    const names = cycle.map((id) => nodesMap.get(id)?.name ?? id);
    const label = cycle.length === 2 ? `${names[0]} ↔ ${names[1]}` : `${names.join(' → ')} → ${names[0]}`;
    const firstEdge = edges.find((e) => e.from === cycle[0] && e.to === (cycle[1] ?? cycle[0]) && countsForCycles(e));
    const extra = comp.length > cycle.length ? ` (+${comp.length - cycle.length} more in this group)` : '';
    archFindings.push({
      id: `arch-cycle-${[...comp].sort().join('::')}`,
      ruleId: 'ARCH-002',
      title: `Circular Dependency Detected (${label})${extra}`,
      category: 'architecture',
      severity: 'high',
      filePath: cycle[0],
      lineNumber: firstEdge?.line ?? 1,
      codeSnippet: [...cycle, cycle[0]].join(' -> '),
      explanation: `${comp.length} modules import each other in a loop. Circular imports cause undefined initialization order, TDZ crashes in bundlers, and make modules impossible to test in isolation.`,
      remediation: 'Extract the shared interfaces, constants, or domain logic into a lower-layer module (e.g. `types/` or `lib/`) that both sides import.',
      aiFixPrompt: `Break the circular dependency \`${[...cycle, cycle[0]].join(' -> ')}\` (ARCH-002) by extracting shared contracts into a lower-layer module.`,
    });
  });

  for (const edge of edges) {
    const a = componentOf.get(edge.from);
    if (a !== undefined && a === componentOf.get(edge.to) && countsForCycles(edge)) edge.isCircular = true;

    const fromNode = nodesMap.get(edge.from);
    const toNode = nodesMap.get(edge.to);
    if (!fromNode || !toNode || edge.isCircular || edge.typeOnly) continue;
    if (!pathClassified.has(fromNode.id) || !pathClassified.has(toNode.id)) continue;
    if (!FORBIDDEN_UPWARD_IMPORTS[fromNode.layer]?.includes(toNode.layer)) continue;
    if (toNode.layer === 'service' && !isDataAccessModule(toNode.path)) continue;
    // Rust items re-exported from a crate/module root (`use crate::Error`) are idiomatic, not an inversion.
    if (edge.from.endsWith('.rs') && /(^|\/)(lib|main|mod)\.rs$/.test(toNode.path)) continue;
    archFindings.push({
      id: `arch-inversion-${edge.from}-${edge.to}`,
      ruleId: 'ARCH-003',
      title: `Upward Layer Inversion (\`${fromNode.layer}\` Layer Importing \`${toNode.layer}\`)`,
      category: 'architecture',
      severity: 'medium',
      filePath: edge.from,
      lineNumber: edge.line ?? 1,
      codeSnippet: `${edge.from} (${fromNode.layer}) -> ${edge.to} (${toNode.layer})`,
      explanation: `Lower-level \`${fromNode.layer}\` module \`${fromNode.path}\` imports the higher-level \`${toNode.layer}\` module \`${toNode.path}\`, breaking one-way dependency flow.`,
      remediation: 'Pass data or callbacks down via props/parameters instead of importing feature or service modules inside UI primitives or data schemas.',
      aiFixPrompt: `Fix the upward layer inversion in \`${edge.from}\` (ARCH-003): remove the direct import of \`${edge.to}\` and invert the dependency via props or shared types.`,
    });
  }

  return components.length;
}
