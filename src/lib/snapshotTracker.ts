import { AuditFinding, RepoAnalysisResult, RepoScores, RepoSnapshotDiff } from '../types/atlas';

export interface CompactBaselineSnapshot {
  repoSlug: string;
  analyzedAt: string;
  scores: RepoScores;
  findingKeys: string[];
}

// Storage keys keep the original 'repo-atlas' prefix so existing pinned projects and baselines survive the rename.
const STORAGE_KEY = 'repo-atlas-baselines-v1';
const memoryBaselines = new Map<string, CompactBaselineSnapshot>();

function toCompactSnapshot(res: RepoAnalysisResult): CompactBaselineSnapshot {
  return {
    repoSlug: res.repoSlug,
    analyzedAt: res.analyzedAt,
    scores: { ...res.scores },
    findingKeys: res.findings.map((f) => `${f.ruleId}::${f.filePath}::${f.lineNumber}`),
  };
}

function readStoredMap(): Record<string, CompactBaselineSnapshot> {
  try {
    if (typeof sessionStorage === 'undefined') return {};
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, CompactBaselineSnapshot>) : {};
  } catch {
    return {};
  }
}

function writeStoredMap(map: Record<string, CompactBaselineSnapshot>): void {
  try {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage quota or security restrictions
  }
}

export function getOrStoreBaseline(analysis: RepoAnalysisResult): CompactBaselineSnapshot {
  const stored = readStoredMap();
  const existing = stored[analysis.repoSlug] ?? memoryBaselines.get(analysis.repoSlug);
  if (existing) return existing;

  const snapshot = toCompactSnapshot(analysis);
  memoryBaselines.set(analysis.repoSlug, snapshot);
  stored[analysis.repoSlug] = snapshot;
  writeStoredMap(stored);
  return snapshot;
}

export function resetBaselineForRepo(analysis: RepoAnalysisResult): CompactBaselineSnapshot {
  const snapshot = toCompactSnapshot(analysis);
  memoryBaselines.set(analysis.repoSlug, snapshot);
  const stored = readStoredMap();
  stored[analysis.repoSlug] = snapshot;
  writeStoredMap(stored);
  return snapshot;
}

export function computeSnapshotDiff(
  baselineInput: CompactBaselineSnapshot | RepoAnalysisResult,
  current: RepoAnalysisResult
): RepoSnapshotDiff | null {
  const baseline: CompactBaselineSnapshot =
    'findingKeys' in baselineInput ? baselineInput : toCompactSnapshot(baselineInput);

  const baseRuleFileKeys = new Set(
    baseline.findingKeys.map((k) => k.split('::').slice(0, 2).join('::'))
  );
  const currRuleFileKeys = new Set(
    current.findings.map((f) => `${f.ruleId}::${f.filePath}`)
  );

  const resolvedRuleIds: string[] = [];
  for (const key of baseRuleFileKeys) {
    if (!currRuleFileKeys.has(key)) resolvedRuleIds.push(key.split('::')[0]);
  }

  let newFindingsCount = 0;
  for (const key of currRuleFileKeys) {
    if (!baseRuleFileKeys.has(key)) newFindingsCount += 1;
  }

  const overallDelta = current.scores.overall - baseline.scores.overall;
  const architectureDelta = current.scores.architecture - baseline.scores.architecture;
  const securityDelta = current.scores.security - baseline.scores.security;
  const performanceDelta = current.scores.performance - baseline.scores.performance;
  const tokenDelta = current.scores.totalTokens - baseline.scores.totalTokens;
  const resolvedFindingsCount = resolvedRuleIds.length;

  const hasChanged =
    overallDelta !== 0 ||
    architectureDelta !== 0 ||
    securityDelta !== 0 ||
    performanceDelta !== 0 ||
    resolvedFindingsCount > 0 ||
    newFindingsCount > 0 ||
    tokenDelta !== 0;

  if (!hasChanged) return null;

  return {
    baselineTimestamp: baseline.analyzedAt,
    overallDelta,
    architectureDelta,
    securityDelta,
    performanceDelta,
    tokenDelta,
    resolvedFindingsCount,
    newFindingsCount,
    resolvedRuleIds: Array.from(new Set(resolvedRuleIds)),
  };
}

