import { describe, expect, it } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { analyzeRepository } from '../src/lib/analyzer';
import {
  assertAllowedGitHubEndpoint,
  fetchGitHubRepoFiles,
  isAnalyzablePath,
  parseGitHubInput,
  selectStratifiedPaths,
  validateGitHubToken,
} from '../src/lib/githubFetcher';
import { classifyLayer, extractImports, resolveImportToFile } from '../src/lib/importResolver';
import {
  clearAllPinnedProjects,
  isProjectPinned,
  loadPinnedProjects,
  pinOrUpdateProject,
  unpinProject,
} from '../src/lib/pinnedProjectsStore';
import { PRESET_REPOSITORIES } from '../src/lib/presetRepos';
import { applyQuickRemediationToCode, computeSnapshotDiff } from '../src/lib/snapshotTracker';
import { RepoFileInput } from '../src/types/atlas';

function collectSrcFiles(dir: string, rootDir: string): RepoFileInput[] {
  const entries = readdirSync(dir);
  const results: RepoFileInput[] = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      results.push(...collectSrcFiles(full, rootDir));
    } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
      results.push({
        path: relative(rootDir, full),
        content: readFileSync(full, 'utf8'),
      });
    }
  }
  return results;
}

describe('ReadMyRepo Static Analyzer, Security & Performance Suite', () => {
  it('classifies architectural layers accurately', () => {
    expect(classifyLayer('package.json')).toBe('config');
    expect(classifyLayer('src/types/atlas.ts')).toBe('data');
    expect(classifyLayer('src/services/billingService.ts')).toBe('service');
    expect(classifyLayer('src/components/ui/Button.tsx')).toBe('ui');
    expect(classifyLayer('src/features/billing/BillingDashboard.tsx')).toBe('feature');
    expect(classifyLayer('src/app/page.tsx')).toBe('entry');
  });

  it('extracts and resolves relative and alias imports without false positives', () => {
    const code = `
      import React from 'react';
      import { Card } from '../../components/ui/Card';
      import { BillingRow } from '@/types/billing';
    `;
    const specs = extractImports(code);
    expect(specs).toEqual(['react', '../../components/ui/Card', '@/types/billing']);

    const allPaths = [
      'src/features/billing/View.tsx',
      'src/components/ui/Card.tsx',
      'src/types/billing.ts',
    ];
    expect(resolveImportToFile('src/features/billing/View.tsx', '../../components/ui/Card', allPaths)).toBe(
      'src/components/ui/Card.tsx'
    );
    expect(resolveImportToFile('src/features/billing/View.tsx', '@/types/billing', allPaths)).toBe(
      'src/types/billing.ts'
    );
  });

  it('rejects unsafe path traversal or lockfiles in isAnalyzablePath', () => {
    expect(isAnalyzablePath('../secrets.ts')).toBe(false);
    expect(isAnalyzablePath('/etc/passwd.json')).toBe(false);
    expect(isAnalyzablePath('node_modules/pkg/index.ts')).toBe(false);
    expect(isAnalyzablePath('src/App.tsx')).toBe(true);
  });

  it('detects all 12 security, performance, and architecture findings in Pulse AI preset', () => {
    const pulse = PRESET_REPOSITORIES[0];
    const result = analyzeRepository(pulse.name, pulse.description, 'Test', pulse.files, {
      repoSlug: pulse.slug,
      stackTags: pulse.stackTags,
    });

    expect(result.findings.length).toBe(12);
    expect(result.scores.circularDepsCount).toBe(1);
    expect(result.scores.godFilesCount).toBe(1);
    expect(result.findings.some((f) => f.ruleId === 'SEC-001')).toBe(true);
    expect(result.findings.some((f) => f.ruleId === 'SEC-002')).toBe(true);
    expect(result.findings.some((f) => f.ruleId === 'SEC-003')).toBe(true);
    expect(result.findings.some((f) => f.ruleId === 'SEC-004')).toBe(true);
    expect(result.findings.some((f) => f.ruleId === 'SEC-005')).toBe(true);
    expect(result.findings.some((f) => f.ruleId === 'PERF-002')).toBe(true);
    expect(result.findings.some((f) => f.ruleId === 'PERF-003')).toBe(true);
    expect(result.findings.some((f) => f.ruleId === 'PERF-004')).toBe(true);
    expect(result.findings.some((f) => f.ruleId === 'PERF-005')).toBe(true);
    expect(result.findings.some((f) => f.ruleId === 'ARCH-001')).toBe(true);
    expect(result.findings.some((f) => f.ruleId === 'ARCH-002')).toBe(true);
  });

  it('scores 100/100 on the clean modular reference preset', () => {
    const clean = PRESET_REPOSITORIES[1];
    const result = analyzeRepository(clean.name, clean.description, 'Test', clean.files, {
      repoSlug: clean.slug,
      stackTags: clean.stackTags,
    });

    expect(result.findings.length).toBe(0);
    expect(result.scores.overall).toBe(100);
    expect(result.scores.architecture).toBe(100);
    expect(result.scores.security).toBe(100);
    expect(result.scores.performance).toBe(100);
  });

  it('analyzes Chrome Extension (MV3) and Tauri v2 Desktop presets with cross-boundary AST edges', () => {
    const mv3 = PRESET_REPOSITORIES.find((p) => p.id === 'mv3-browser-extension')!;
    const mv3Result = analyzeRepository(mv3.name, mv3.description, 'Test', mv3.files);
    const manifestNode = mv3Result.nodes.find((n) => n.path === 'manifest.json')!;
    expect(manifestNode.imports.length).toBe(2);
    expect(mv3Result.findings.some((f) => f.ruleId === 'SEC-007')).toBe(true);

    const tauri = PRESET_REPOSITORIES.find((p) => p.id === 'tauri-desktop-overlay')!;
    const tauriResult = analyzeRepository(tauri.name, tauri.description, 'Test', tauri.files);
    const bridgeNode = tauriResult.nodes.find((n) => n.path === 'src/services/ipcBridge.ts')!;
    expect(bridgeNode.imports).toContain('src-tauri/src/capture.rs');
    expect(tauriResult.findings.some((f) => f.ruleId === 'SEC-008')).toBe(true);
    expect(tauriResult.findings.some((f) => f.ruleId === 'PERF-006')).toBe(true);
  });

  it('analyzes C11 & Rust Linux Kernel subsystem preset with #include AST edges and systems audits', () => {
    const kernel = PRESET_REPOSITORIES.find((p) => p.id === 'linux-kernel-sched')!;
    expect(kernel).toBeDefined();
    const result = analyzeRepository(kernel.name, kernel.description, 'Test', kernel.files, {
      repoSlug: kernel.slug,
      stackTags: kernel.stackTags,
    });

    expect(result.edges.length).toBeGreaterThanOrEqual(6);
    expect(result.findings.some((f) => f.ruleId === 'SEC-006')).toBe(true);
    expect(result.findings.filter((f) => f.ruleId === 'PERF-006').length).toBe(2);
  });

  it('parses GitHub mega-repo subpath URLs and performs stratified architectural sampling', () => {
    expect(parseGitHubInput('torvalds/linux/kernel/sched')).toEqual({
      owner: 'torvalds',
      repo: 'linux',
      subpath: 'kernel/sched',
    });
    expect(parseGitHubInput('https://github.com/torvalds/linux/tree/master/kernel/bpf')).toEqual({
      owner: 'torvalds',
      repo: 'linux',
      branchHint: 'master',
      subpath: 'kernel/bpf',
    });

    const mockMegaTree = Array.from({ length: 120 }, (_, i) => ({
      path: i % 3 === 0 ? `kernel/sched/core_${i}.c` : i % 3 === 1 ? `include/linux/hdr_${i}.h` : `arch/x86/boot_${i}.c`,
    }));
    const sampled = selectStratifiedPaths(mockMegaTree, 32);
    expect(sampled.length).toBe(32);
  });

  it('validates private GitHub PAT format and blocks untrusted outbound hosts', () => {
    expect(validateGitHubToken('')).toBeUndefined();
    expect(validateGitHubToken('ghp_1234567890abcdefghijklmnop')).toBe('ghp_1234567890abcdefghijklmnop');
    expect(validateGitHubToken('github_pat_11AABBCCDD_1234567890abcdefghij')).toBe(
      'github_pat_11AABBCCDD_1234567890abcdefghij'
    );
    expect(() => validateGitHubToken('Bearer malicious\r\nHeader: 1')).toThrow();
    expect(() => validateGitHubToken('invalid-token-123')).toThrow();

    expect(() => assertAllowedGitHubEndpoint('https://api.github.com/repos/torvalds/linux')).not.toThrow();
    expect(() => assertAllowedGitHubEndpoint('https://evil.example.com/steal')).toThrow();
    expect(() => assertAllowedGitHubEndpoint('http://api.github.com/repos/torvalds/linux')).toThrow();
  });

  it('ignores commented-out code, dependent awaits, and detects 3-hop cycles + ARCH-003 layer inversions', () => {
    const edgeCaseFiles: RepoFileInput[] = [
      {
        path: 'src/features/a.ts',
        content: `import { b } from './b';
// strcpy(buf, input);
// dangerouslySetInnerHTML={{ __html: raw }}
export async function loadDependent() {
  const user = await fetchUser();
  const profile = await fetchProfile(user.id);
  return { b, profile };
}`,
      },
      {
        path: 'src/features/b.ts',
        content: `import { c } from './c';\nexport const b = c;`,
      },
      {
        path: 'src/features/c.ts',
        content: `import { loadDependent } from './a';\nexport const c = loadDependent;`,
      },
      {
        path: 'src/components/ui/BadWidget.tsx',
        content: `import { b } from '../../features/b';\nexport const BadWidget = () => b;`,
      },
    ];

    const res = analyzeRepository('EdgeCaseRepo', 'Accuracy Test', 'Test', edgeCaseFiles);
    // Commented out XSS and dependent awaits must produce 0 security and 0 performance findings
    expect(res.findings.filter((f) => f.category === 'security').length).toBe(0);
    expect(res.findings.filter((f) => f.category === 'performance').length).toBe(0);
    expect(res.scores.security).toBe(100);
    expect(res.scores.performance).toBe(100);

    // 3-hop cycle (a -> b -> c -> a) and upward layer inversion (ui -> feature) must be caught
    expect(res.scores.circularDepsCount).toBe(1);
    expect(res.findings.some((f) => f.ruleId === 'ARCH-002')).toBe(true);
    expect(res.findings.some((f) => f.ruleId === 'ARCH-003')).toBe(true);
    expect(res.scores.architecture).toBe(100 - 16 - 12); // 72
    expect(res.scores.overall).toBe(Math.round(100 * 0.38 + 100 * 0.32 + 72 * 0.3)); // 92
  });

  it('verifies ReadMyRepo own source code has 100/100 architecture (0 circular deps, 0 god files >220 LOC)', () => {
    const projectRoot = join(import.meta.dir, '..');
    const srcFiles = collectSrcFiles(join(projectRoot, 'src'), projectRoot);
    const selfAudit = analyzeRepository('ReadMyRepo', 'Self Audit', 'Workspace', srcFiles);

    expect(selfAudit.scores.circularDepsCount).toBe(0);
    expect(selfAudit.scores.godFilesCount).toBe(0);
    expect(selfAudit.scores.architecture).toBe(100);
  });

  it('tracks live code changes and computes positive score deltas after quick remediation', () => {
    const preset = PRESET_REPOSITORIES[0];
    const baseline = analyzeRepository(preset.name, preset.description, 'Baseline', preset.files, {
      repoSlug: preset.slug,
      stackTags: preset.stackTags,
    });

    // No changes yet -> diff should be null
    expect(computeSnapshotDiff(baseline, baseline)).toBeNull();

    // Apply quick remediation to all files in the preset
    const remediatedFiles = preset.files.map((f) => ({
      path: f.path,
      content: applyQuickRemediationToCode(f.path, f.content, baseline.findings),
    }));

    const refactored = analyzeRepository(
      preset.name,
      preset.description,
      'Refactored',
      remediatedFiles,
      { repoSlug: preset.slug, stackTags: preset.stackTags }
    );

    const diff = computeSnapshotDiff(baseline, refactored);
    expect(diff).not.toBeNull();
    expect(diff!.overallDelta).toBeGreaterThan(0);
    expect(diff!.securityDelta).toBeGreaterThan(0);
    expect(diff!.resolvedFindingsCount).toBeGreaterThanOrEqual(3);
  });

  it('resolves TypeScript ESM .js->.ts imports and analyzes real GitHub https://github.com/torvalds/linux', async () => {
    const allPaths = [
      'packages/zod/src/v4/classic/schemas.ts',
      'packages/zod/src/v4/classic/checks.ts',
      'packages/zod/src/v4/core/index.ts',
    ];
    expect(
      resolveImportToFile(
        'packages/zod/src/v4/classic/schemas.ts',
        './checks.js',
        allPaths
      )
    ).toBe('packages/zod/src/v4/classic/checks.ts');
    expect(
      resolveImportToFile(
        'packages/zod/src/v4/classic/schemas.ts',
        '../core/index.js',
        allPaths
      )
    ).toBe('packages/zod/src/v4/core/index.ts');

    // Live end-to-end test against https://github.com/torvalds/linux
    const linuxRes = await fetchGitHubRepoFiles('https://github.com/torvalds/linux');
    expect(linuxRes.files.length).toBeGreaterThanOrEqual(10);
    const linuxAnalysis = analyzeRepository(
      linuxRes.repoName,
      linuxRes.description,
      'Live GitHub Scan',
      linuxRes.files,
      { repoSlug: linuxRes.repoName }
    );
    expect(linuxAnalysis.edges.length).toBeGreaterThanOrEqual(10);
    expect(linuxAnalysis.scores.overall).toBeGreaterThanOrEqual(50);
  });

  it('pins, updates with preserved baseline scores, and unpins projects in browser cache store', () => {
    clearAllPinnedProjects();
    const preset = PRESET_REPOSITORIES[0];
    const initial = analyzeRepository(preset.name, preset.description, 'Initial', preset.files, {
      repoSlug: preset.slug,
      stackTags: preset.stackTags,
    });

    const afterPin = pinOrUpdateProject(initial, preset.id);
    expect(afterPin.length).toBe(1);
    expect(isProjectPinned(preset.slug, afterPin)).toBe(true);
    expect(afterPin[0].baselineScores.overall).toBe(initial.scores.overall);

    // Refactor files and update pinned record -> baselineScores must remain locked to initial scan
    const fixedFiles = preset.files.map((f) => ({
      path: f.path,
      content: applyQuickRemediationToCode(f.path, f.content, initial.findings),
    }));
    const refactored = analyzeRepository(preset.name, preset.description, 'Refactored', fixedFiles, {
      repoSlug: preset.slug,
      stackTags: preset.stackTags,
    });
    const afterUpdate = pinOrUpdateProject(refactored, preset.id);
    expect(afterUpdate[0].baselineScores.overall).toBe(initial.scores.overall);
    expect(afterUpdate[0].scores.overall).toBeGreaterThan(afterUpdate[0].baselineScores.overall);

    // Unpin removes it cleanly
    const afterUnpin = unpinProject(preset.slug);
    expect(isProjectPinned(preset.slug, afterUnpin)).toBe(false);
    expect(loadPinnedProjects().length).toBe(0);
  });
});
