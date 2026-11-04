import { RepoFileInput } from '../types/atlas';
import { fetchPublicFallbackTreeOrFiles } from './githubFallback';
import { missingImportTargets } from './importClosure';
import { isAnalyzablePath, pickRootDirs, selectStratifiedPaths } from './pathSelection';
import { assertAllowedGitHubEndpoint, downloadSelectedFiles, fetchGitHubSafe } from './githubTransport';

export { assertAllowedGitHubEndpoint, isAnalyzablePath, selectStratifiedPaths };

const SAFE_SLUG_SEGMENT = /^[a-zA-Z0-9._-]+$/;
const SAFE_PAT_PATTERN = /^(gh[pousr]_[A-Za-z0-9_]{16,255}|github_pat_[A-Za-z0-9_]{20,255})$/;
const MAX_CLOSURE_FILES = 12;
const RATE_LIMIT_MESSAGE =
  'GitHub is limiting how many repositories can be read without signing in (about 60 requests an hour). Wait a bit, or add a free read-only access token under "Private repository" to keep going.';
const DOWNLOAD_FAILED_MESSAGE = 'GitHub listed the files but none could be downloaded. It may be limiting requests right now; wait a minute and try again.';

/** GitHub descriptions often carry emoji shortcodes (`:rocket:`) that only render on github.com. */
function cleanDescription(text: string | null): string | null {
  const cleaned = text?.replace(/(^|\s):[a-z][a-z0-9_+-]*:(?=\s|$)/gi, '$1').replace(/\s{2,}/g, ' ').trim();
  return cleaned || null;
}

/** Plain-language note on how much of the repository was read. */
function scanNote(scanned: number, available: number, forcedSample: boolean, isPrivate: boolean): string {
  const priv = isPrivate ? ' (private repository)' : '';
  if (available > scanned) return `Scanned ${scanned} of ${available.toLocaleString()} source files${priv}, picking the most connected ones.`;
  if (forcedSample) return `Scanned a sample of ${scanned} key source files${priv}; the repository is too large to read in full.`;
  return `Scanned all ${scanned} source files${priv}.`;
}

export function validateGitHubToken(rawToken?: string): string | undefined {
  if (!rawToken || !rawToken.trim()) return undefined;
  const trimmed = rawToken.trim();
  if (/[\r\n\0]/.test(trimmed) || !SAFE_PAT_PATTERN.test(trimmed)) {
    throw new Error('That doesn’t look like a GitHub access token. Tokens start with "github_pat_" (fine-grained) or "ghp_" (classic).');
  }
  return trimmed;
}

