import { ArchitecturalLayer, RepoFileInput } from '../types/atlas';

const EXTS = ['.ts', '.tsx', '.js', '.jsx', '.py', '.rs', '.c', '.h', '.cpp', '.hpp', '.go', '.swift', '.kt', '.dart'];

export function classifyLayer(path: string): ArchitecturalLayer {
  const lower = path.toLowerCase();
  if (
    lower.endsWith('package.json') ||
    lower.endsWith('tsconfig.json') ||
    lower.endsWith('manifest.json') ||
    lower.endsWith('tauri.conf.json') ||
    lower.endsWith('cargo.toml') ||
    lower.endsWith('kconfig') ||
    lower.includes('config')
  ) {
    return 'config';
  }
  if (
    lower.includes('/types') ||
    lower.includes('schema') ||
    lower.endsWith('.sql') ||
    lower.includes('models') ||
    lower.startsWith('include/') ||
    lower.includes('/include/') ||
    lower.endsWith('.h') ||
    lower.endsWith('.hpp')
  ) {
    return 'data';
  }
  if (lower.includes('/ui/') || lower.includes('/primitives/') || lower.includes('/views/') || lower.includes('/widgets/')) {
    return 'ui';
  }
  if (
    lower.includes('/features/') ||
    lower.includes('/components/') ||
    lower.includes('/hooks/') ||
    lower.includes('/hud/') ||
    lower.includes('/sched/') ||
    lower.includes('/locking/') ||
    lower.includes('/bpf/')
  ) {
    return 'feature';
  }
  if (
    lower.includes('/lib/') ||
    lower.includes('/services/') ||
    lower.includes('/service/') ||
    lower.includes('/api/') ||
    lower.includes('client') ||
    lower.includes('bridge') ||
    lower.includes('worker') ||
    /^(src-tauri|kernel|mm|drivers|fs|net|rust)\//.test(lower)
  ) {
    return 'service';
  }
  return 'entry';
}

