import { AuditFinding, RepoFileInput } from '../types/atlas';
import { isCommentLine } from './graphMetrics';

/** Base64url → JSON payload of a JWT, or null. */
function jwtPayload(segment: string): Record<string, unknown> | null {
  try {
    const b64 = segment.replace(/-/g, '+').replace(/_/g, '/');
    const parsed: unknown = JSON.parse(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4)));
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * A hardcoded JWT is only a leak when it grants privileges: Supabase `anon` keys are public by design,
 * `service_role` (or any non-anon role) bypasses Row-Level Security.
 */
function hasPrivilegedJwt(line: string): boolean {
  for (const m of line.matchAll(/\beyJ[A-Za-z0-9_-]{10,}\.(eyJ[A-Za-z0-9_-]{10,})(?:\.[A-Za-z0-9_-]*)?/g)) {
    const role = jwtPayload(m[1])?.role;
    if (typeof role === 'string' && role !== 'anon' && role !== 'authenticated') return true;
  }
  return false;
}

/** Tags that turn `${}` into bound parameters (Prisma, postgres.js, Drizzle, Slonik, @vercel/postgres…). */
const PARAMETERIZING_TAG = /(?:\$queryRaw|\$executeRaw|\bPrisma\.sql|\bsql(?:\.query)?|\bdb\.sql|\bpsql)\s*(?:<[^>]*>)?\s*$/;
/** Interpolations that build query *structure* (placeholder lists, column lists) rather than values. */
const STRUCTURAL_PART = /(placeholders?|columns?|fields?|clause|conditions?|where|order(by)?|direction|sort|limit|offset|table(name)?|schema|alias|select(ion)?)$/i;

