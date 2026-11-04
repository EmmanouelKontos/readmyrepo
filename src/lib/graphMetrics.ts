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

const SEVERITY_ORDER: Record<AuditSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 };

/**
 * Per rule, the worst finding counts in full and repeats of the same rule count less
 * (1 → 0.65 → 0.35), capped per rule. Findings are ranked by severity first so the
 * result never depends on the order files were fetched in.
 */
function sumWeightedPenalties(findings: AuditFinding[], weights: Record<AuditSeverity, number>, maxPerRule = 32): number {
  const byRule = new Map<string, AuditFinding[]>();
  for (const f of findings) byRule.set(f.ruleId, [...(byRule.get(f.ruleId) ?? []), f]);
  let total = 0;
  for (const list of byRule.values()) {
    const ranked = [...list].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
    const sum = ranked.reduce((acc, f, i) => acc + Math.round(weights[f.severity] * (i === 0 ? 1 : i === 1 ? 0.65 : 0.35)), 0);
    total += Math.min(maxPerRule, sum);
  }
  return total;
}

/**
 * Oversized modules are a density problem: one large file in a 40-module sample matters far less
 * than one in a 3-module app. Penalty grows with the (severity-weighted) share of large files.
 */
const LARGE_FILE_MAX_PENALTY = 28;
function largeFilePenalty(findings: AuditFinding[], totalFiles: number): number {
  if (findings.length === 0) return 0;
  const weighted = findings.reduce((acc, f) => acc + (f.severity === 'high' || f.severity === 'critical' ? 2 : 1), 0);
  const share = weighted / Math.max(1, totalFiles);
  return Math.min(LARGE_FILE_MAX_PENALTY, Math.max(4, Math.round(36 * Math.sqrt(share))));
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
  const largeFiles = archFindings.filter((f) => f.ruleId === 'ARCH-001');
  const archPenalty =
    largeFilePenalty(largeFiles, nodes.length) +
    sumWeightedPenalties(
      archFindings.filter((f) => f.ruleId !== 'ARCH-001'),
      { critical: 20, high: 16, medium: 12, low: 5 }
    );

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
