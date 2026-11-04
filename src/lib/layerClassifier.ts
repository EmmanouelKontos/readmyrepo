import { ArchitecturalLayer } from '../types/atlas';

const ENTRY_FILE = /(^|\/)(main|index|app|cli|server|__main__|lib|mod|background|content|popup|options|sidepanel|service[-_]?worker|worker)\.(ts|tsx|js|jsx|mjs|cjs|py|rs|go|c|cpp|swift|kt|dart)$/;
const ROUTE_FILE = /(^|\/)(page|layout|route|loader|template|default|error|not-found)\.(t|j)sx?$/;
const ENTRY_DIR = /(^|\/)(app|pages|routes|bin|cmd|entrypoints?)\//;

function segments(lower: string): string[] {
  return lower.split('/').slice(0, -1);
}

/**
 * Path-based layer hint. Returns `null` when the path carries no architectural signal,
 * so the analyzer can fall back to the dependency graph (unreferenced → entry, otherwise → service).
 */
export function classifyLayerHint(path: string): ArchitecturalLayer | null {
  const lower = path.toLowerCase();
  const segs = segments(lower);
  const file = lower.split('/').pop() ?? lower;

  if (
    /(^|\/)(package\.json|tsconfig[\w.-]*\.json|manifest\.json|tauri\.conf\.json|cargo\.toml|pyproject\.toml|go\.mod|makefile)$/.test(lower) ||
    /(^|\/)kconfig[\w.-]*$/.test(lower) ||
    /(^|[./_-])config(s)?([./_-]|$)/.test(file) ||
    /\.config\.(ts|js|mjs|cjs)$/.test(file) ||
    segs.includes('config') ||
    segs.includes('configs')
  ) {
    return 'config';
  }

  if (
    segs.some((s) => s === 'types' || s === 'typings' || s === 'schemas' || s === 'schema' || s === 'models' || s === 'include' || s === 'interfaces' || s === 'dto' || s === 'entities') ||
    /^(types?|schema|schemas|models?|interfaces?|constants?|enums?)\.(ts|tsx|js|py|rs|go)$/.test(file) ||
    /\.(d\.ts|sql|h|hpp|hh|proto)$/.test(file)
  ) {
    return 'data';
  }

  if (segs.some((s) => s === 'ui' || s === 'primitives' || s === 'widgets' || s === 'design-system' || s === 'atoms')) {
    return 'ui';
  }

  if (ROUTE_FILE.test(lower) || (ENTRY_DIR.test(lower) && !segs.includes('api'))) return 'entry';

  if (
    segs.some((s) =>
      ['features', 'feature', 'components', 'hooks', 'screens', 'views', 'containers', 'modules', 'hud', 'sched', 'locking', 'bpf', 'commands', 'handlers', 'controllers', 'blueprints'].includes(s)
    )
  ) {
    return 'feature';
  }

  if (
    segs.some((s) =>
      ['lib', 'libs', 'services', 'service', 'api', 'utils', 'util', 'helpers', 'core', 'server', 'db', 'store', 'stores', 'clients', 'adapters', 'providers', 'internal', 'pkg', 'crates', 'kernel', 'mm', 'drivers', 'fs', 'net', 'src-tauri'].includes(s)
    ) ||
    /(client|bridge|service|repository|adapter|provider)s?\.(ts|tsx|js|py|rs|go)$/.test(file)
  ) {
    return ENTRY_FILE.test(lower) && (segs.length <= 2 || /(^|\/)src\/(main|lib|index)\.\w+$/.test(lower)) ? 'entry' : 'service';
  }

  if (ENTRY_FILE.test(lower)) return 'entry';
  return null;
}

/** Back-compat API: path-only classification with `entry` as the default. */
export function classifyLayer(path: string): ArchitecturalLayer {
  return classifyLayerHint(path) ?? 'entry';
}
