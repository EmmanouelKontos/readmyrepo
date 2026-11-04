import { AuditFinding, AuditSeverity, RepoNode, RepoScores } from '../types/atlas';

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

export { detectGraphCyclesAndInversions } from './cycleDetector';

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
