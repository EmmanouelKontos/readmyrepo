import { RepoFileInput } from '../types/atlas';
import { fetchPublicFallbackTreeOrFiles } from './githubFallback';
import { missingImportTargets } from './importClosure';
import { isAnalyzablePath, selectStratifiedPaths } from './pathSelection';

export { isAnalyzablePath, selectStratifiedPaths };

const SAFE_SLUG_SEGMENT = /^[a-zA-Z0-9._-]+$/;
const ALLOWED_GITHUB_HOSTS = new Set(['api.github.com', 'raw.githubusercontent.com', 'ungh.cc']);
const SAFE_PAT_PATTERN = /^(gh[pousr]_[A-Za-z0-9_]{16,255}|github_pat_[A-Za-z0-9_]{20,255})$/;
const MAX_CLOSURE_FILES = 12;
const PRIORITY_ROOT_DIRS = ['src', 'app', 'kernel', 'init', 'mm', 'rust', 'security', 'ipc', 'packages', 'crates', 'lib', 'cmd', 'server'];

export function validateGitHubToken(rawToken?: string): string | undefined {
  if (!rawToken || !rawToken.trim()) return undefined;
  const trimmed = rawToken.trim();
  if (/[\r\n\0]/.test(trimmed) || !SAFE_PAT_PATTERN.test(trimmed)) {
    throw new Error('Invalid GitHub PAT format. Expected fine-grained (github_pat_...) or classic (ghp_...).');
  }
  return trimmed;
}

export function assertAllowedGitHubEndpoint(url: string): void {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || !ALLOWED_GITHUB_HOSTS.has(parsed.hostname)) {
    throw new Error(`Blocked outbound connection to untrusted host: ${parsed.hostname}`);
  }
}

