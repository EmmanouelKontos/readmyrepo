import { RepoFileInput } from '../types/atlas';

export { classifyLayer } from './layerClassifier';
export { extractImports } from './importExtractor';

const EXTS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.vue', '.svelte', '.py', '.rs', '.c', '.h', '.cpp', '.hpp', '.go', '.swift', '.kt', '.dart'];
const INDEX_FILES = ['index.ts', 'index.tsx', 'index.js', 'index.jsx', 'mod.rs', '__init__.py'];
const PY_STDLIB = new Set(
  'abc argparse ast asyncio base64 collections contextlib copy csv dataclasses datetime decimal enum functools glob hashlib heapq html http importlib inspect io itertools json logging math multiprocessing operator os pathlib pickle platform queue random re secrets select shutil signal socket sqlite3 ssl string struct subprocess sys tempfile threading time types typing unittest urllib uuid warnings weakref xml zipfile'.split(' ')
);
const JS_FILE = /\.(m|c)?(t|j)sx?$|\.(vue|svelte)$/;

function commonPrefixSegments(a: string, b: string): number {
  const as = a.split('/');
  const bs = b.split('/');
  let n = 0;
  while (n < as.length && n < bs.length && as[n] === bs[n]) n++;
  return n;
}

/** Among several candidate files, prefer the one living closest to the importer (same package/crate). */
function pickClosest(fromPath: string, matches: string[]): string | null {
  if (matches.length === 0) return null;
  return matches.reduce((best, p) => (commonPrefixSegments(fromPath, p) > commonPrefixSegments(fromPath, best) ? p : best));
}

function candidatesFor(base: string): string[] {
  const stem = base.replace(/\.(?:m?js|jsx|cjs)$/, '');
  return [base, stem, ...EXTS.map((e) => `${stem}${e}`), ...INDEX_FILES.map((i) => `${stem}/${i}`)];
}