function isSafeSqlTemplate(line: string, before: string): boolean {
  const firstInterp = line.indexOf('${');
  const text = `${before}\n${line.slice(0, Math.max(0, firstInterp))}`;
  const tick = text.lastIndexOf('`');
  if (tick >= 0 && PARAMETERIZING_TAG.test(text.slice(0, tick)) && !/Unsafe\s*\(?\s*$/.test(text.slice(0, tick))) return true;
  // `IN (${placeholders}) AND projectId = ?` — only structure is interpolated, values are bound separately
  const parts = [...line.matchAll(/\$\{([a-zA-Z0-9_.]+)\}/g)].map((m) => m[1].split('.').pop() ?? '');
  return /\?|\$\d/.test(line) && parts.length > 0 && parts.every((p) => STRUCTURAL_PART.test(p));
}

interface SecurityRule {
  ruleId: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  /** `before()` returns the preceding lines (up to 6), for rules that need statement context. */
  testLine: (line: string, filePath: string, fullContent: string, before: () => string) => boolean;
  explanation: string;
  remediation: string;
}

const SECURITY_RULES: SecurityRule[] = [
  {
    ruleId: 'SEC-001',
    title: 'Secret key written directly in the code',
    severity: 'critical',
    testLine: (line) =>
      // OpenAI/Stripe-style keys (word-bounded, so `risk-assessment-…` never matches), Google API keys,
      // privileged JWTs, or a literal assigned to a *_SERVICE_ROLE_KEY variable.
      /(?<![\w-])(?:sk|rk)-(?:proj-|live-|test-)?(?=[A-Za-z0-9_-]*\d)[A-Za-z0-9_-]{20,}/.test(line) ||
      /\bAIzaSy[A-Za-z0-9_-]{30,}/.test(line) ||
      /\b(?:sk|rk)_live_[A-Za-z0-9]{20,}|\bgh[pousr]_[A-Za-z0-9]{36}\b|\bgithub_pat_[A-Za-z0-9_]{60,}|\bAKIA[0-9A-Z]{16}\b|-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/.test(line) ||
      hasPrivilegedJwt(line) ||
      /SERVICE_ROLE_KEY\s*[:=]\s*['"][^'"]{8,}['"]/.test(line),
    explanation:
      'A private key or password is stored in the source code. Anyone who can see the code, the git history or the shipped JavaScript can copy it and use your account, database or billing.',
    remediation:
      'Move the secret into a server-only environment variable (for example `.env.local`), read it with `process.env` on the server, and rotate the leaked key now: it should be considered public.',
  },
  {
    ruleId: 'SEC-002',
    title: 'Private key exposed to the browser (NEXT_PUBLIC_ / VITE_ prefix)',
    severity: 'critical',
    testLine: (line) =>
      /(NEXT_PUBLIC_|VITE_)[A-Z0-9_]*(SECRET|PRIVATE|SERVICE_ROLE|ADMIN_KEY|DATABASE_URL)/.test(
        line
      ),
    explanation:
      'Variables starting with NEXT_PUBLIC_ or VITE_ are copied into the JavaScript every visitor downloads. A secret, admin key or database URL with that prefix is readable by anyone.',
    remediation:
      'Remove the public prefix and only use the value on the server, behind an API route or Edge Function. Rotate the key if it was ever deployed.',
  },
  {
    ruleId: 'SEC-003',
    title: 'Raw HTML inserted into the page (XSS risk)',
    severity: 'high',
    testLine: (line, _path, full, before) =>
      (/dangerouslySetInnerHTML\s*=\s*\{/.test(line) ||
        // assigning a static literal (`el.innerHTML = ''`) cannot inject anything
        (/\.innerHTML\s*=\s*[^=]/.test(line) && !/\.innerHTML\s*=\s*(?:(['"])[^'"]*\1|`[^`$]*`|(?:window\.)?trustedTypes\.emptyHTML)\s*;?\s*$/.test(line))) &&
      // JSON.stringify payloads are the standard JSON-LD pattern; a lint suppression right above
      // (`eslint-disable-next-line react/no-danger`, oxlint, biome-ignore) marks a sink the authors reviewed.
      !/__html\s*:\s*JSON\.stringify\(/.test(line) &&
      !/(?:eslint|oxlint)-disable-next-line[^\n]*(?:no-danger|no-inner-html|innerhtml)|biome-ignore[^\n]*noDangerouslySetInnerHtml/i.test(before().split('\n').slice(-2).join('\n')) &&
      !/DOMPurify\.sanitize|sanitizeHtml\(|sanitize-html|from ['"]xss['"]/.test(full),
    explanation:
      'HTML is put into the page without being cleaned first. If any of it can come from a user, an attacker can run their own script in your visitors\' browsers (cross-site scripting).',
    remediation:
      'Clean the HTML with `DOMPurify.sanitize(html)` first, or render the content as normal React elements instead of raw HTML.',
  },
  {
    ruleId: 'SEC-004',
    title: 'Database query built from raw values (SQL injection risk)',
    severity: 'critical',
    testLine: (line, _path, _full, before) =>
      // Require real SQL statement shape (SELECT…FROM, INSERT INTO, UPDATE…SET, DELETE FROM) so
      // strings like `select-none ${className}` or "update ${count} items" are not flagged.
      (/\b(SELECT\b[^;]*?\bFROM|INSERT\s+INTO|UPDATE\s+[\w."`]+\s+SET|DELETE\s+FROM)\b[^;]*\$\{[a-zA-Z0-9_.]+\}/i.test(line) &&
        !isSafeSqlTemplate(line, before())) ||
      /\bf["'](SELECT\b.*?\bFROM|INSERT\s+INTO|UPDATE\s+\S+\s+SET|DELETE\s+FROM)\b.*\{.+\}/i.test(line),
    explanation:
      'Values are pasted straight into a SQL string. A crafted value can change the query itself, letting an attacker read or delete data they should never reach.',
    remediation:
      'Pass values as parameters (`$1`, `?`, or a tagged template such as Prisma\'s `$queryRaw`) or use the Supabase / Drizzle / Prisma query builder.',
  },
  {
    ruleId: 'SEC-005',
    title: 'API open to every website (wildcard CORS)',
    severity: 'medium',
    testLine: (line, path) =>
      (path.includes('api/') || path.includes('route.') || path.includes('server')) &&
      /['"]Access-Control-Allow-Origin['"]\s*:\s*['"]\*['"]/.test(line),
    explanation:
      '`Access-Control-Allow-Origin: *` lets any website call this API from a visitor\'s browser and read the response.',
    remediation:
      'List the exact sites that may call the API instead of `*`, and keep checking the user\'s session on every request.',
  },
  {
    ruleId: 'SEC-006',
    title: 'Unlimited string copy in C (buffer overflow risk)',
    severity: 'critical',
    testLine: (line, path) =>
      /\.(c|h|cpp|hpp|cc)$/.test(path) &&
      /\b(strcpy|strcat|sprintf|vsprintf|gets)\s*\(/.test(line) &&
      // copying a short string literal (`strcpy(buf, "...")`) has a compile-time bound
      !/\b(strcpy|strcat)\s*\([^,]+,\s*"[^"]{0,16}"\s*\)/.test(line) &&
      // prototypes / macros that *declare* or ban the function (`int sprintf(char *str, …) __attribute__((deprecated))`)
      !/^\s*(?:#\s*(?:define|undef)\b|(?:extern\s+)?(?:int|char|void|size_t|ssize_t)\s*\*?\s*(?:strcpy|strcat|sprintf|vsprintf|gets)\s*\()/.test(line),
    explanation:
      'This C function copies text without checking how much room the destination has. Longer input than expected overwrites nearby memory, which can crash the program or let an attacker take control.',
    remediation:
      'Use a size-limited version such as `strscpy(dst, src, sizeof(dst))` or `snprintf(dst, sizeof(dst), fmt, ...)`.',
  },
  {
    ruleId: 'SEC-007',
    title: 'Extension asks to access every website',
    severity: 'high',
    testLine: (line, path) =>
      path.endsWith('manifest.json') && /("<all_urls>"|"\*:\/\/\*\/\*")/.test(line),
    explanation:
      'Requesting `<all_urls>` or `*://*/*` lets the extension read and change every page the user visits. Users and the Chrome Web Store review treat this as a major risk.',
    remediation:
      'Use the `activeTab` permission, or list only the sites the extension really needs under `host_permissions`.',
  },
  {
    ruleId: 'SEC-008',
    title: 'Desktop app safety setting turned off (CSP / Node access)',
    severity: 'high',
    testLine: (line, path) =>
      (path.endsWith('tauri.conf.json') && /"csp"\s*:\s*null/.test(line)) ||
      (/\.(ts|js)$/.test(path) && /(nodeIntegration\s*:\s*true|contextIsolation\s*:\s*false)/.test(line)),
    explanation:
      'With `"csp": null` in Tauri, or `nodeIntegration` / no context isolation in Electron, a single injected script in the app window can run commands on the user\'s computer.',
    remediation:
      'Set a strict Content-Security-Policy in tauri.conf.json (for example `default-src \'self\'`) and keep `contextIsolation: true` in Electron.',
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
      let before: string | null = null; // preceding lines, built once per line and only when a rule needs them
      const context = () => (before ??= lines.slice(Math.max(0, i - 6), i).join('\n'));
      for (const rule of SECURITY_RULES) {
        const dedupKey = `${rule.ruleId}::${file.path}`;
        if (seenRulePerFile.has(dedupKey)) continue;
        if (rule.testLine(line, file.path, file.content, context)) {
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
