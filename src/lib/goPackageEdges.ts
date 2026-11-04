import { RepoFileInput } from '../types/atlas';

export interface GoSymbolEdge {
  from: string;
  to: string;
  line: number;
}

const TOP_LEVEL_DECL = /^(?:func\s+([A-Za-z_]\w*)\s*[[(]|type\s+([A-Za-z_]\w*)\b|(?:var|const)\s+([A-Za-z_]\w*)\b)/gm;
const GROUPED_DECL = /^(?:var|const|type)\s*\(([\s\S]*?)^\)/gm;
const IGNORED = new Set(['init', 'main', '_']);

function dirOf(path: string): string {
  return path.split('/').slice(0, -1).join('/');
}

/** Top-level identifiers a Go file declares (funcs, types, vars, consts — including grouped blocks). */
function declaredSymbols(content: string): Set<string> {
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  TOP_LEVEL_DECL.lastIndex = 0;
  while ((m = TOP_LEVEL_DECL.exec(content)) !== null) {
    const name = m[1] || m[2] || m[3];
    if (name && name.length > 2 && !IGNORED.has(name)) out.add(name);
  }
  GROUPED_DECL.lastIndex = 0;
  while ((m = GROUPED_DECL.exec(content)) !== null) {
    for (const g of m[1].matchAll(/^\s+([A-Za-z_]\w*)\b/gm)) {
      if (g[1].length > 2 && !IGNORED.has(g[1])) out.add(g[1]);
    }
  }
  return out;
}

/** Identifiers referenced outside comments and string literals. */
function referencedIdentifiers(content: string): Set<string> {
  const code = content
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/"(?:\\.|[^"\\\n])*"|`[^`]*`/g, '""');
  return new Set(code.match(/\b[A-Za-z_]\w*\b/g) ?? []);
}

function lineOf(content: string, ident: string): number {
  const idx = content.search(new RegExp(`\\b${ident}\\b`));
  return idx < 0 ? 1 : content.slice(0, idx).split('\n').length;
}

/**
 * Go files in one package share a scope and never import each other, so the import graph alone
 * leaves them disconnected. This links A → B when A uses a top-level symbol declared in B.
 */
export function goIntraPackageEdges(files: RepoFileInput[]): GoSymbolEdge[] {
  const goFiles = files.filter((f) => f.path.endsWith('.go'));
  const byDir = new Map<string, RepoFileInput[]>();
  for (const f of goFiles) {
    const list = byDir.get(dirOf(f.path)) ?? [];
    list.push(f);
    byDir.set(dirOf(f.path), list);
  }

  const edges: GoSymbolEdge[] = [];
  for (const pkgFiles of byDir.values()) {
    if (pkgFiles.length < 2) continue;
    const decls = new Map(pkgFiles.map((f) => [f.path, declaredSymbols(f.content)]));
    for (const from of pkgFiles) {
      const refs = referencedIdentifiers(from.content);
      const own = decls.get(from.path)!;
      for (const to of pkgFiles) {
        if (to === from) continue;
        const hit = [...decls.get(to.path)!].find((sym) => refs.has(sym) && !own.has(sym));
        if (hit) edges.push({ from: from.path, to: to.path, line: lineOf(from.content, hit) });
      }
    }
  }
  return edges;
}
