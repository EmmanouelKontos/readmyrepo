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
        title: 'Whole page shipped to the browser ("use client" at the top)',
        category: 'performance',
        severity: 'high',
        filePath: file.path,
        lineNumber: 1,
        codeSnippet: lines.slice(0, 4).join('\n').trim(),
        explanation:
          'Putting "use client" at the top of a large page or layout sends all of it, and everything it imports, to the browser as JavaScript. Pages load and respond more slowly.',
        remediation:
          'Keep the page itself on the server and move only the interactive parts (forms, toggles, dialogs) into small "use client" components.',
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
          title: `Index file re-exports ${wildcardExports.length} modules at once (slower builds)`,
          category: 'performance',
          severity: 'medium',
          filePath: file.path,
          lineNumber: 1,
          codeSnippet: lines.slice(0, 6).join('\n').trim(),
          explanation:
            'This `index` file passes along everything from several modules with `export *`. Importing one small thing through it makes build tools and tests load all of them.',
          remediation:
            'Import from the specific file you need, or replace `export *` with named exports of what callers actually use.',
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
          title: 'Requests run one after another instead of together',
          category: 'performance',
          severity: 'high',
          filePath: file.path,
          lineNumber: i + 1,
          codeSnippet: `${line.trim()}\n${nextLine.trim()}`,
          explanation:
            'Two requests that do not depend on each other are awaited one at a time, so the user waits for both in a row.',
          remediation:
            'Start them together: `const [a, b] = await Promise.all([reqA(), reqB()])`.',
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
      const sequentialLoop = iteratesCollection && (dbCall || httpCall);
      if ((sequentialLoop || (mapsAsync && dbCall)) && canEmit('PERF-004', file.path)) {
        // `Promise.all(items.map(async …))` still costs N round-trips but runs them concurrently.
        const parallel = !sequentialLoop;
        findings.push({
          id: `perf-${counter++}`,
          ruleId: 'PERF-004',
          title: parallel ? 'One database query per item (run in parallel)' : 'Database or API call inside a loop (N+1 queries)',
          category: 'performance',
          severity: parallel ? 'medium' : 'critical',
          filePath: file.path,
          lineNumber: i + 1,
          codeSnippet: lines.slice(i, i + 3).join('\n').trim(),
          explanation: parallel
            ? 'Every item in the list sends its own database query. They run at the same time, but a list of 500 items still means 500 queries.'
            : 'A request is made for every item in the loop, one after another. With 500 items that is 500 round-trips, and it gets slower as data grows.',
          remediation: parallel
            ? 'Where the rows share data, use one batched call (`updateMany`, `createMany`, `.in("id", ids)`); otherwise cap concurrency or wrap the per-row writes in a single transaction.'
            : 'Batch the IDs before the loop and fetch all matching records in a single `.in("id", ids)` query.',
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
          title: 'Query loads every row and column (no limit)',
          category: 'performance',
          severity: 'medium',
          filePath: file.path,
          lineNumber: i + 1,
          codeSnippet: line.trim(),
          explanation:
            '`select("*")` without `.limit()` downloads the whole table. It feels fine with test data and becomes slow and memory-hungry as real data grows.',
          remediation:
            'Ask only for the columns you show, e.g. `.select("id, name, created_at")`, and page the results with `.limit(50)` or `.range()`.',
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
            ? '`unsafe` block without a SAFETY note'
            : 'Busy-wait that blocks a CPU core (`mdelay`)',
          category: 'performance',
          severity: file.path.endsWith('.rs') ? 'medium' : 'high',
          filePath: file.path,
          lineNumber: i + 1,
          codeSnippet: `${prevLine.trim()}\n${line.trim()}`.trim(),
          explanation: file.path.endsWith('.rs')
            ? 'This `unsafe` block works with raw pointers or foreign code but does not explain why it is safe, so reviewers cannot check the assumptions it relies on.'
            : '`mdelay()` keeps the CPU spinning for milliseconds doing nothing, so other work on that core has to wait.',
          remediation: file.path.endsWith('.rs')
            ? 'Add a `// SAFETY:` comment right above the block explaining why the pointers are valid and nothing else can change them meanwhile.'
            : 'Where sleeping is allowed, use `usleep_range(min, max)` or `msleep()` so the CPU can do other work while waiting.',
          aiFixPrompt: `Resolve PERF-006 in \`${file.path}\` at line ${i + 1}: replace busy-wait \`mdelay()\` with yielding sleep or document the \`// SAFETY:\` invariant on the \`unsafe\` block.`,
        });
      }
    }
  }

  return findings;
}
