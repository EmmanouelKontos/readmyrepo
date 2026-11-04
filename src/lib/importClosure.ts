import { RepoFileInput } from '../types/atlas';
import { extractImportsDetailed } from './importExtractor';
import { resolveImportToFile } from './importResolver';

/** Resolution is linear in the pool size; skip completion on pathological trees. */
const MAX_POOL = 40_000;

/**
 * A stratified sample often misses the hub modules its files import (`mm/internal.h`,
 * a shared `utils.ts`). Resolve every sampled file's local imports against the full tree
 * and return the most-referenced files that are not in the sample yet.
 */
export function missingImportTargets(sampled: RepoFileInput[], poolPaths: string[], limit: number): string[] {
  if (limit <= 0 || poolPaths.length > MAX_POOL) return [];
  const have = new Set(sampled.map((f) => f.path));
  const refs = new Map<string, number>();

  for (const file of sampled) {
    const seen = new Set<string>();
    for (const { spec, reexport } of extractImportsDetailed(file.content, file.path)) {
      if (spec.startsWith('tauri::') || spec.startsWith('/api/')) continue;
      const target = resolveImportToFile(file.path, spec, poolPaths, sampled);
      if (!target || have.has(target) || seen.has(target)) continue;
      seen.add(target);
      // A barrel line (`export * from './de'`) is weak evidence that the target matters.
      refs.set(target, (refs.get(target) ?? 0) + (reexport ? 0.25 : 1));
    }
  }

  return [...refs.entries()]
    .filter(([, weight]) => weight >= 1)
    .sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)
    .slice(0, limit)
    .map(([path]) => path);
}