export function parseGitHubInput(repoInput: string): { owner: string; repo: string; branchHint?: string; subpath?: string } {
  const trimmed = repoInput.trim();
  const isGitHubUrl = /^(?:https?:\/\/)?(?:www\.)?github\.com[/:]/i.test(trimmed) || /^git@github\.com:/i.test(trimmed);
  if (!isGitHubUrl && (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) || /^[\w-]+(\.[\w-]+)+\//.test(trimmed))) {
    throw new Error('ReadMyRepo reads GitHub repositories. Paste a github.com link or owner/repo, for example vercel/next.js.');
  }
  const cleaned = trimmed
    .replace(/^git@github\.com:/i, '')
    .replace(/^(?:https?:\/\/)?(?:www\.)?github\.com\//i, '')
    .split(/[?#]/)[0]
    .replace(/\/+$/, '')
    .replace(/\.git$/i, '');
  if (cleaned.includes('..') || /[\0\r\n\\]/.test(cleaned)) {
    throw new Error('That repository address isn’t valid. Use the form owner/repo, for example vercel/next.js.');
  }
  const parts = cleaned.split('/').filter(Boolean);
  if (parts.length < 2) throw new Error('Enter a GitHub repository as owner/repo (for example vercel/next.js) or paste its github.com link.');
  const [owner, repo, ...rest] = parts;
  if (!SAFE_SLUG_SEGMENT.test(owner) || !SAFE_SLUG_SEGMENT.test(repo)) {
    throw new Error('That repository name has characters GitHub doesn’t allow. Use the form owner/repo, for example vercel/next.js.');
  }
  if (rest[0] === 'tree' || rest[0] === 'blob') {
    // A /blob/ link points at one file: scan the folder that contains it.
    const pathParts = rest[0] === 'blob' ? rest.slice(2, -1) : rest.slice(2);
    return { owner, repo, branchHint: rest[1], subpath: pathParts.join('/') || undefined };
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
    descriptionText = cleanDescription(meta.description);
    branch = branchHint || meta.default_branch;
    isPrivate = Boolean(meta.private);
    repoSize = meta.size ?? 0;
  } else if (metaRes.status === 403 || metaRes.status === 429) {
    // API quota used up (for this visitor, or for the token): public repositories can still be read via
    // raw.githubusercontent.com + the ungh.cc tree mirror, which cost no API requests.
    const fb = await fetchPublicFallbackTreeOrFiles(owner, repo, branchHint, subpath, isAnalyzablePath, selectStratifiedPaths);
    if (!fb) {
      // Tell "doesn't exist" apart from "rate-limited" via the mirror (one request, only on this error path).
      const probe = await fetchGitHubSafe(`https://ungh.cc/repos/${encOwner}/${encRepo}`).catch(() => null);
      if (probe?.status === 404) throw new Error(`Couldn’t find "${owner}/${repo}" on GitHub. Check the spelling. If it is private, add a read-only access token under "Private repository".`);
      throw new Error(token ? 'GitHub is limiting requests for this token right now. Wait a few minutes and try again.' : RATE_LIMIT_MESSAGE);
    }
    const fbBranch = encodeURIComponent(fb.branch);
    const files = fb.preloadedFiles ?? (await downloadSelectedFiles(encOwner, encRepo, fbBranch, fb.candidatePaths));
    if (files.length === 0) throw new Error(DOWNLOAD_FAILED_MESSAGE);
    const extra = fb.preloadedFiles ? [] : missingImportTargets(files, fb.pool ?? [], MAX_CLOSURE_FILES);
    if (extra.length) files.push(...(await downloadSelectedFiles(encOwner, encRepo, fbBranch, extra.map((path) => ({ path })))));
    const displaySlug = subpath ? `${fullName}/${subpath}` : fullName;
    const modeNote = scanNote(files.length, fb.pool?.length ?? 0, !fb.pool, false);
    const fbAbout = cleanDescription(fb.description ?? null);
    return { repoName: displaySlug, description: fbAbout ? `${fbAbout} — ${modeNote}` : modeNote, files, isPrivate: false };
  } else {
    if (metaRes.status === 404) {
      const hint = token ? ' Check the spelling, and that your token can read it.' : ' Check the spelling. If it is private, add a read-only access token under "Private repository".';
      throw new Error(`Couldn’t find "${owner}/${repo}" on GitHub.${hint}`);
    }
    if (metaRes.status === 401) throw new Error('GitHub rejected the access token. It may have expired or been revoked; create a new read-only token and try again.');
    throw new Error(`GitHub didn’t respond normally (error ${metaRes.status}). Try again in a moment.`);
  }

  const encBranch = encodeURIComponent(branch);
  let rateLimited = false;
  const api = async (url: string) => {
    const res = await fetchGitHubSafe(url, token);
    if (res.status === 403 || res.status === 429) rateLimited = true;
    return res;
  };
  let candidatePaths: Array<{ path: string }> = [];
  let pool: string[] = [];
  let isStratifiedSample = repoSize > 300_000; // huge repo: only priority folders are listed

  if (subpath) {
    // `<branch>:<path>` is a valid tree-ish, giving a recursive listing of just this folder.
    const subTreeRes = await api(`https://api.github.com/repos/${encOwner}/${encRepo}/git/trees/${encodeURIComponent(`${branch}:${subpath}`)}?recursive=1`);
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
    const contentsRes = await api(`https://api.github.com/repos/${encOwner}/${encRepo}/contents/${safeSub}?ref=${encBranch}`);
    if (contentsRes.ok) {
      const items = (await contentsRes.json()) as Array<{ path: string; type: string; size?: number }>;
      if (Array.isArray(items)) {
        const files = items.filter((i) => i.type === 'file' && (i.size ?? 0) < 160_000 && isAnalyzablePath(i.path));
        pool = files.map((f) => f.path);
        candidatePaths = selectStratifiedPaths(files, 32, repo);
      }
    }
  } else if (!subpath && repoSize > 300_000) {
    const rootRes = await api(`https://api.github.com/repos/${encOwner}/${encRepo}/git/trees/${encBranch}`);
    if (rootRes.ok) {
      const rootData = (await rootRes.json()) as { tree: Array<{ path: string; type: string; sha: string }> };
      const subDirs = pickRootDirs(rootData.tree, owner, repo);
      const subBlobs = await Promise.all(
        subDirs.map(async (dir) => {
          const r = await api(`https://api.github.com/repos/${encOwner}/${encRepo}/git/trees/${dir.sha}?recursive=1`);
          if (!r.ok) return [];
          const d = (await r.json()) as { tree: Array<{ path: string; type: string; size?: number }> };
          return d.tree.filter((i) => i.type === 'blob' && (i.size ?? 0) < 160_000 && isAnalyzablePath(`${dir.path}/${i.path}`)).map((i) => ({ path: `${dir.path}/${i.path}` }));
        })
      );
      pool = subBlobs.flat().map((b) => b.path);
      candidatePaths = selectStratifiedPaths(subBlobs.flat(), 32, repo);
    }
  }

  if (candidatePaths.length === 0) {
    const treeRes = await api(`https://api.github.com/repos/${encOwner}/${encRepo}/git/trees/${encBranch}?recursive=1`);
    if (treeRes.ok) {
      const treeData = (await treeRes.json()) as { truncated?: boolean; tree: Array<{ path: string; type: string; size?: number }> };
      isStratifiedSample = isStratifiedSample || Boolean(treeData.truncated);
      const filtered = treeData.tree.filter((item) => item.type === 'blob' && (item.size ?? 0) < 150_000 && isAnalyzablePath(item.path) && (!subpath || item.path.startsWith(subpath)));
      pool = filtered.map((f) => f.path);
      candidatePaths = selectStratifiedPaths(filtered, 32, repo);
    } else if (!isPrivate) {
      const fb = await fetchPublicFallbackTreeOrFiles(owner, repo, branch, subpath, isAnalyzablePath, selectStratifiedPaths);
      if (fb) {
        candidatePaths = fb.candidatePaths;
        pool = fb.pool ?? [];
      }
    }
  }

  if (candidatePaths.length === 0) {
    throw new Error(
      rateLimited
        ? token ? 'GitHub is limiting requests for this token right now. Wait a few minutes and try again.' : RATE_LIMIT_MESSAGE
        : branchHint || subpath
          ? `Couldn’t open ${subpath ? `the folder "${subpath}"` : 'that branch'}${branchHint ? ` on branch "${branchHint}"` : ''}, or it has no source code ReadMyRepo can read. Check the link, or paste just ${owner}/${repo}.`
          : 'No source code ReadMyRepo can read was found here. It supports TypeScript, JavaScript, Python, Go, Rust, C/C++, Swift and Kotlin files.'
    );
  }
  // Only private repositories need the (metered) contents API; public files come from raw.githubusercontent.com.
  const privateToken = isPrivate ? token : undefined;
  const validFiles = await downloadSelectedFiles(encOwner, encRepo, encBranch, candidatePaths, privateToken);
  if (validFiles.length === 0) throw new Error(DOWNLOAD_FAILED_MESSAGE);
  // Pull in the hub modules the sample imports but missed (shared headers, utils, base classes).
  const extra = missingImportTargets(validFiles, pool, MAX_CLOSURE_FILES);
  if (extra.length) validFiles.push(...(await downloadSelectedFiles(encOwner, encRepo, encBranch, extra.map((path) => ({ path })), privateToken)));
  const displaySlug = subpath ? `${fullName}/${subpath}` : fullName;
  const modeNote = scanNote(validFiles.length, pool.length, isStratifiedSample, isPrivate);
  return { repoName: displaySlug, description: descriptionText ? `${descriptionText} — ${modeNote}` : modeNote, files: validFiles, isPrivate };
}
