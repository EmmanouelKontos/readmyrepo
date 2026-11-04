import { RepoFileInput } from '../types/atlas';

const ALLOWED_GITHUB_HOSTS = new Set(['api.github.com', 'raw.githubusercontent.com', 'ungh.cc']);
/** Parallel downloads per scan; enough to be quick, low enough not to trip GitHub's abuse limits. */
const DOWNLOAD_CONCURRENCY = 8;

export function assertAllowedGitHubEndpoint(url: string): void {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || !ALLOWED_GITHUB_HOSTS.has(parsed.hostname)) {
    throw new Error(`Blocked outbound connection to untrusted host: ${parsed.hostname}`);
  }
}

/**
 * Allow-listed fetch with timeout and one retry. The token is attached only for api.github.com,
 * so it never travels to raw.githubusercontent.com or the ungh.cc mirror.
 */
export async function fetchGitHubSafe(url: string, token?: string, acceptRaw = false, timeoutMs = 12000): Promise<Response> {
  assertAllowedGitHubEndpoint(url);
  const isApi = new URL(url).hostname === 'api.github.com';
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const headers: Record<string, string> = isApi ? { Accept: acceptRaw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json' } : {};
    if (token && isApi) headers.Authorization = `Bearer ${token}`;
    try {
      return await fetch(url, { signal: controller.signal, headers, credentials: 'omit', referrerPolicy: 'no-referrer' });
    } catch (err) {
      if (attempt === 1) throw err;
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error('Unreachable');
}

/** Runs `fn` over `items` with at most `limit` in flight, preserving order. */
export async function mapWithLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

/**
 * Downloads file contents. Public repositories always use raw.githubusercontent.com, which does not
 * count against the API quota; only private repositories go through the authenticated contents API.
 */
export async function downloadSelectedFiles(
  encOwner: string,
  encRepo: string,
  encBranch: string,
  items: Array<{ path: string }>,
  privateToken?: string
): Promise<RepoFileInput[]> {
  const files = await mapWithLimit(items, DOWNLOAD_CONCURRENCY, async (item) => {
    try {
      const safePath = item.path.split('/').map(encodeURIComponent).join('/');
      const url = privateToken
        ? `https://api.github.com/repos/${encOwner}/${encRepo}/contents/${safePath}?ref=${encBranch}`
        : `https://raw.githubusercontent.com/${encOwner}/${encRepo}/${encBranch}/${safePath}`;
      const res = await fetchGitHubSafe(url, privateToken, Boolean(privateToken));
      return { path: item.path, content: res.ok ? await res.text() : '' };
    } catch {
      return { path: item.path, content: '' };
    }
  });
  return files.filter((f) => f.content.trim().length > 0 && !f.content.includes('\u0000'));
}
