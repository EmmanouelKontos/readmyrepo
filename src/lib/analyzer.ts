import { AuditFinding, AuditSeverity, DependencyEdge, RepoAnalysisResult, RepoFileInput, RepoNode } from '../types/atlas';
import { runSecurityAudit } from './securityAuditor';
import { runPerformanceAudit } from './performanceAuditor';
import { compileAgentsMdBlueprint } from './contextCompiler';
import { classifyLayerHint } from './layerClassifier';
import { extractImportsDetailed } from './importExtractor';
import { resolveImportToFile } from './importResolver';
import { computeAccurateScores } from './graphMetrics';
import { detectGraphCyclesAndInversions } from './cycleDetector';
import { countCodeLines, largeFileLabel, largeFileLimit } from './fileSize';
import { inferStackTags } from './stackTags';
import { goIntraPackageEdges } from './goPackageEdges';
import { createTypeElisionChecker } from './typeElision';

const MAIN_SIGNAL: Array<[RegExp, RegExp]> = [
  [/\.py$/, /^if\s+__name__\s*==\s*['"]__main__['"]/m],
  [/\.go$/, /^package\s+main\b/m],
  [/\.rs$/, /^\s*(?:pub\s+)?(?:async\s+)?fn\s+main\s*\(/m],
  [/\.(c|cc|cpp|m|mm)$/, /^\s*(?:int|void)\s+main\s*\(/m],
  [/\.(swift|kt|dart)$/, /@main\b|\bfun\s+main\s*\(|\bvoid\s+main\s*\(/],
];

/** Runnable-entry heuristic for files without a path-based layer signal. */
function looksLikeEntryPoint(path: string, content: string): boolean {
  const rule = MAIN_SIGNAL.find(([ext]) => ext.test(path));
  if (rule) return rule[1].test(content);
  // JS/TS and others: a top-level module nobody imports is an entry (bin script, root module).
  return path.split('/').length <= 2 || /^#!/.test(content);
}

const SEVERITY_RANK: Record<AuditSeverity | 'clean', number> = { critical: 4, high: 3, medium: 2, low: 1, clean: 0 };

function largeFileFinding(path: string, lines: string[], codeLines: number, limit: number): AuditFinding {
  return {
    id: `arch-god-${path}`,
    ruleId: 'ARCH-001',
    title: `Oversized file: ${codeLines} lines of code (limit ${limit})`,
    category: 'architecture',
    severity: codeLines > limit * 2 ? 'high' : 'medium',
    filePath: path,
    lineNumber: 1,
    codeSnippet: lines.slice(0, 5).join('\n').trim(),
    explanation: `\`${path}\` has ${codeLines} lines of code, more than the ${limit} we suggest for ${largeFileLabel(path)}. Very large files usually do several jobs at once, are hard to review, cause merge conflicts, and cost AI assistants more context to read.`,
    remediation: 'Split it by job: display pieces, state and hooks, and data access or helpers each in their own file.',
    aiFixPrompt: `Refactor oversized module \`${path}\` (${codeLines} code lines, ARCH-001) into focused sub-modules, each well under ${limit} code lines.`,
  };
}

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
  const pathClassified = new Set<string>();
  const edges: DependencyEdge[] = [];

  for (const file of files) {
    const lines = file.content.split('\n');
    const parts = file.path.split('/');
    const base = parts[parts.length - 1] ?? file.path;
    const hasDuplicateBase = allPaths.some((p) => p !== file.path && p.endsWith(`/${base}`));
    const codeLines = countCodeLines(file.content, file.path);
    const sizeLimit = largeFileLimit(file.path);
    const isGodFile = codeLines > sizeLimit;
    const hint = classifyLayerHint(file.path);
    if (hint) pathClassified.add(file.path);
    if (isGodFile) archFindings.push(largeFileFinding(file.path, lines, codeLines, sizeLimit));

    nodesMap.set(file.path, {
      id: file.path,
      path: file.path,
      name: hasDuplicateBase && parts.length >= 2 ? `${parts[parts.length - 2]}/${base}` : base,
      layer: hint ?? 'service',
      linesOfCode: lines.length,
      codeLines,
      sizeLimit,
      estimatedTokens: Math.max(1, Math.round(file.content.length / 4)),
      imports: [],
      importedBy: [],
      exportsCount: (file.content.match(/\b(export\s+(const|function|class|interface|type|default|enum|async)|pub\s+(fn|struct|enum|trait|mod)|^def\s+\w+|^class\s+\w+|^func\s+[A-Z]\w*)/gm) ?? []).length,
      isGodFile,
      inCycle: false,
      isOrphan: false,
      issueCount: 0,
      maxSeverity: 'clean',
      content: file.content,
    });
  }

  const importsOnlyTypes = createTypeElisionChecker(files);
  for (const file of files) {
    const source = nodesMap.get(file.path)!;
    for (const { spec, typeOnly: declaredTypeOnly, line, names } of extractImportsDetailed(file.content, file.path)) {
      const resolved = resolveImportToFile(file.path, spec, allPaths, files);
      if (!resolved || resolved === file.path) continue;
      const typeOnly = declaredTypeOnly || importsOnlyTypes(file.path, names, resolved);
      const existing = edges.find((e) => e.from === file.path && e.to === resolved);
      if (existing) {
        // A value import anywhere makes the whole edge a runtime edge (and points findings at that line).
        if (!typeOnly && existing.typeOnly) {
          existing.typeOnly = false;
          existing.line = line;
        }
        continue;
      }
      source.imports.push(resolved);
      nodesMap.get(resolved)?.importedBy.push(file.path);
      edges.push({ from: file.path, to: resolved, isCircular: false, typeOnly, line });
    }
  }

  for (const { from, to, line } of goIntraPackageEdges(files)) {
    if (edges.some((e) => e.from === from && e.to === to)) continue;
    nodesMap.get(from)!.imports.push(to);
    nodesMap.get(to)!.importedBy.push(from);
    edges.push({ from, to, isCircular: false, typeOnly: false, line });
  }

  // Files without a path signal: unreferenced modules that look runnable are entry points,
  // everything else is internal logic (a partial sample often misses a module's importers).
  for (const node of nodesMap.values()) {
    if (!pathClassified.has(node.id)) node.layer = node.importedBy.length === 0 && looksLikeEntryPoint(node.path, node.content) ? 'entry' : 'service';
  }

  const circularCount = detectGraphCyclesAndInversions(nodesMap, edges, archFindings, pathClassified);
  const allFindings = [...secFindings, ...perfFindings, ...archFindings];

  for (const node of nodesMap.values()) {
    node.isOrphan = node.importedBy.length === 0 && node.imports.length === 0 && node.layer !== 'entry' && node.layer !== 'config';
    const fileFindings = allFindings.filter((f) => f.filePath === node.path);
    node.issueCount = fileFindings.length;
    for (const f of fileFindings) {
      if (SEVERITY_RANK[f.severity] > SEVERITY_RANK[node.maxSeverity]) node.maxSeverity = f.severity;
    }
  }

  const nodes = Array.from(nodesMap.values());
  const godFilesCount = nodes.filter((n) => n.isGodFile).length;
  const scores = computeAccurateScores(nodes, secFindings, perfFindings, archFindings, circularCount, godFilesCount);
  const { agentsMdBlueprint, masterFixPrompt } = compileAgentsMdBlueprint(repoName, description, nodes, edges, allFindings, scores);

  return {
    repoName,
    repoSlug: meta?.repoSlug ?? repoName.toLowerCase().replace(/\s+/g, '-'),
    stackTags: meta?.stackTags ?? inferStackTags(files),
    description,
    sourceLabel,
    analyzedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    nodes,
    edges,
    findings: allFindings,
    scores,
    agentsMdBlueprint,
    masterFixPrompt,
  };
}
