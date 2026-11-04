import { RepoFileInput } from '../types/atlas';

const CORE_MAKEFILES = [
  'kernel/sched/Makefile',
  'kernel/locking/Makefile',
  'init/Makefile',
  'mm/Makefile',
];

const ALLOWED_FALLBACK_HOSTS = new Set(['raw.githubusercontent.com', 'ungh.cc']);

function encodeSafeRepoPath(path: string): string | null {
  if (!path || path.includes('..') || /[\0\r\n\\]/.test(path)) return null;
  const parts = path.split('/').filter(Boolean);
  if (parts.length === 0 || parts.some((p) => p === '.' || p === '..')) return null;
  return parts.map(encodeURIComponent).join('/');
}

async function fetchRawSafe(url: string, timeoutMs = 10000): Promise<Response | null> {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || !ALLOWED_FALLBACK_HOSTS.has(parsed.hostname)) {
    throw new Error(`Blocked fallback connection to untrusted host: ${parsed.hostname}`);
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal, credentials: 'omit' });
      if (res.ok || res.status === 404 || res.status === 403) return res;
    } catch {
      if (attempt === 1) return null;
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

/**
 * Zero-rate-limit public repository fallback when api.github.com returns 403/429:
 * 1) For C/Rust systems mega-repos with Makefiles (e.g. torvalds/linux), discovers cohesive
 *    subsystem .c modules + their #include "..." local headers directly via raw.githubusercontent.com.
 * 2) Queries ungh.cc (UnJS Cloudflare-cached GitHub tree mirror) for exact live HEAD file trees.
 */
export async function fetchPublicFallbackTreeOrFiles(
  owner: string,
  repo: string,
  branchHint: string | undefined,
  subpath: string | undefined,
  isAnalyzablePath: (p: string) => boolean,
  selectStratifiedPaths: <T extends { path: string }>(items: T[], max?: number) => T[]
): Promise<{
  branch: string;
  description?: string;
  candidatePaths: Array<{ path: string }>;
  preloadedFiles?: RepoFileInput[];
} | null> {
  const encOwner = encodeURIComponent(owner);
  const encRepo = encodeURIComponent(repo);

  let branch = branchHint || 'main';
  let description: string | undefined;

  const metaRes = await fetchRawSafe(`https://ungh.cc/repos/${encOwner}/${encRepo}`);
  if (metaRes && metaRes.ok) {
    const metaJson = (await metaRes.json()) as {
      repo?: { defaultBranch?: string; description?: string };
    };
    if (!branchHint && metaJson.repo?.defaultBranch) {
      branch = metaJson.repo.defaultBranch;
    }
    if (metaJson.repo?.description) {
      description = metaJson.repo.description;
    }
  }

  // Strategy A: Direct Makefile + Local Header Graph Discovery (ideal for torvalds/linux & C/Kbuild subpaths)
  const makefiles = subpath ? [`${subpath.replace(/\/$/, '')}/Makefile`] : CORE_MAKEFILES;
  const discoveredCPaths = new Set<string>();

  for (const mkPath of makefiles) {
    const safeMk = encodeSafeRepoPath(mkPath);
    if (!safeMk) continue;
    const dir = mkPath.split('/').slice(0, -1).join('/');
    const mkRes = await fetchRawSafe(
      `https://raw.githubusercontent.com/${encOwner}/${encRepo}/${encodeURIComponent(branch)}/${safeMk}`
    );
    if (!mkRes || !mkRes.ok) continue;
    const mkText = await mkRes.text();
    for (const m of mkText.matchAll(/\b([a-zA-Z0-9_-]+)\.o\b/g)) {
      const stem = m[1];
      if (stem && !stem.includes('test') && !stem.includes('trace')) {
        discoveredCPaths.add(dir ? `${dir}/${stem}.c` : `${stem}.c`);
      }
    }
  }

  if (discoveredCPaths.size >= 4) {
    const cPaths = Array.from(discoveredCPaths).slice(0, 20);
    const cFiles: RepoFileInput[] = [];
    const localHeaderPaths = new Set<string>();

    await Promise.all(
      cPaths.map(async (cPath) => {
        const safeC = encodeSafeRepoPath(cPath);
        if (!safeC) return;
        const r = await fetchRawSafe(
          `https://raw.githubusercontent.com/${encOwner}/${encRepo}/${encodeURIComponent(branch)}/${safeC}`
        );
        if (!r || !r.ok) return;
        const content = await r.text();
        if (content.length > 0 && content.length < 180_000) {
          cFiles.push({ path: cPath, content });
          const dir = cPath.split('/').slice(0, -1).join('/');
          for (const inc of content.matchAll(/^\s*#\s*include\s+"([^"]+\.h)"/gm)) {
            const candidateHeader = dir ? `${dir}/${inc[1]}` : inc[1];
            if (inc[1] && encodeSafeRepoPath(candidateHeader)) {
              localHeaderPaths.add(candidateHeader);
            }
          }
        }
      })
    );

    const hPaths = Array.from(localHeaderPaths).slice(0, Math.max(8, 32 - cFiles.length));
    const hFiles: RepoFileInput[] = [];
    await Promise.all(
      hPaths.map(async (hPath) => {
        const safeH = encodeSafeRepoPath(hPath);
        if (!safeH) return;
        const r = await fetchRawSafe(
          `https://raw.githubusercontent.com/${encOwner}/${encRepo}/${encodeURIComponent(branch)}/${safeH}`
        );
        if (r && r.ok) {
          const content = await r.text();
          if (content.length > 0 && content.length < 180_000) {
            hFiles.push({ path: hPath, content });
          }
        }
      })
    );

    const preloadedFiles = [...cFiles, ...hFiles].slice(0, 32);
    if (preloadedFiles.length > 0) {
      return {
        branch,
        description,
        candidatePaths: preloadedFiles.map((f) => ({ path: f.path })),
        preloadedFiles,
      };
    }
  }

  // Strategy B: ungh.cc Live Branch File Tree Mirror
  const treeRes = await fetchRawSafe(
    `https://ungh.cc/repos/${encOwner}/${encRepo}/files/${encodeURIComponent(branch)}`
  );
  if (treeRes && treeRes.ok) {
    const data = (await treeRes.json()) as { files?: Array<{ path: string; size?: number }> };
    if (Array.isArray(data.files) && data.files.length > 0) {
      const filtered = data.files.filter(
        (f) =>
          (f.size ?? 0) < 150_000 &&
          isAnalyzablePath(f.path) &&
          (!subpath || f.path.startsWith(subpath))
      );
      if (filtered.length > 0) {
        return {
          branch,
          description,
          candidatePaths: selectStratifiedPaths(filtered, 32),
        };
      }
    }
  }

  return null;
}
