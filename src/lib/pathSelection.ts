/** Which repository paths are worth analyzing, and how a large tree is sampled down to a cohesive subset. */
const CODE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.vue', '.svelte', '.py', '.rs', '.c', '.h', '.cpp', '.hpp', '.cc', '.go', '.swift', '.kt', '.dart', '.sql', '.json', '.toml'];
const IGNORED_SEGMENTS = new Set(['node_modules', 'dist', 'build', 'out', '.next', '.nuxt', '.svelte-kit', '.git', 'vendor', 'third_party', 'coverage', '__pycache__', 'documentation', 'docs', '__tests__', '__mocks__', 'test', 'tests', 'testing', 'spec', 'specs', 'e2e', 'fixtures', 'testdata', 'examples', 'example', 'benchmarks', 'bench', 'samples', 'demo', 'demos', 'playground', 'website', 'docs_src', 'templates', 'script', 'scripts', '.github', '.vscode', '.storybook', 'stories', 'target']);
const TEST_FILE = /(?:\.(?:test|spec|stories|bench)|_test|-test|\.d)\.[a-z0-9]+$|(^|\/)(test_[^/]+\.py|conftest\.py)$|\.min\.js$/i;

/** Small manifests that carry module/entry wiring; always kept in a sample. */
const PINNED_MANIFEST = /(^|\/)(go\.mod|manifest\.json|tauri\.conf\.json)$/i;

export function isAnalyzablePath(path: string): boolean {
  if (path.includes('..') || path.startsWith('/')) return false;
  const lower = path.toLowerCase();
  if (lower.split('/').slice(0, -1).some((seg) => IGNORED_SEGMENTS.has(seg) || /^_*(docs?|examples?)[_-]|^(tests?|specs?)[-_.]|[-_](tests?|specs?)$/.test(seg))) return false;
  if (/(^|\/)go\.mod$/.test(lower)) return true;
  if (TEST_FILE.test(lower)) return false;
  if (lower.endsWith('package-lock.json') || lower.endsWith('bun.lock') || lower.endsWith('cargo.lock')) return false;
  if (lower.endsWith('.json') && path.includes('/') && !lower.endsWith('manifest.json') && !lower.endsWith('tauri.conf.json')) {
    return false;
  }
  return CODE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function selectStratifiedPaths<T extends { path: string }>(items: T[], maxFiles = 32, repoName?: string): T[] {
  if (items.length <= maxFiles) return items;
  // Only manifests at the top of the analyzed tree describe it (not a nested package's own manifest).
  const depth = (p: string) => p.split('/').length;
  const rootDepth = Math.min(...items.map((i) => depth(i.path)));
  const pinned = items.filter((i) => PINNED_MANIFEST.test(i.path) && depth(i.path) === rootDepth).slice(0, 3);
  const repoDir = repoName?.toLowerCase().replace(/[^a-z0-9_]/g, '_');

  const byDir = new Map<string, T[]>();
  for (const item of items) {
    const parts = item.path.split('/');
    const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : '.';
    const list = byDir.get(dir) ?? [];
    list.push(item);
    byDir.set(dir, list);
  }

  const dirClusters = Array.from(byDir.entries()).map(([dir, files]) => {
    const hasHeader = files.some((f) => /(\.h|mod\.rs|lib\.rs|index\.[tj]sx?|sched\.h|types\.[tj]s)$/i.test(f.path));
    const implCount = files.filter((f) => /\.(c|rs|ts|tsx|js|jsx|py|go|swift|kt)$/i.test(f.path)).length;
    const isCore =
      /^(src|app|kernel\/sched|kernel\/locking|init|mm|rust\/kernel|packages\/[^/]+\/src|crates\/[^/]+\/src|lib|cmd)(\/|$)/.test(dir) ||
      (Boolean(repoDir) && dir.toLowerCase().replace(/^src\//, '').split('/')[0].replace(/[^a-z0-9_]/g, '_') === repoDir);
    return { dir, files, score: Math.min(implCount, 12) * 5 + (hasHeader ? 25 : 0) + (isCore ? 45 : 0) - dir.split('/').length * 3 };
  });
  dirClusters.sort((a, b) => b.score - a.score);

  const selected: T[] = [...pinned];
  for (const cluster of dirClusters) {
    if (selected.length >= maxFiles) break;
    const headers = cluster.files.filter((f) => /(\.h|\.hpp|types\.[tj]s|mod\.rs|index\.[tj]sx?)$/i.test(f.path)).slice(0, 5);
    const impls = cluster.files.filter((f) => !headers.includes(f)).sort((a, b) => a.path.length - b.path.length).slice(0, 9);
    for (const file of [...headers, ...impls]) {
      if (selected.length < maxFiles && !selected.includes(file)) selected.push(file);
    }
  }
  for (const item of items) {
    if (selected.length >= maxFiles) break;
    if (!selected.includes(item)) selected.push(item);
  }
  return selected;
}

/** Conventional names for core source folders, in rough order of how central they usually are. */
const PRIORITY_ROOT_DIRS = ['src', 'app', 'kernel', 'init', 'mm', 'packages', 'crates', 'lib', 'pkg', 'internal', 'cmd', 'server', 'rust', 'security', 'ipc'];
const CORE_DIR_NAMES = ['core', 'base', 'common', 'runtime', 'engine', 'platform', 'chrome', 'content', 'components', 'modules', 'services', 'api', 'compiler', 'stdlib', 'sources', 'client', 'frontend', 'backend', 'net'];

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * For repositories too large to list in one go: choose up to `max` top-level folders worth listing.
 * Folders named after the repo or owner come first (`homeassistant/` in home-assistant/core), then
 * conventional source folders, then other likely-core names; docs, tests and vendored code never qualify.
 */
export function pickRootDirs<T extends { path: string; type: string }>(entries: T[], owner: string, repo: string, max = 4): T[] {
  const dirs = entries.filter((e) => e.type === 'tree' && !e.path.startsWith('.') && isAnalyzablePath(`${e.path}/probe.ts`));
  const byName = (names: string[]) => names.map((n) => dirs.find((d) => d.path.toLowerCase() === n)).filter((d): d is T => Boolean(d));
  const named = dirs.filter((d) => [normalize(repo), normalize(owner)].includes(normalize(d.path)));
  const rest = [...dirs].sort((a, b) => a.path.localeCompare(b.path));
  const ordered = [...named, ...byName(PRIORITY_ROOT_DIRS), ...byName(CORE_DIR_NAMES), ...rest];
  return [...new Set(ordered)].slice(0, max);
}
