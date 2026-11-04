import {
  ArchitecturalLayer,
  AuditFinding,
  AuditSeverity,
  DependencyEdge,
  RepoNode,
  RepoScores,
} from '../types/atlas';

export function isCommentLine(line: string, filePath: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;
  if (
    trimmed.startsWith('//') ||
    trimmed.startsWith('/*') ||
    trimmed.startsWith('*') ||
    trimmed.startsWith('*/') ||
    trimmed.startsWith('<!--') ||
    trimmed.startsWith('--')
  ) {
    return true;
  }
  if (
    trimmed.startsWith('#') &&
    !trimmed.startsWith('#include') &&
    !trimmed.startsWith('#define') &&
    !trimmed.startsWith('#ifndef') &&
    !trimmed.startsWith('#endif') &&
    !filePath.endsWith('.rs')
  ) {
    return true;
  }
  return false;
}

const FORBIDDEN_UPWARD_IMPORTS: Partial<Record<ArchitecturalLayer, ArchitecturalLayer[]>> = {
  ui: ['feature', 'service', 'entry'],
  data: ['ui', 'feature', 'service', 'entry'],
};

export function detectGraphCyclesAndInversions(
  nodesMap: Map<string, RepoNode>,
  rawEdges: DependencyEdge[],
  archFindings: AuditFinding[]
): number {
  const adj = new Map<string, string[]>();
  for (const node of nodesMap.keys()) adj.set(node, []);
  for (const edge of rawEdges) {
    adj.get(edge.from)?.push(edge.to);
  }

  const recordedCycles = new Set<string>();
  const cyclicEdgePairs = new Set<string>();
  let circularCount = 0;

  // Elementary DFS cycle detection (catches both 2-node A<->B and multi-hop A->B->C->A cycles)
  for (const startNode of nodesMap.keys()) {
    const visited = new Set<string>();
    const path: string[] = [startNode];

    const dfs = (curr: string) => {
      visited.add(curr);
      for (const next of adj.get(curr) ?? []) {
        if (next === startNode && path.length >= 2) {
          // Canonicalize cycle key by sorting member IDs to avoid counting rotations twice
          const sortedKey = [...path].sort().join('::');
          for (let i = 0; i < path.length; i++) {
            const u = path[i];
            const v = path[(i + 1) % path.length];
            cyclicEdgePairs.add(`${u}->${v}`);
            nodesMap.get(u)!.inCycle = true;
            nodesMap.get(v)!.inCycle = true;
          }
          if (!recordedCycles.has(sortedKey)) {
            recordedCycles.add(sortedKey);
            circularCount++;
            const names = path.map((id) => nodesMap.get(id)?.name ?? id);
            const cycleLabel =
              path.length === 2
                ? `${names[0]} <-> ${names[1]}`
                : `${names.join(' -> ')} -> ${names[0]}`;
            archFindings.push({
              id: `arch-cycle-${sortedKey}`,
              ruleId: 'ARCH-002',
              title: `Circular Dependency Detected (${cycleLabel})`,
              category: 'architecture',
              severity: 'high',
              filePath: path[0],
              lineNumber: 1,
              codeSnippet: [...path, path[0]].join(' -> '),
              explanation:
                'Circular import chains between modules cause undefined initialization order bugs, bundler TDZ crashes, and tangled architectural boundaries.',
              remediation:
                'Extract shared interfaces, constants, or domain logic into a lower-layer `src/types/` or `src/lib/` module.',
              aiFixPrompt: `Break the circular dependency cycle \`${[...path, path[0]].join(' -> ')}\` (ARCH-002) by extracting shared contracts into a lower-layer module.`,
            });
          }
        } else if (!visited.has(next) && path.length < 8) {
          path.push(next);
          dfs(next);
          path.pop();
        }
      }
    };

    dfs(startNode);
  }

  for (const edge of rawEdges) {
    if (cyclicEdgePairs.has(`${edge.from}->${edge.to}`)) {
      edge.isCircular = true;
    }

    // ARCH-003: Upward Architectural Layer Inversion (e.g., stateless UI importing Feature/Service)
    const fromNode = nodesMap.get(edge.from);
    const toNode = nodesMap.get(edge.to);
    if (fromNode && toNode && !edge.isCircular) {
      const forbidden = FORBIDDEN_UPWARD_IMPORTS[fromNode.layer];
      if (forbidden?.includes(toNode.layer)) {
        archFindings.push({
          id: `arch-inversion-${edge.from}-${edge.to}`,
          ruleId: 'ARCH-003',
          title: `Upward Layer Inversion (\`${fromNode.layer}\` Layer Importing \`${toNode.layer}\`)`,
          category: 'architecture',
          severity: 'medium',
          filePath: edge.from,
          lineNumber: 1,
          codeSnippet: `${edge.from} (${fromNode.layer}) -> ${edge.to} (${toNode.layer})`,
          explanation: `Lower-level \`${fromNode.layer}\` module \`${fromNode.path}\` imports upward from \`${toNode.layer}\` module \`${toNode.path}\`, violating strict unidirectional dependency flow.`,
          remediation:
            'Pass data or callbacks down via props/parameters instead of importing higher-level feature or service modules inside UI primitives or data schemas.',
          aiFixPrompt: `Fix the upward layer inversion in \`${edge.from}\` (ARCH-003): remove the direct import of \`${edge.to}\` and invert the dependency via props or shared types.`,
        });
      }
    }
  }

  return circularCount;
}

function sumWeightedPenalties(
  findings: AuditFinding[],
  weights: Record<AuditSeverity, number>,
  maxPerRule = 32
): number {
  const ruleHits = new Map<string, number>();
  const ruleTotals = new Map<string, number>();

  for (const f of findings) {
    const hits = (ruleHits.get(f.ruleId) ?? 0) + 1;
    ruleHits.set(f.ruleId, hits);
    const base = weights[f.severity];
    const multiplier = hits === 1 ? 1 : hits === 2 ? 0.65 : 0.35;
    const prevTotal = ruleTotals.get(f.ruleId) ?? 0;
    const cap = f.ruleId === 'ARCH-001' ? 28 : maxPerRule;
    ruleTotals.set(f.ruleId, Math.min(cap, prevTotal + Math.round(base * multiplier)));
  }

  let total = 0;
  for (const val of ruleTotals.values()) total += val;
  return total;
}

export function computeAccurateScores(
  nodes: RepoNode[],
  secFindings: AuditFinding[],
  perfFindings: AuditFinding[],
  archFindings: AuditFinding[],
  circularDepsCount: number,
  godFilesCount: number
): RepoScores {
  const secPenalty = sumWeightedPenalties(secFindings, {
    critical: 24,
    high: 14,
    medium: 7,
    low: 3,
  });
  const perfPenalty = sumWeightedPenalties(perfFindings, {
    critical: 22,
    high: 13,
    medium: 7,
    low: 3,
  });
  const archPenalty = sumWeightedPenalties(archFindings, {
    critical: 20,
    high: 16,
    medium: 12,
    low: 5,
  });

  const security = Math.max(5, 100 - secPenalty);
  const performance = Math.max(5, 100 - perfPenalty);
  const architecture = Math.max(5, 100 - archPenalty);
  const overall = Math.round(security * 0.38 + performance * 0.32 + architecture * 0.3);

  return {
    overall,
    architecture,
    security,
    performance,
    totalFiles: nodes.length,
    totalLines: nodes.reduce((s, n) => s + n.linesOfCode, 0),
    totalTokens: nodes.reduce((s, n) => s + n.estimatedTokens, 0),
    circularDepsCount,
    godFilesCount,
  };
}
