import { RepoFileInput } from '../types/atlas';

/** Infers human-readable stack tags from file paths and a light content sniff. */
export function inferStackTags(files: RepoFileInput[]): string[] {
  const has = (re: RegExp) => files.some((f) => re.test(f.path));
  const mentions = (re: RegExp) => files.some((f) => re.test(f.content));
  const tags: Array<string | null> = [
    has(/(^|\/)app\/(.*\/)?(page|layout|route)\.(t|j)sx?$/) || mentions(/from ['"]next\//) ? 'Next.js' : null,
    has(/\.(tsx|jsx)$/) && mentions(/from ['"]react['"]/) ? 'React' : null,
    has(/\.vue$/) ? 'Vue' : null,
    has(/\.svelte$/) ? 'Svelte' : null,
    has(/\.tsx?$/) ? 'TypeScript' : has(/\.(m|c)?jsx?$/) ? 'JavaScript' : null,
    has(/\.py$/) ? 'Python' : null,
    has(/\.rs$/) ? 'Rust' : null,
    has(/\.go$/) ? 'Go' : null,
    has(/\.(c|h)$/) ? 'C' : null,
    has(/\.(cpp|hpp|cc)$/) ? 'C++' : null,
    has(/\.(kt|swift|dart)$/) ? 'Mobile' : null,
    files.some((f) => f.path.endsWith('manifest.json') && /"manifest_version"\s*:\s*3/.test(f.content)) ? 'Chrome extension (MV3)' : null,
    has(/tauri\.conf\.json$/) || mentions(/@tauri-apps\/api|tauri::command/) ? 'Tauri' : null,
    mentions(/from ['"]electron['"]|require\(['"]electron['"]\)/) ? 'Electron' : null,
    mentions(/@supabase\/supabase-js|createClient\([^)]*supabase/i) || has(/supabase/) ? 'Supabase' : null,
  ];
  const out = tags.filter((t): t is string => Boolean(t));
  return out.length ? out : ['Source code'];
}
