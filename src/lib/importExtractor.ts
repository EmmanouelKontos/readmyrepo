export interface ImportBinding {
  /** Name exported by the target module. */
  imported: string;
  /** Name the binding has inside the importing file (differs with `as`); empty for `export { x } from` re-exports. */
  local: string;
}

export interface ImportSpec {
  spec: string;
  typeOnly: boolean;
  line: number;
  /** `export … from` re-export (barrel line) rather than an import the module itself uses. */
  reexport?: boolean;
  /** Named bindings of an ES `import { a, b as c }` / `export { a } from` (absent for default, namespace or side-effect imports). */
  names?: ImportBinding[];
}

function lineAt(content: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i++) if (content.charCodeAt(i) === 10) line++;
  return line;
}

function isCommentedOut(content: string, index: number, filePath: string): boolean {
  const start = content.lastIndexOf('\n', index - 1) + 1;
  const prefix = content.slice(start, index).trim();
  if (prefix.startsWith('//') || prefix.startsWith('*') || prefix.startsWith('/*')) return true;
  return filePath.endsWith('.py') && prefix.startsWith('#');
}

/** `{a::B, c::{D, E}, self}` → ['a::B', 'c', 'self'] (leading path of each top-level item). */
function splitRustGroup(group: string): string[] {
  const inner = group.slice(1, -1);
  const items: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of inner) {
    if (ch === '{') depth++;
    if (ch === '}') depth--;
    if (ch === ',' && depth === 0) {
      items.push(cur);
      cur = '';
    } else cur += ch;
  }
  items.push(cur);
  return items.map((i) => i.trim().match(/^\w+(?:::\w+)*/)?.[0] ?? '').filter(Boolean);
}

/** `{ a, b as c, type d }` → bindings; undefined for default / namespace / mixed clauses. */
function namedBindings(clause: string): ImportBinding[] | undefined {
  const m = clause.match(/^\{([^}]*)\}$/);
  if (!m) return undefined;
  const names = m[1]
    .split(',')
    .map((part) => part.trim().replace(/^type\s+/, ''))
    .filter(Boolean)
    .map((part) => {
      const [imported, local] = part.split(/\s+as\s+/).map((x) => x.trim());
      return { imported, local: local || imported };
    });
  return names.length ? names : undefined;
}

const TYPE_ONLY_NAMED = /^\{\s*(?:type\s+[\w$]+(?:\s+as\s+[\w$]+)?\s*,?\s*)+\}$/;

