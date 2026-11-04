import { AuditFinding, RepoFileInput } from '../types/atlas';
import { isCommentLine } from './graphMetrics';

export function runPerformanceAudit(files: RepoFileInput[]): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const seenRulePerFile = new Set<string>();
  let counter = 1;

  function canEmit(ruleId: string, filePath: string): boolean {
    const key = `${ruleId}::${filePath}`;
    if (seenRulePerFile.has(key)) return false;
    seenRulePerFile.add(key);
    return true;
  }

  for (const file of files) {
    const lines = file.content.split('\n');

    // PERF-001: Root layout/page "use client" bailout
    if (
      (file.path.endsWith('layout.tsx') ||
        file.path.endsWith('page.tsx') ||
        file.path.endsWith('App.tsx')) &&
      lines.slice(0, 5).some((l) => /['"]use client['"]/.test(l)) &&
      lines.length > 90
    ) {
      findings.push({
        id: `perf-${counter++}`,
        ruleId: 'PERF-001',
        title: 'Root Route Opted Into Client Bundle ("use client" at Top Level)',
        category: 'performance',
        severity: 'high',
        filePath: file.path,
        lineNumber: 1,
        codeSnippet: lines.slice(0, 4).join('\n').trim(),
        explanation:
          'Placing "use client" at the top of a large route or layout forces the entire subtree and its dependencies into the client JS bundle, hurting LCP and INP.',
        remediation:
          'Keep the route/layout as a Server Component and extract only the interactive leaf widgets (modals, toggles, forms) into small client components.',
        aiFixPrompt: `Refactor \`${file.path}\` (PERF-001): Remove top-level \`"use client"\` from the route shell and extract interactive state into focused leaf components under \`src/features/\`.`,
      });
    }

    // PERF-003: Barrel file re-exporting everything
    if (file.path.endsWith('index.ts') || file.path.endsWith('index.tsx')) {
      const wildcardExports = lines.filter((l) => /export\s+\*\s+from/.test(l));
      if (wildcardExports.length >= 3) {
        findings.push({
          id: `perf-${counter++}`,
          ruleId: 'PERF-003',
          title: `Barrel File Re-Exports ${wildcardExports.length} Modules (Tree-Shaking Killer)`,
          category: 'performance',
          severity: 'medium',
          filePath: file.path,
          lineNumber: 1,
          codeSnippet: lines.slice(0, 6).join('\n').trim(),
          explanation:
            'Barrel files that wildcard re-export many modules force bundlers and test runners to parse the entire module graph even when a consumer imports a single utility.',
          remediation:
            'Import directly from concrete feature/component file paths instead of wildcard barrel index files.',
          aiFixPrompt: `Eliminate the wildcard barrel file \`${file.path}\` (PERF-003) and update consumers to import directly from the specific module paths.`,
        });
      }
    }

    // Line-by-line checks for waterfalls, N+1 queries, and unbounded selects
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (isCommentLine(line, file.path)) continue;
      const nextLine = lines[i + 1] ?? '';
      const nextNextLine = lines[i + 2] ?? '';

      // PERF-002: Sequential await waterfall (only when second await does not depend on first LHS variable)
      const lhsMatch = line.match(/(?:const|let|var)\s+(\w+)\s*=\s*await\b/);
      const lhsVar = lhsMatch?.[1];
      const nextDependsOnFirst = lhsVar ? new RegExp(`\\b${lhsVar}\\b`).test(nextLine) : false;

      if (
        !isCommentLine(nextLine, file.path) &&
        !nextDependsOnFirst &&
        /\bawait\s+(fetch\w*|supabase|api\w*|db\w*|get\w+|sync\w+)\b/.test(line) &&
        /\bawait\s+(fetch\w*|supabase|api\w*|db\w*|get\w+|sync\w+)\b/.test(nextLine) &&
        canEmit('PERF-002', file.path)
      ) {
        findings.push({
          id: `perf-${counter++}`,
          ruleId: 'PERF-002',
          title: 'Sequential Network Waterfall (Consecutive Independent Awaits)',
          category: 'performance',
          severity: 'high',
          filePath: file.path,
          lineNumber: i + 1,
          codeSnippet: `${line.trim()}\n${nextLine.trim()}`,
          explanation:
            'Awaiting independent network or database requests sequentially doubles round-trip latency and blocks UI rendering.',
          remediation:
            'Execute independent requests concurrently using `const [a, b] = await Promise.all([reqA(), reqB()])`.',
          aiFixPrompt: `Fix the sequential network waterfall in \`${file.path}\` at lines ${i + 1}-${i + 2} (PERF-002) by parallelizing the independent async calls with \`Promise.all\`.`,
        });
      }

      // PERF-004: N+1 query inside a loop over a collection.
      // Counter/retry loops (`for (let i = 0; i < MAX_REDIRECTS; i++)`) and parallel HTTP fan-out
      // (`Promise.all(urls.map(async …fetch))`) are not N+1 patterns and are deliberately ignored.
      const loopWindow = `${line}\n${nextLine}\n${nextNextLine}`;
      const iteratesCollection =
        /\bfor\s*(?:await\s*)?\(\s*(?:const|let|var)\s+[^;]+?\s+of\s+/.test(line) || /^\s*(?:async\s+)?for\s+\w+(?:\s*,\s*\w+)*\s+in\s+.+:\s*$/.test(line);
      const mapsAsync = /\.(map|forEach)\s*\(\s*async\b/.test(line);
      const dbCall = /\bawait\s+(?:supabase|db|prisma|knex|sql|pool|tx|trx|\w+\.(?:query|execute|findOne|findUnique|findFirst|findMany|from|select|insert|update|get_or_create)\s*\()/.test(loopWindow) ||
        /\b(?:session\.query|cursor\.execute|\.objects\.(?:get|filter))\(/.test(`${nextLine}\n${nextNextLine}`);
      const httpCall = /\bawait\s+(?:fetch|axios|ky|got)\b/.test(loopWindow);
      if (((iteratesCollection && (dbCall || httpCall)) || (mapsAsync && dbCall)) && canEmit('PERF-004', file.path)) {
        findings.push({
          id: `perf-${counter++}`,
          ruleId: 'PERF-004',
          title: 'N+1 Database / API Query Inside Loop',
          category: 'performance',
          severity: 'critical',
          filePath: file.path,
          lineNumber: i + 1,
          codeSnippet: lines.slice(i, i + 3).join('\n').trim(),
          explanation:
            'Executing an async database or HTTP request on every iteration of a loop causes N+1 query explosions as list sizes grow.',
          remediation:
            'Batch the IDs before the loop and fetch all matching records in a single `.in("id", ids)` query.',
          aiFixPrompt: `Fix the N+1 query loop in \`${file.path}\` at line ${i + 1} (PERF-004) by collecting IDs and performing a single batched query outside the loop.`,
        });
      }

      // PERF-005: Unbounded select('*') without limit on the query chain
      const queryWindow = lines.slice(i, i + 4).join(' ');
      if (
        /\.select\(\s*['"]\*['"]\s*\)/.test(line) &&
        !queryWindow.includes('.limit(') &&
        !queryWindow.includes('.range(') &&
        !queryWindow.includes('.single(') &&
        !queryWindow.includes('.maybeSingle(') &&
        canEmit('PERF-005', file.path)
      ) {
        findings.push({
          id: `perf-${counter++}`,
          ruleId: 'PERF-005',
          title: 'Unbounded Table Query (`select("*")` Without Pagination/Limit)',
          category: 'performance',
          severity: 'medium',
          filePath: file.path,
          lineNumber: i + 1,
          codeSnippet: line.trim(),
          explanation:
            'Fetching all columns and rows without `.limit()` or `.range()` causes payload bloat and memory spikes as production tables grow.',
          remediation:
            'Select only required columns `.select("id, name, created_at")` and attach `.limit(50)` or cursor pagination.',
          aiFixPrompt: `Optimize the unbounded query in \`${file.path}\` at line ${i + 1} (PERF-005): specify explicit columns in \`.select()\` and enforce pagination with \`.limit()\`.`,
        });
      }

      // PERF-006: Blocking CPU busy-wait (mdelay) in C, or an undocumented raw-pointer/FFI `unsafe` block in Rust.
      // Rust 2024's required `unsafe { std::env::set_var(..) }` and similar API-level unsafe calls are not flagged.
      const prevLine = lines[i - 1] ?? '';
      const safetyWindow = lines.slice(Math.max(0, i - 5), i + 1).join('\n');
      const unsafeBody = lines.slice(i, i + 6).join('\n');
      const rawPointerUnsafe =
        /\bunsafe\s*\{/.test(line) && /(\*\s*\w+\s*=|\*mut\b|\*const\b|transmute|from_raw|get_unchecked|ptr::|as_ptr|offset\(|\bextern\b)/.test(unsafeBody);
      if (
        ((/\.(c|h|cpp|cc)$/.test(file.path) && /\bmdelay\s*\(\s*\d+/.test(line)) ||
          (file.path.endsWith('.rs') && rawPointerUnsafe && !/\/\/\s*SAFETY:/i.test(safetyWindow))) &&
        canEmit('PERF-006', file.path)
      ) {
        findings.push({
          id: `perf-${counter++}`,
          ruleId: 'PERF-006',
          title: file.path.endsWith('.rs')
            ? 'Undocumented `unsafe` Block Without `// SAFETY:` Invariant'
            : 'Hard CPU Busy-Wait (`mdelay`) Stalling Scheduler Core',
          category: 'performance',
          severity: file.path.endsWith('.rs') ? 'medium' : 'high',
          filePath: file.path,
          lineNumber: i + 1,
          codeSnippet: `${prevLine.trim()}\n${line.trim()}`.trim(),
          explanation: file.path.endsWith('.rs')
            ? 'Using raw pointer or FFI `unsafe` blocks without an explicit `// SAFETY:` invariant comment obscures aliasing and lifetime guarantees.'
            : 'Calling `mdelay()` spins the hardware CPU core in a tight busy-loop for milliseconds, starving other kernel threads and spiking latency.',
          remediation: file.path.endsWith('.rs')
            ? 'Document the pointer validity and concurrency invariants in a `// SAFETY:` comment immediately above the `unsafe` block.'
            : 'Replace `mdelay()` in non-atomic context with `usleep_range(min, max)` or `msleep()` so the scheduler can yield the CPU core.',
          aiFixPrompt: `Resolve PERF-006 in \`${file.path}\` at line ${i + 1}: replace busy-wait \`mdelay()\` with yielding sleep or document the \`// SAFETY:\` invariant on the \`unsafe\` block.`,
        });
      }
    }
  }

  return findings;
}
