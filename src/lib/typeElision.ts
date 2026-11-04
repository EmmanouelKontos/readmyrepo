import { RepoFileInput } from '../types/atlas';
import { resolveImportToFile } from './importResolver';
import { ImportBinding } from './importExtractor';

const MAX_DEPTH = 3;

function escapeId(name: string): string {
  return name.replace(/\$/g, '\\$');
}

/**
 * Decides whether a named TypeScript import is erased at compile time, i.e. every binding is an
 * interface or type alias — declared in the target or re-exported through barrels (`export * from`).
 */
export function createTypeElisionChecker(files: RepoFileInput[]) {
  const byPath = new Map(files.map((f) => [f.path, f.content]));
  const allPaths = files.map((f) => f.path);
  const memo = new Map<string, boolean>();

  function isTypeName(name: string, path: string, depth: number): boolean {
    const key = `${path}#${name}`;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;
    memo.set(key, false); // guards re-export loops
    const content = byPath.get(path);
    let result = false;
    if (content !== undefined) {
      const id = escapeId(name);
      const declaredType = new RegExp(`^\\s*(?:export\\s+)?(?:declare\\s+)?(?:interface|type)\\s+${id}\\b`, 'm').test(content);
      const declaredValue = new RegExp(`\\b(?:const|let|var|function|class|enum)\\s+${id}\\b`).test(content);
      if (declaredType || declaredValue) result = declaredType && !declaredValue;
      else if (new RegExp(`export\\s+type\\s*\\{[^}]*\\b${id}\\b[^}]*\\}\\s*from`).test(content)) result = true;
      else if (depth < MAX_DEPTH) {
        const follow = (spec: string) => {
          const next = resolveImportToFile(path, spec, allPaths, files);
          return next !== null && next !== path && isTypeName(name, next, depth + 1);
        };
        const named = new RegExp(`export\\s*\\{[^}]*\\b${id}\\b[^}]*\\}\\s*from\\s*['"]([^'"]+)['"]`).exec(content);
        if (named) result = follow(named[1]);
        else result = [...content.matchAll(/^\s*export\s*\*\s*from\s*['"]([^'"]+)['"]/gm)].some((m) => follow(m[1]));
      }
    }
    memo.set(key, result);
    return result;
  }

  const strippedCache = new Map<string, string>();
  const strippedSource = (path: string) => {
    let code = strippedCache.get(path);
    if (code === undefined) {
      code = (byPath.get(path) ?? '')
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/\/\/[^\n]*/g, ' ')
        .replace(/\b(?:import|export)\b[^;'"]*?\bfrom\s*['"][^'"]+['"]/g, ' ');
      strippedCache.set(path, code);
    }
    return code;
  };

  /** TS also erases bindings that are only ever used in type positions in the importing file. */
  function usedOnlyAsType(fromPath: string, name: string): boolean {
    const code = strippedSource(fromPath);
    for (const m of code.matchAll(new RegExp(`(?<![\\w$.])${escapeId(name)}(?![\\w$])`, 'g'))) {
      const before = code.slice(Math.max(0, m.index - 80), m.index);
      const typeContext = /(?::|\||&|<|\bas|\bimplements|\bkeyof|\breadonly)\s*$/.test(before) || /\binterface\s+[\w$]+[^{]*\bextends\s+(?:[\w$.<>,\s]+,\s*)?$/.test(before);
      if (!typeContext) return false;
    }
    return true;
  }

  return (fromPath: string, names: ImportBinding[] | undefined, targetPath: string): boolean => {
    if (!names?.length || !/\.tsx?$/.test(fromPath) || !/\.tsx?$/.test(targetPath)) return false;
    // `export { x } from` re-exports a value whenever x is one, so only the declaration check applies there
    return names.every((b) => isTypeName(b.imported, targetPath, 0) || (b.local !== '' && usedOnlyAsType(fromPath, b.local)));
  };
}