function joinRelative(dirParts: string[], spec: string): string {
  const parts = [...dirParts];
  for (const part of spec.split('/')) {
    if (part === '.' || part === '') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  return parts.join('/');
}

function resolveBySuffix(fromPath: string, rest: string, allPaths: string[]): string | null {
  const cands = candidatesFor(rest);
  const matches = allPaths.filter((p) => cands.some((c) => p === c || p.endsWith(`/${c}`)));
  return pickClosest(fromPath, matches);
}

function resolvePythonRelative(dirParts: string[], spec: string, allPaths: string[]): string | null {
  const dots = spec.match(/^\.+/)?.[0].length ?? 1;
  const base = dirParts.slice(0, Math.max(0, dirParts.length - (dots - 1)));
  const rest = spec.slice(dots).replace(/\./g, '/');
  const target = [...base, rest].filter(Boolean).join('/');
  const cands = rest ? [`${target}.py`, `${target}/__init__.py`] : [`${target}/__init__.py`];
  return allPaths.find((p) => cands.includes(p)) ?? null;
}

function pickGoPackageFile(importPath: string, files: string[]): string {
  const last = importPath.split('/').pop() ?? '';
  const sorted = [...files].sort();
  return sorted.find((p) => p.endsWith(`/${last}.go`) || p === `${last}.go`) ?? sorted.find((p) => p.endsWith('doc.go')) ?? sorted[0];
}

function resolveGo(fromPath: string, importPath: string, allPaths: string[], allFiles?: RepoFileInput[]): string | null {
  const goFiles = allPaths.filter((p) => p.endsWith('.go') && !p.endsWith('_test.go'));
  const dirOf = (p: string) => p.split('/').slice(0, -1).join('/');

  // go.mod gives the exact module path → directory mapping
  for (const mod of allFiles?.filter((f) => /(^|\/)go\.mod$/.test(f.path)) ?? []) {
    const modulePath = mod.content.match(/^module\s+(\S+)/m)?.[1];
    if (!modulePath || (importPath !== modulePath && !importPath.startsWith(`${modulePath}/`))) continue;
    const rel = importPath.slice(modulePath.length + 1);
    const dir = [dirOf(mod.path), rel].filter(Boolean).join('/');
    const inPkg = goFiles.filter((p) => dirOf(p) === dir && dirOf(fromPath) !== dir);
    return inPkg.length ? pickGoPackageFile(importPath, inPkg) : null;
  }

  const segs = importPath.split('/');
  if (!segs[0]?.includes('.')) {
    // Standard library, unless the analyzed tree *is* that package (e.g. golang/go's src/net/http/internal)
    if (segs.length < 2) return null;
    const inPkg = goFiles.filter((p) => {
      const dir = dirOf(p);
      return (dir === importPath || dir.endsWith(`/${importPath}`)) && dirOf(fromPath) !== dir;
    });
    return inPkg.length ? pickGoPackageFile(importPath, inPkg) : null;
  }
  for (let k = Math.min(4, segs.length - 1); k >= 1; k--) {
    const dirSuffix = segs.slice(-k).join('/');
    const matches = goFiles.filter((p) => {
      const dir = dirOf(p);
      return dir === dirSuffix || dir.endsWith(`/${dirSuffix}`);
    });
    if (matches.length > 0) return pickClosest(fromPath, matches.sort());
  }
  return null;
}

/** File that defines the module whose children live in `dir` (foo.rs / foo/mod.rs / src/lib.rs). */
function rustModuleFile(dir: string, allPaths: string[]): string | null {
  const cands = [`${dir}.rs`, `${dir}/mod.rs`, `${dir}/lib.rs`, `${dir}/main.rs`];
  return cands.map((c) => allPaths.find((p) => p === c)).find(Boolean) ?? null;
}

function resolveRust(fromPath: string, spec: string, dirParts: string[], allPaths: string[]): string | null {
  const isModRoot = /(^|\/)(main|lib|mod)\.rs$/.test(fromPath);
  // Directory holding this file's child modules
  const selfDir = isModRoot ? dirParts : [...dirParts, fromPath.split('/').pop()!.replace(/\.rs$/, '')];
  if (!spec.includes('::')) {
    // `mod foo;` → foo.rs or foo/mod.rs next to the declaring module
    const base = [...selfDir, spec].join('/');
    return allPaths.find((p) => p === `${base}.rs` || p === `${base}/mod.rs`) ?? null;
  }
  const parts = spec.split('::').filter((p) => p !== '*');
  const head = parts.shift();
  const srcIdx = dirParts.lastIndexOf('src');
  const crateRoot = srcIdx >= 0 ? dirParts.slice(0, srcIdx + 1) : dirParts;
  const superDir = isModRoot ? dirParts.slice(0, -1) : dirParts;
  const root = head === 'crate' ? crateRoot : head === 'super' ? superDir : head === 'kernel' ? ['rust', 'kernel'] : selfDir;
  for (let len = parts.length; len >= 1; len--) {
    const base = [...root, ...parts.slice(0, len)].join('/');
    const found = allPaths.find((p) => p === `${base}.rs` || p === `${base}/mod.rs`);
    if (found) return found;
  }
  // Item defined directly in the target module file (`use crate::Error`, `use super::*`)
  return head === 'self' ? null : rustModuleFile(root.join('/'), allPaths);
}

export function resolveImportToFile(fromPath: string, spec: string, allPaths: string[], allFiles?: RepoFileInput[]): string | null {
  if (spec.startsWith('tauri::')) {
    const cmd = spec.slice('tauri::'.length);
    if (cmd === 'config_bridge') return allPaths.find((p) => p.endsWith('.rs') && p.startsWith('src-tauri/')) ?? null;
    const target = allFiles?.find((f) => f.path.endsWith('.rs') && new RegExp(`\\bfn\\s+${cmd}\\b`).test(f.content));
    return target?.path ?? allPaths.find((p) => p.endsWith('.rs')) ?? null;
  }

  if (spec.startsWith('/api/')) {
    const seg = spec.replace(/^\/api\//, '');
    return allPaths.find((p) => p.endsWith(`/api/${seg}/route.ts`) || p.endsWith(`/api/${seg}.ts`) || p === `api/${seg}.ts`) ?? null;
  }

  const dirParts = fromPath.split('/').slice(0, -1);
  if (spec.startsWith('go:')) return resolveGo(fromPath, spec.slice(3), allPaths, allFiles);
  if (fromPath.endsWith('.json')) {
    // manifest.json / tauri.conf.json entries are relative to the manifest's directory
    const target = joinRelative(dirParts, spec.replace(/^\//, ''));
    return allPaths.find((p) => candidatesFor(target).includes(p)) ?? null;
  }
  if (fromPath.endsWith('.rs')) return resolveRust(fromPath, spec, dirParts, allPaths);
  if (fromPath.endsWith('.py') && /^\.+[\w.]*$/.test(spec)) return resolvePythonRelative(dirParts, spec, allPaths);

  // Path aliases: `@/x`, `~/x` (tsconfig paths / Vite / Nuxt) and baseUrl-style `src/x`
  if (/^[@~]\//.test(spec) || spec.startsWith('src/')) {
    const rest = spec.replace(/^[@~]\//, '');
    return resolveBySuffix(fromPath, rest, allPaths) ?? (rest.startsWith('src/') ? null : resolveBySuffix(fromPath, `src/${rest}`, allPaths));
  }

  if (spec.startsWith('.')) {
    const target = joinRelative(dirParts, spec);
    const cands = candidatesFor(target);
    return allPaths.find((p) => cands.includes(p)) ?? null;
  }

  // Bare specifiers
  if (/\.(c|h|cc|cpp|hpp|hh|m|mm)$/.test(fromPath)) {
    const local = dirParts.length ? `${dirParts.join('/')}/${spec}` : spec;
    return allPaths.find((p) => p === local || p === spec || p === `include/${spec}`) ?? pickClosest(fromPath, allPaths.filter((p) => p.endsWith(`/${spec}`)));
  }
  if (fromPath.endsWith('.py')) {
    const find = (dotted: string) => {
      const mod = dotted.replace(/\./g, '/');
      const top = mod.split('/')[0];
      return pickClosest(
        fromPath,
        allPaths.filter((p) => {
          const tail = p.endsWith(`${mod}.py`) ? `${mod}.py` : p.endsWith(`${mod}/__init__.py`) ? `${mod}/__init__.py` : null;
          if (!tail) return false;
          const prefix = p.slice(0, p.length - tail.length);
          if (prefix && !prefix.endsWith('/')) return false;
          // Absolute imports start at a source root: never inside another package (`flask/json` ≠ stdlib `json`)
          if (prefix && allPaths.includes(`${prefix}__init__.py`)) return false;
          return !(prefix && PY_STDLIB.has(top));
        })
      );
    };
    const parent = spec.includes('.') ? spec.slice(0, spec.lastIndexOf('.')) : null;
    const direct = spec.endsWith('.*') ? null : find(spec);
    if (direct || !parent) return direct;
    const parentFile = find(parent);
    // `from django.db.models import signals` inside django/db/models/: a lowercase name is most likely a
    // sibling submodule that is not in the sample — falling back to the package __init__ would invent a cycle.
    const name = spec.slice(spec.lastIndexOf('.') + 1);
    const parentDir = parentFile?.replace(/(\/__init__)?\.py$/, '/');
    if (parentDir && fromPath.startsWith(parentDir) && /^[a-z][a-z0-9_]*$/.test(name)) return null;
    return parentFile;
  }
  if (JS_FILE.test(fromPath) || !/\.\w+$/.test(fromPath)) {
    // npm packages ("react", "@scope/pkg") are external; only baseUrl-style multi-segment paths can be local
    if (spec.startsWith('@') || !spec.includes('/')) return null;
    return resolveBySuffix(fromPath, spec, allPaths);
  }
  return null;
}