export function extractImports(content: string, filePath = ''): string[] {
  const specs: string[] = [];
  let match: RegExpExecArray | null;

  if (filePath.endsWith('manifest.json') || filePath.endsWith('tauri.conf.json')) {
    const jsonPathRegex = /"(?:service_worker|default_popup|default_path|options_page)"\s*:\s*"([^"]+)"/g;
    while ((match = jsonPathRegex.exec(content)) !== null) {
      if (match[1]) specs.push(match[1]);
    }
    if (filePath.endsWith('tauri.conf.json')) specs.push('tauri::config_bridge');
  }

  const esRegex =
    /(?:import|export)\s+(?:[^'"]*from\s+)?['"]([^'"]+)['"]|(?:import|require)\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = esRegex.exec(content)) !== null) {
    const spec = match[1] || match[2];
    if (spec) specs.push(spec);
  }

  const tauriInvokeRegex = /\binvoke(?:<[^>]+>)?\(\s*['"]([a-zA-Z0-9_]+)['"]/g;
  while ((match = tauriInvokeRegex.exec(content)) !== null) {
    if (match[1]) specs.push(`tauri::${match[1]}`);
  }

  const apiFetchRegex = /\bfetch\(\s*['"](\/api\/[a-zA-Z0-9/_-]+)['"]/g;
  while ((match = apiFetchRegex.exec(content)) !== null) {
    if (match[1]) specs.push(match[1]);
  }

  const pyRegex = /^(?:from\s+([.\w]+)\s+import|import\s+([.\w]+))/gm;
  while ((match = pyRegex.exec(content)) !== null) {
    const spec = match[1] || match[2];
    if (spec) specs.push(spec);
  }

  const cIncludeRegex = /^\s*#\s*include\s+[<"]([^>"]+)[>"]/gm;
  while ((match = cIncludeRegex.exec(content)) !== null) {
    if (match[1]) specs.push(match[1]);
  }

  const rustRegex = /^\s*(?:pub\s+)?(?:use\s+((?:crate|super|self|kernel)(?:::\w+)+)|mod\s+(\w+)\s*;)/gm;
  while ((match = rustRegex.exec(content)) !== null) {
    const spec = match[1] || match[2];
    if (spec) specs.push(spec);
  }

  return specs;
}

export function resolveImportToFile(
  fromPath: string,
  spec: string,
  allPaths: string[],
  allFiles?: RepoFileInput[]
): string | null {
  if (spec.startsWith('tauri::')) {
    const cmd = spec.slice('tauri::'.length);
    if (cmd === 'config_bridge') {
      return allPaths.find((p) => p.endsWith('.rs') && p.startsWith('src-tauri/')) ?? null;
    }
    if (allFiles) {
      const rustTarget = allFiles.find((f) => f.path.endsWith('.rs') && new RegExp(`\\bfn\\s+${cmd}\\b`).test(f.content));
      if (rustTarget) return rustTarget.path;
    }
    return allPaths.find((p) => p.endsWith('.rs')) ?? null;
  }

  if (spec.startsWith('/api/')) {
    const routeSegment = spec.replace(/^\/api\//, '');
    const foundApi = allPaths.find(
      (p) => p.endsWith(`/api/${routeSegment}/route.ts`) || p.endsWith(`/api/${routeSegment}.ts`) || p === `api/${routeSegment}.ts`
    );
    if (foundApi) return foundApi;
  }

  const cleanSpec = spec.replace(/^[@~]\//, 'src/');
  const dirParts = fromPath.split('/').slice(0, -1);
  const currentDir = dirParts.join('/');

  if (cleanSpec.includes('::')) {
    const rustParts = cleanSpec.replace(/^(crate|self)::/, '').replace(/^kernel::/, 'rust/kernel/').split('::');
    const modCandidate = rustParts.join('/');
    const prevCandidate = rustParts.slice(0, -1).join('/');
    const foundRust = allPaths.find(
      (p) =>
        p.endsWith(`${modCandidate}.rs`) ||
        p.endsWith(`${modCandidate}/mod.rs`) ||
        (prevCandidate.length > 0 && p.endsWith(`${prevCandidate}.rs`))
    );
    if (foundRust) return foundRust;
  }

  if (!cleanSpec.startsWith('.') && !cleanSpec.startsWith('src/')) {
    const stemSpec = cleanSpec.replace(/\.(?:m?js|jsx)$/, '');
    const relativeHeader = currentDir ? `${currentDir}/${cleanSpec}` : cleanSpec;
    const suffixCandidates = [cleanSpec, stemSpec, ...EXTS.map((e) => `${stemSpec}${e}`), `${stemSpec}/index.ts`, `${stemSpec}/index.js`, `${stemSpec}/mod.rs`];
    const directOrInclude = allPaths.find(
      (p) =>
        p === cleanSpec ||
        p === relativeHeader ||
        p === `include/${cleanSpec}` ||
        p === `${currentDir}/${cleanSpec}.rs` ||
        suffixCandidates.some((s) => p.endsWith(`/${s}`))
    );
    if (directOrInclude) return directOrInclude;

    const pyCandidate = cleanSpec.replace(/\./g, '/');
    return allPaths.find((p) => p.endsWith(`${pyCandidate}.py`) || p === `${pyCandidate}.py`) ?? null;
  }

  let targetBase = cleanSpec;
  if (cleanSpec.startsWith('.')) {
    const baseParts = [...dirParts];
    for (const part of cleanSpec.split('/')) {
      if (part === '.') continue;
      if (part === '..') baseParts.pop();
      else baseParts.push(part);
    }
    targetBase = baseParts.join('/');
  }

  const stemBase = targetBase.replace(/\.(?:m?js|jsx)$/, '');
  const candidates = [
    targetBase,
    stemBase,
    ...EXTS.map((ext) => `${stemBase}${ext}`),
    `${stemBase}/index.ts`,
    `${stemBase}/index.tsx`,
    `${stemBase}/index.js`,
    `${stemBase}/mod.rs`,
  ];
  const exact = allPaths.find((p) => candidates.includes(p));
  if (exact) return exact;

  if (cleanSpec.startsWith('src/')) {
    const subPath = cleanSpec.slice(4);
    return allPaths.find((p) => EXTS.some((ext) => p.endsWith(`/${subPath}${ext}`))) ?? null;
  }
  return null;
}
