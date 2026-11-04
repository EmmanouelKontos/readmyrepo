import {
  AuditFinding,
  AuditSeverity,
  DependencyEdge,
  RepoAnalysisResult,
  RepoFileInput,
  RepoNode,
} from '../types/atlas';
import { runSecurityAudit } from './securityAuditor';
import { runPerformanceAudit } from './performanceAuditor';
import { compileAgentsMdBlueprint } from './contextCompiler';
import { classifyLayer, extractImports, resolveImportToFile } from './importResolver';
import { computeAccurateScores, detectGraphCyclesAndInversions } from './graphMetrics';

export function analyzeRepository(
  repoName: string,
  description: string,
  sourceLabel: string,
  files: RepoFileInput[],
  meta?: { repoSlug?: string; stackTags?: string[] }
): RepoAnalysisResult {
  const allPaths = files.map((f) => f.path);
  const secFindings = runSecurityAudit(files);
  const perfFindings = runPerformanceAudit(files);
  const archFindings: AuditFinding[] = [];

  const nodesMap = new Map<string, RepoNode>();
  const rawEdges: DependencyEdge[] = [];

  for (const file of files) {
    const lines = file.content.split('\n');
    const loc = lines.length;
    const tokens = Math.max(1, Math.round(file.content.length / 4));
    const parts = file.path.split('/');
    const base = parts[parts.length - 1] ?? file.path;
    const hasDuplicateBase = allPaths.some((p) => p !== file.path && p.endsWith(`/${base}`));
    const name = hasDuplicateBase && parts.length >= 2 ? `${parts[parts.length - 2]}/${base}` : base;
    const exportsCount = (
      file.content.match(
        /\b(export\s+(const|function|class|interface|type|default)|pub\s+(fn|struct|enum|trait|mod)|(?:void|int|u64|bool)\s+\w+\s*\()/g
      ) ?? []
    ).length;
    const isGodFile = loc > 220;

    if (isGodFile) {
      archFindings.push({
        id: `arch-god-${file.path}`,
        ruleId: 'ARCH-001',
        title: `Oversized "God Module" (${loc} LOC > 220 LOC Cap)`,
        category: 'architecture',
        severity: loc > 320 ? 'high' : 'medium',
        filePath: file.path,
        lineNumber: 1,
        codeSnippet: lines.slice(0, 5).join('\n').trim(),
        explanation: `\`${file.path}\` mixes too many responsibilities (${loc} lines), inflating AI context usage and increasing merge conflicts.`,
        remediation:
          'Split stateless UI primitives into `components/ui/`, state logic into `hooks/`, and data calls into `services/`.',
        aiFixPrompt: `Refactor oversized module \`${file.path}\` (${loc} lines, ARCH-001) into focused sub-modules under 200 lines each.`,
      });
    }

    nodesMap.set(file.path, {
      id: file.path,
      path: file.path,
      name,
      layer: classifyLayer(file.path),
      linesOfCode: loc,
      estimatedTokens: tokens,
      imports: [],
      importedBy: [],
      exportsCount,
      isGodFile,
      inCycle: false,
      isOrphan: false,
      issueCount: 0,
      maxSeverity: 'clean',
      content: file.content,
    });
  }

  for (const file of files) {
    const specs = extractImports(file.content, file.path);
    const sourceNode = nodesMap.get(file.path)!;
    for (const spec of specs) {
      const resolved = resolveImportToFile(file.path, spec, allPaths, files);
      if (resolved && resolved !== file.path && !sourceNode.imports.includes(resolved)) {
        sourceNode.imports.push(resolved);
        nodesMap.get(resolved)?.importedBy.push(file.path);
        rawEdges.push({ from: file.path, to: resolved, isCircular: false });
      }
    }
  }

  const circularCount = detectGraphCyclesAndInversions(nodesMap, rawEdges, archFindings);
  const allFindings = [...secFindings, ...perfFindings, ...archFindings];
  const severityRank: Record<AuditSeverity | 'clean', number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
    clean: 0,
  };

  for (const node of nodesMap.values()) {
    node.isOrphan =
      node.importedBy.length === 0 &&
      node.imports.length === 0 &&
      node.layer !== 'entry' &&
      node.layer !== 'config';
    const fileFindings = allFindings.filter((f) => f.filePath === node.path);
    node.issueCount = fileFindings.length;
    for (const f of fileFindings) {
      if (severityRank[f.severity] > severityRank[node.maxSeverity]) {
        node.maxSeverity = f.severity;
      }
    }
  }

  const nodes = Array.from(nodesMap.values());
  const godFilesCount = nodes.filter((n) => n.isGodFile).length;
  const scores = computeAccurateScores(
    nodes,
    secFindings,
    perfFindings,
    archFindings,
    circularCount,
    godFilesCount
  );

  const { agentsMdBlueprint, masterFixPrompt } = compileAgentsMdBlueprint(
    repoName,
    description,
    nodes,
    rawEdges,
    allFindings,
    scores
  );

  const inferredTags =
    meta?.stackTags ??
    Array.from(
      new Set(
        [
          files.some((f) => f.path.endsWith('.tsx') || f.path.endsWith('.ts')) ? 'TypeScript' : null,
          files.some((f) => f.path.endsWith('.rs')) ? 'Rust' : null,
          files.some((f) => f.path.endsWith('.c') || f.path.endsWith('.h')) ? 'C11 / Systems' : null,
          files.some((f) => f.path.endsWith('manifest.json')) ? 'Manifest V3' : null,
          files.some((f) => f.path.endsWith('tauri.conf.json')) ? 'Tauri Desktop' : null,
          files.some((f) => f.path.includes('supabase')) ? 'Supabase' : null,
          files.some((f) => f.path.includes('app/')) ? 'App Router' : 'Modular AST',
        ].filter((t): t is string => Boolean(t))
      )
    );

  return {
    repoName,
    repoSlug: meta?.repoSlug ?? repoName.toLowerCase().replace(/\s+/g, '-'),
    stackTags: inferredTags,
    description,
    sourceLabel,
    analyzedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    nodes,
    edges: rawEdges,
    findings: allFindings,
    scores,
    agentsMdBlueprint,
    masterFixPrompt,
  };
}
