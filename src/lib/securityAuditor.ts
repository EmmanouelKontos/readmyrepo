import { AuditFinding, RepoFileInput } from '../types/atlas';
import { isCommentLine } from './graphMetrics';

interface SecurityRule {
  ruleId: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  testLine: (line: string, filePath: string, fullContent: string) => boolean;
  explanation: string;
  remediation: string;
}

const SECURITY_RULES: SecurityRule[] = [
  {
    ruleId: 'SEC-001',
    title: 'Hardcoded API Key or Service-Role Secret in Source',
    severity: 'critical',
    testLine: (line) =>
      /(sk-[a-zA-Z0-9_-]{12,}|eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[a-zA-Z0-9_-]{10,}|AIzaSy[a-zA-Z0-9_-]{20,}|SERVICE_ROLE_KEY\s*=\s*['"][^'"]+['"])/.test(
        line
      ),
    explanation:
      'Hardcoded credentials or JWT service-role keys committed in source code can be extracted from client bundles or git history, granting full database or billing access.',
    remediation:
      'Move secrets to server-only environment variables (.env.local), rotate the leaked key immediately, and read via process.env on the server only.',
  },
  {
    ruleId: 'SEC-002',
    title: 'Privileged Secret Exposed via Client Prefix (NEXT_PUBLIC_ / VITE_)',
    severity: 'critical',
    testLine: (line) =>
      /(NEXT_PUBLIC_|VITE_)[A-Z0-9_]*(SECRET|PRIVATE|SERVICE_ROLE|ADMIN_KEY|DATABASE_URL)/.test(
        line
      ),
    explanation:
      'Variables prefixed with NEXT_PUBLIC_ or VITE_ are statically inlined into the public browser JavaScript bundle, exposing backend secrets to every visitor.',
    remediation:
      'Remove the NEXT_PUBLIC_ or VITE_ prefix and move all privileged calls behind a server route handler or Edge Function.',
  },
  {
    ruleId: 'SEC-003',
    title: 'Unsanitized HTML Injection / DOM XSS Vector',
    severity: 'high',
    testLine: (line, _path, full) =>
      (/dangerouslySetInnerHTML\s*=\s*\{/.test(line) || /\.innerHTML\s*=\s*[^=]/.test(line)) &&
      !full.includes('DOMPurify.sanitize'),
    explanation:
      'Rendering raw HTML strings without a strict sanitizer allows attacker-controlled scripts to execute in the user session (Cross-Site Scripting).',
    remediation:
      'Sanitize HTML through DOMPurify.sanitize(html) before rendering or replace raw HTML injection with structured React nodes.',
  },
  {
    ruleId: 'SEC-004',
    title: 'Raw SQL String Interpolation (SQL Injection Risk)',
    severity: 'critical',
    testLine: (line) =>
      /(SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM)[^;]*\$\{[a-zA-Z0-9_.]+\}/i.test(
        line
      ) || /f["'](SELECT|INSERT|UPDATE|DELETE).*\{.+\}/i.test(line),
    explanation:
      'Interpolating user variables directly into SQL strings allows attackers to bypass authentication or exfiltrate tables via SQL injection.',
    remediation:
      'Use parameterized queries ($1, $2 or ? placeholders) or type-safe query builders (Supabase client / Drizzle / Prisma).',
  },
  {
    ruleId: 'SEC-005',
    title: 'Wildcard CORS Header on API Endpoint',
    severity: 'medium',
    testLine: (line, path) =>
      (path.includes('api/') || path.includes('route.') || path.includes('server')) &&
      /['"]Access-Control-Allow-Origin['"]\s*:\s*['"]\*['"]/.test(line),
    explanation:
      'Permitting wildcard (*) origins on API routes allows arbitrary third-party websites to read responses or trigger actions from browsers.',
    remediation:
      'Restrict Access-Control-Allow-Origin to explicit trusted origins and validate session authentication tokens.',
  },
  {
    ruleId: 'SEC-006',
    title: 'Unbounded C/C++ String Copy (Buffer Overflow Vector)',
    severity: 'critical',
    testLine: (line, path) =>
      /\.(c|h|cpp|hpp|cc)$/.test(path) &&
      /\b(strcpy|strcat|sprintf|vsprintf|gets)\s*\(/.test(line),
    explanation:
      'Unbounded C string functions write past destination buffer boundaries when input length exceeds allocation, causing kernel panics, heap corruption, or privilege escalation.',
    remediation:
      'Replace strcpy/strcat/sprintf with bounded kernel/libc equivalents such as strscpy(dst, src, sizeof(dst)) or snprintf(dst, sizeof(dst), fmt, ...).',
  },
  {
    ruleId: 'SEC-007',
    title: 'Overly Broad Chrome Extension MV3 Host Permission (<all_urls>)',
    severity: 'high',
    testLine: (line, path) =>
      path.endsWith('manifest.json') && /("<all_urls>"|"\*:\/\/\*\/\*")/.test(line),
    explanation:
      'Requesting <all_urls> or *://*/* in Manifest V3 grants content-script or host access to every website the user visits, triggering manual Chrome Web Store security review delays.',
    remediation:
      'Replace <all_urls> with the "activeTab" permission or scope "host_permissions" to explicit target domains.',
  },
  {
    ruleId: 'SEC-008',
    title: 'Disabled Desktop Webview CSP or Unsandboxed IPC (Tauri / Electron)',
    severity: 'high',
    testLine: (line, path) =>
      (path.endsWith('tauri.conf.json') && /"csp"\s*:\s*null/.test(line)) ||
      (/\.(ts|js)$/.test(path) && /(nodeIntegration\s*:\s*true|contextIsolation\s*:\s*false)/.test(line)),
    explanation:
      'Setting "csp": null in Tauri or enabling nodeIntegration in Electron allows any renderer XSS injection to invoke privileged native Rust/Node OS commands directly.',
    remediation:
      'Configure a strict Content-Security-Policy in tauri.conf.json ("default-src \'self\'") and enforce contextIsolation: true in Electron.',
  },
];

export function runSecurityAudit(files: RepoFileInput[]): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const seenRulePerFile = new Set<string>();
  let counter = 1;

  for (const file of files) {
    const lines = file.content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (isCommentLine(line, file.path)) continue;
      for (const rule of SECURITY_RULES) {
        const dedupKey = `${rule.ruleId}::${file.path}`;
        if (seenRulePerFile.has(dedupKey)) continue;
        if (rule.testLine(line, file.path, file.content)) {
          seenRulePerFile.add(dedupKey);
          const lineNumber = i + 1;
          const snippet = lines
            .slice(Math.max(0, i - 1), Math.min(lines.length, i + 2))
            .join('\n')
            .trim();

          findings.push({
            id: `sec-${counter++}`,
            ruleId: rule.ruleId,
            title: rule.title,
            category: 'security',
            severity: rule.severity,
            filePath: file.path,
            lineNumber,
            codeSnippet: snippet,
            explanation: rule.explanation,
            remediation: rule.remediation,
            aiFixPrompt: `Fix ${rule.ruleId} (${rule.title}) in \`${file.path}\` at line ${lineNumber}:\n- Issue: ${rule.explanation}\n- Required Fix: ${rule.remediation}\n- Offending code:\n\`\`\`\n${line.trim()}\n\`\`\``,
          });
        }
      }
    }
  }

  return findings;
}
