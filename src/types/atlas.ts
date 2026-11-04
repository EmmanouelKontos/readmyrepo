export type ArchitecturalLayer =
  | 'entry'
  | 'ui'
  | 'feature'
  | 'service'
  | 'data'
  | 'config';

export type AuditCategory = 'security' | 'performance' | 'architecture';

export type AuditSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface RepoFileInput {
  path: string;
  content: string;
}

export interface RepoNode {
  id: string;
  path: string;
  name: string;
  layer: ArchitecturalLayer;
  linesOfCode: number;
  /** Non-blank, non-comment lines (what the large-file rule measures). */
  codeLines?: number;
  /** Large-file threshold for this file's language, in code lines. */
  sizeLimit?: number;
  estimatedTokens: number;
  imports: string[];
  importedBy: string[];
  exportsCount: number;
  isGodFile: boolean;
  inCycle: boolean;
  isOrphan: boolean;
  issueCount: number;
  maxSeverity: AuditSeverity | 'clean';
  content: string;
}

export interface DependencyEdge {
  from: string;
  to: string;
  isCircular: boolean;
  /** TypeScript `import type` / `export type` — erased at runtime, so it can never cause an init-order cycle. */
  typeOnly?: boolean;
  /** 1-based line of the import statement in `from`. */
  line?: number;
}

export interface AuditFinding {
  id: string;
  ruleId: string;
  title: string;
  category: AuditCategory;
  severity: AuditSeverity;
  filePath: string;
  lineNumber: number;
  codeSnippet: string;
  explanation: string;
  remediation: string;
  aiFixPrompt: string;
}

export interface RepoScores {
  overall: number;
  architecture: number;
  security: number;
  performance: number;
  totalFiles: number;
  totalLines: number;
  totalTokens: number;
  circularDepsCount: number;
  godFilesCount: number;
}

export interface RepoAnalysisResult {
  repoName: string;
  repoSlug: string;
  stackTags: string[];
  description: string;
  sourceLabel: string;
  analyzedAt: string;
  nodes: RepoNode[];
  edges: DependencyEdge[];
  findings: AuditFinding[];
  scores: RepoScores;
  agentsMdBlueprint: string;
  masterFixPrompt: string;
}

export interface RepoSnapshotDiff {
  baselineTimestamp: string;
  overallDelta: number;
  architectureDelta: number;
  securityDelta: number;
  performanceDelta: number;
  tokenDelta: number;
  resolvedFindingsCount: number;
  newFindingsCount: number;
  resolvedRuleIds: string[];
}

export interface PinnedProjectRecord {
  slug: string;
  repoName: string;
  description: string;
  sourceLabel: string;
  stackTags: string[];
  presetId?: string;
  scores: RepoScores;
  baselineScores: RepoScores;
  findingsCount: number;
  pinnedAt: string;
  lastScannedAt: string;
  files: RepoFileInput[];
}

export interface PresetRepository {
  id: string;
  name: string;
  slug: string;
  stackTags: string[];
  badge: string;
  badgeTone: 'danger' | 'success' | 'warning';
  description: string;
  files: RepoFileInput[];
}