async function fetchGitHubSafe(url: string, token?: string, acceptRaw = false, timeoutMs = 12000): Promise<Response> {
  assertAllowedGitHubEndpoint(url);
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const headers: Record<string, string> = { Accept: acceptRaw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    try {
      return await fetch(url, { signal: controller.signal, headers, credentials: 'omit' });
    } catch (err) {
      if (attempt === 1) throw err;
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error('Unreachable');
}

export function parseGitHubInput(repoInput: string): { owner: string; repo: string; branchHint?: string; subpath?: string } {
  const cleaned = repoInput.trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '').split(/[?#]/)[0].replace(/\/$/, '');
  if (cleaned.includes('..') || /[\0\r\n\\]/.test(cleaned)) {
    throw new Error('Invalid repository path: path traversal segments are not allowed.');
  }
  const parts = cleaned.split('/').filter(Boolean);
  if (parts.length < 2) throw new Error('Enter a valid GitHub repository (e.g. "owner/repo" or "owner/repo/subpath").');
  const [owner, repo, ...rest] = parts;
  if (!SAFE_SLUG_SEGMENT.test(owner) || !SAFE_SLUG_SEGMENT.test(repo)) {
    throw new Error('Invalid repository owner or name format. Use alphanumeric "owner/repo".');
  }
  if (rest[0] === 'tree' || rest[0] === 'blob') {
    return { owner, repo, branchHint: rest[1], subpath: rest.slice(2).join('/') || undefined };
  }
  return { owner, repo, subpath: rest.length > 0 ? rest.join('/') : undefined };
}

export async function fetchGitHubRepoFiles(
  repoInput: string,
  rawToken?: string
): Promise<{ repoName: string; description: string; files: RepoFileInput[]; isPrivate?: boolean }> {
  const { owner, repo, branchHint, subpath } = parseGitHubInput(repoInput);
  const token = validateGitHubToken(rawToken);
  const encOwner = encodeURIComponent(owner);
  const encRepo = encodeURIComponent(repo);

  const metaRes = await fetchGitHubSafe(`https://api.github.com/repos/${encOwner}/${encRepo}`, token);
  let fullName = `${owner}/${repo}`;
  let descriptionText: string | null = null;
  let branch = branchHint || 'main';
  let isPrivate = false;
  let repoSize = 0;

  if (metaRes.ok) {
    const meta = (await metaRes.json()) as { full_name: string; description: string | null; default_branch: string; private?: boolean; size?: number };
    fullName = meta.full_name;
    descriptionText = meta.description;
    branch = branchHint || meta.default_branch;
    isPrivate = Boolean(meta.private);
    repoSize = meta.size ?? 0;
  } else if ((metaRes.status === 403 || metaRes.status === 429) && !token) {
    const fb = await fetchPublicFallbackTreeOrFiles(owner, repo, branchHint, subpath, isAnalyzablePath, selectStratifiedPaths);
    if (!fb) throw new Error(`GitHub API rate limit reached for "${owner}/${repo}". Provide a PAT via "Private Repo" for 5,000 req/hr.`);
    const fbBranch = encodeURIComponent(fb.branch);
    const files = fb.preloadedFiles ?? (await downloadSelectedFiles(encOwner, encRepo, fbBranch, fb.candidatePaths));
    const extra = fb.preloadedFiles ? [] : missingImportTargets(files, fb.pool ?? [], MAX_CLOSURE_FILES);
    if (extra.length) files.push(...(await downloadSelectedFiles(encOwner, encRepo, fbBranch, extra.map((path) => ({ path })))));
    const displaySlug = subpath ? `${fullName}/${subpath}` : fullName;
    const modeNote = `Stratified architectural sample (${files.length} modules).`;
    return { repoName: displaySlug, description: fb.description ? `${fb.description} — ${modeNote}` : modeNote, files, isPrivate: false };
  } else {
    const hint = metaRes.status === 404 && !token ? ' If private, click "Private Repo" to provide a read-only PAT.' : '';
    throw new Error(`GitHub repository "${owner}/${repo}" not found or rate-limited (HTTP ${metaRes.status}).${hint}`);
  }

  const encBranch = encodeURIComponent(branch);
  let candidatePaths: Array<{ path: string }> = [];
  let pool: string[] = [];
  let isStratifiedSample = repoSize > 300_000;

  if (subpath) {
    // `<branch>:<path>` is a valid tree-ish, giving a recursive listing of just this folder.
    const subTreeRes = await fetchGitHubSafe(`https://api.github.com/repos/${encOwner}/${encRepo}/git/trees/${encodeURIComponent(`${branch}:${subpath}`)}?recursive=1`, token);
    if (subTreeRes.ok) {
      const d = (await subTreeRes.json()) as { tree: Array<{ path: string; type: string; size?: number }> };
      const blobs = d.tree
        .filter((i) => i.type === 'blob' && (i.size ?? 0) < 160_000)
        .map((i) => ({ path: `${subpath}/${i.path}` }))
        .filter((i) => isAnalyzablePath(i.path));
      pool = blobs.map((b) => b.path);
      candidatePaths = selectStratifiedPaths(blobs, 32, repo);
    }
  }
  if (subpath && candidatePaths.length === 0) {
    const safeSub = subpath.split('/').map(encodeURIComponent).join('/');
    const contentsRes = await fetchGitHubSafe(`https://api.github.com/repos/${encOwner}/${encRepo}/contents/${safeSub}?ref=${encBranch}`, token);
    if (contentsRes.ok) {
      const items = (await contentsRes.json()) as Array<{ path: string; type: string; size?: number }>;
      if (Array.isArray(items)) {
        const files = items.filter((i) => i.type === 'file' && (i.size ?? 0) < 160_000 && isAnalyzablePath(i.path));
        pool = files.map((f) => f.path);
        candidatePaths = selectStratifiedPaths(files, 32, repo);
      }
    }
  } else if (!subpath && repoSize > 300_000) {
    const rootRes = await fetchGitHubSafe(`https://api.github.com/repos/${encOwner}/${encRepo}/git/trees/${encBranch}`, token);
    if (rootRes.ok) {
      const rootData = (await rootRes.json()) as { tree: Array<{ path: string; type: string; sha: string }> };
      const subDirs = PRIORITY_ROOT_DIRS.map((name) => rootData.tree.find((x) => x.type === 'tree' && x.path === name)).filter(Boolean).slice(0, 4);
      const subBlobs = await Promise.all(
        subDirs.map(async (dir) => {
          const r = await fetchGitHubSafe(`https://api.github.com/repos/${encOwner}/${encRepo}/git/trees/${dir!.sha}?recursive=1`, token);
          if (!r.ok) return [];
          const d = (await r.json()) as { tree: Array<{ path: string; type: string; size?: number }> };
          return d.tree.filter((i) => i.type === 'blob' && (i.size ?? 0) < 160_000 && isAnalyzablePath(`${dir!.path}/${i.path}`)).map((i) => ({ path: `${dir!.path}/${i.path}` }));
        })
      );
      pool = subBlobs.flat().map((b) => b.path);
      candidatePaths = selectStratifiedPaths(subBlobs.flat(), 32, repo);
    }
  }

  if (candidatePaths.length === 0) {
    const treeRes = await fetchGitHubSafe(`https://api.github.com/repos/${encOwner}/${encRepo}/git/trees/${encBranch}?recursive=1`, token);
    if (treeRes.ok) {
      const treeData = (await treeRes.json()) as { truncated?: boolean; tree: Array<{ path: string; type: string; size?: number }> };
      isStratifiedSample = isStratifiedSample || Boolean(treeData.truncated);
      const filtered = treeData.tree.filter((item) => item.type === 'blob' && (item.size ?? 0) < 150_000 && isAnalyzablePath(item.path) && (!subpath || item.path.startsWith(subpath)));
      pool = filtered.map((f) => f.path);
      candidatePaths = selectStratifiedPaths(filtered, 32, repo);
    } else if (!token) {
      const fb = await fetchPublicFallbackTreeOrFiles(owner, repo, branch, subpath, isAnalyzablePath, selectStratifiedPaths);
      if (fb) {
        candidatePaths = fb.candidatePaths;
        pool = fb.pool ?? [];
      }
    }
  }

  if (candidatePaths.length === 0) throw new Error('No supported source code files (.ts, .js, .py, .rs, .c, .h, .go, .swift, .kt) found.');
  const validFiles = await downloadSelectedFiles(encOwner, encRepo, encBranch, candidatePaths, token);
  // Pull in the hub modules the sample imports but missed (shared headers, utils, base classes).
  const extra = missingImportTargets(validFiles, pool, MAX_CLOSURE_FILES);
  if (extra.length) validFiles.push(...(await downloadSelectedFiles(encOwner, encRepo, encBranch, extra.map((path) => ({ path })), token)));
  const displaySlug = subpath ? `${fullName}/${subpath}` : fullName;
  const modeNote = isStratifiedSample ? `Stratified architectural sample (${validFiles.length} modules).` : `${validFiles.length} source modules inspected${isPrivate ? ' (Private Repo)' : ''}.`;
  return { repoName: displaySlug, description: descriptionText ? `${descriptionText} — ${modeNote}` : modeNote, files: validFiles, isPrivate };
}

async function downloadSelectedFiles(encOwner: string, encRepo: string, encBranch: string, items: Array<{ path: string }>, token?: string): Promise<RepoFileInput[]> {
  const files = await Promise.all(
    items.map(async (item) => {
      try {
        const safePath = item.path.split('/').map(encodeURIComponent).join('/');
        const url = token
          ? `https://api.github.com/repos/${encOwner}/${encRepo}/contents/${safePath}?ref=${encBranch}`
          : `https://raw.githubusercontent.com/${encOwner}/${encRepo}/${encBranch}/${safePath}`;
        const res = await fetchGitHubSafe(url, token, Boolean(token));
        return { path: item.path, content: res.ok ? await res.text() : '' };
      } catch {
        return { path: item.path, content: '' };
      }
    })
  );
  return files.filter((f) => f.content.trim().length > 0);
}