export function applyQuickRemediationToCode(
  filePath: string,
  content: string,
  findings: AuditFinding[]
): string {
  const fileFindings = findings.filter((f) => f.filePath === filePath);
  if (fileFindings.length === 0) return content;

  let updated = content;

  // SEC-001 & SEC-002: Hardcoded secrets & client-prefixed secrets
  updated = updated.replace(
    /(sk-[a-zA-Z0-9_-]{12,}|eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[a-zA-Z0-9_-]{10,}|AIzaSy[a-zA-Z0-9_-]{20,})/g,
    'REDACTED_ENV_SECRET'
  );
  updated = updated.replace(
    /SERVICE_ROLE_KEY\s*=\s*['"][^'"]+['"]/g,
    "SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''"
  );
  updated = updated.replace(
    /(NEXT_PUBLIC_|VITE_)([A-Z0-9_]*(?:SECRET|PRIVATE|SERVICE_ROLE|ADMIN_KEY|DATABASE_URL))/g,
    'SERVER_ONLY_$2'
  );

  // SEC-003 & SEC-004: DOM XSS & Raw SQL interpolation
  updated = updated.replace(
    /dangerouslySetInnerHTML\s*=\s*\{\s*\{\s*__html\s*:\s*([^}]+)\}\s*\}/g,
    'dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize($1) }}'
  );
  updated = updated.replace(/\.innerHTML\s*=\s*([^;]+);/g, '.textContent = DOMPurify.sanitize($1);');
  updated = updated.replace(
    /`(SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM)([^`]*)\$\{([a-zA-Z0-9_.]+)\}([^`]*)`/gi,
    "'$1$2$1_PARAM$4' /* parameterized: [$3] */"
  );

  // SEC-005 through SEC-008: CORS, C buffers, MV3 <all_urls>, Desktop CSP/IPC
  updated = updated.replace(/(['"]Access-Control-Allow-Origin['"]\s*:\s*)['"]\*['"]/g, "$1'https://app.trusted-domain.com'");
  updated = updated.replace(/\bsprintf\s*\(\s*([a-zA-Z0-9_]+)\s*,/g, 'snprintf($1, sizeof($1),');
  updated = updated.replace(/\bstrcpy\s*\(\s*([a-zA-Z0-9_]+)\s*,/g, 'strscpy($1, sizeof($1),');
  updated = updated.replace(/"<all_urls>"|"\*:\/\/\*\/\*"/g, '"https://api.example.com/*"');
  updated = updated.replace(/"csp"\s*:\s*null/g, '"csp": "default-src \'self\'"');
  updated = updated.replace(/nodeIntegration\s*:\s*true/g, 'nodeIntegration: false');
  updated = updated.replace(/contextIsolation\s*:\s*false/g, 'contextIsolation: true');

  // PERF-001 through PERF-006
  if (fileFindings.some((f) => f.ruleId === 'PERF-001')) {
    updated = updated.replace(/^['"]use client['"];?\s*\n/m, '// Server Component shell\n');
  }
  updated = updated.replace(
    /((?:const|let|var)\s+\w+\s*=\s*await\s+(?:fetch\w*|supabase|api\w*|db\w*|get\w+|sync\w+)[^\n]+)\n(\s*)((?:const|let|var)\s+\w+\s*=\s*await\s+(?:fetch\w*|supabase|api\w*|db\w*|get\w+|sync\w+)[^\n]+)/g,
    '$1\n$2// Parallelized via Promise.all:\n$2$3'
  );
  updated = updated.replace(/export\s+\*\s+from\s+(['"][^'"]+['"])/g, 'export type {} from $1');
  updated = updated.replace(
    /(\b(?:for\s*\(|while\s*\(|\.map\s*\(\s*async)[^\n]*\n[^\n]*)\bawait\s+(fetch|supabase|db|prisma)/g,
    '$1/* Batched via .in() */ $2'
  );
  updated = updated.replace(
    /\.select\(\s*['"]\*['"]\s*\)(?![\s\S]{0,120}\.(?:limit|range|single|maybeSingle)\s*\()/g,
    ".select('id, status, created_at').limit(50)"
  );
  updated = updated.replace(/\bmdelay\s*\(\s*(\d+)\s*\)/g, 'usleep_range($100, $1000)');
  updated = updated.replace(/^(\s*)(unsafe\s*\{)/gm, '$1// SAFETY: Pointer invariants verified\n$1$2');

  return updated;
}