/** Extracts local-import candidates with type-only flags and 1-based line numbers. */
export function extractImportsDetailed(content: string, filePath = ''): ImportSpec[] {
  const out: ImportSpec[] = [];
  const push = (spec: string, index: number, typeOnly = false, names?: ImportBinding[], reexport = false) => {
    if (!spec || isCommentedOut(content, index, filePath)) return;
    out.push({ spec, typeOnly, line: lineAt(content, index), ...(names ? { names } : {}), ...(reexport ? { reexport } : {}) });
  };
  let m: RegExpExecArray | null;

  if (filePath.endsWith('manifest.json') || filePath.endsWith('tauri.conf.json')) {
    const jsonPath = /"(?:service_worker|default_popup|default_path|options_page|side_panel|page)"\s*:\s*"([^"]+)"/g;
    while ((m = jsonPath.exec(content)) !== null) push(m[1], m.index);
    const scripts = /"(?:js|scripts)"\s*:\s*\[([^\]]*)\]/g;
    while ((m = scripts.exec(content)) !== null) {
      for (const s of m[1].matchAll(/"([^"]+\.(?:js|ts|mjs))"/g)) push(s[1], m.index);
    }
    if (filePath.endsWith('tauri.conf.json')) out.push({ spec: 'tauri::config_bridge', typeOnly: false, line: 1 });
  }

  if (!filePath || /\.(m|c)?(t|j)sx?$|\.(vue|svelte)$/.test(filePath)) {
    const es = /(?:^|[\s;])(import|export)\s+(type\s+)?([^'";]*?\bfrom\s+)?['"]([^'"\n]+)['"]/g;
    while ((m = es.exec(content)) !== null) {
      const clause = (m[3] ?? '').replace(/\s*from\s+$/, '').trim();
      // Re-exported bindings are not "used" locally; mark them so elision only trusts declarations.
      const bindings = namedBindings(clause)?.map((b) => (m![1] === 'export' ? { ...b, local: '' } : b));
      push(m[4], m.index + m[0].indexOf(m[1]), Boolean(m[2]) || TYPE_ONLY_NAMED.test(clause), bindings, m[1] === 'export');
    }
    const dyn = /\b(?:import|require)\(\s*['"]([^'"\n]+)['"]\s*\)/g;
    while ((m = dyn.exec(content)) !== null) push(m[1], m.index);
    const invoke = /\binvoke(?:<[^>]+>)?\(\s*['"]([a-zA-Z0-9_]+)['"]/g;
    while ((m = invoke.exec(content)) !== null) push(`tauri::${m[1]}`, m.index);
    const apiFetch = /\bfetch\(\s*['"](\/api\/[a-zA-Z0-9/_-]+)['"]/g;
    while ((m = apiFetch.exec(content)) !== null) push(m[1], m.index);
  }

  if (filePath.endsWith('.py')) {
    // Names run to end of line, or across lines only inside parentheses.
    const pyNames = (paren?: string, inline?: string) =>
      (paren ?? inline ?? '').split(',').map((s) => s.trim().split(/\s+/)[0]).filter((n) => n && /^[\w*]+$/.test(n));
    const fromRel = /^from[ \t]+(\.+)([\w.]*)[ \t]+import[ \t]*(?:\(([^)]*)\)|([^\n#;]*))/gm;
    while ((m = fromRel.exec(content)) !== null) {
      const [, dots, mod] = m;
      if (mod) push(`${dots}${mod}`, m.index);
      else for (const n of pyNames(m[3], m[4]).filter((n) => n !== '*')) push(`${dots}${n}`, m.index);
    }
    // `from pkg import name` may name a submodule (pkg/name.py); the resolver falls back to pkg itself.
    const fromAbs = /^from[ \t]+([a-zA-Z_][\w.]*)[ \t]+import[ \t]*(?:\(([^)]*)\)|([^\n#;]*))/gm;
    while ((m = fromAbs.exec(content)) !== null) {
      const names = pyNames(m[2], m[3]);
      for (const n of names.length ? names : ['*']) push(`${m[1]}.${n}`, m.index);
    }
    const abs = /^import[ \t]+([a-zA-Z_][\w.]*(?:[ \t]*,[ \t]*[a-zA-Z_][\w.]*)*)/gm;
    while ((m = abs.exec(content)) !== null) for (const mod of m[1].split(',')) push(mod.trim(), m.index);
  }

  if (/\.(c|h|cc|cpp|hpp|hh|m|mm)$/.test(filePath)) {
    const inc = /^\s*#\s*include\s+[<"]([^>"]+)[>"]/gm;
    while ((m = inc.exec(content)) !== null) push(m[1], m.index);
  }

  if (filePath.endsWith('.rs')) {
    const rust = /^\s*(?:pub(?:\([\w:]+\))?\s+)?(?:use\s+((?:crate|super|self|kernel)(?:::\w+)*)(?:::(\*|\{[^;]*\}))?(?:\s+as\s+\w+)?\s*;|mod\s+(\w+)\s*;)/gm;
    while ((m = rust.exec(content)) !== null) {
      const [, path, tail, mod] = m;
      if (mod) push(mod, m.index);
      else if (tail?.startsWith('{')) for (const item of splitRustGroup(tail)) push(item !== 'self' ? `${path}::${item}` : path.includes('::') ? path : `${path}::*`, m.index);
      else push(tail === '*' || !path.includes('::') ? `${path}::*` : path, m.index);
    }
  }

  if (filePath.endsWith('.go')) {
    const single = /^import\s+(?:[\w.]+\s+)?"([^"]+)"/gm;
    while ((m = single.exec(content)) !== null) push(`go:${m[1]}`, m.index);
    const block = /^import\s*\(([\s\S]*?)\)/gm;
    while ((m = block.exec(content)) !== null) {
      for (const g of m[1].matchAll(/"([^"]+)"/g)) push(`go:${g[1]}`, m.index + (g.index ?? 0));
    }
  }

  return out;
}

/** Back-compat: plain list of import specifiers. */
export function extractImports(content: string, filePath = ''): string[] {
  return extractImportsDetailed(content, filePath).map((s) => s.spec);
}
