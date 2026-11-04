import { RepoFileInput } from '../types/atlas';
import { isAnalyzablePath, selectStratifiedPaths } from './pathSelection';
import { missingImportTargets } from './importClosure';

export async function readLocalDirectoryFiles(
  fileList: FileList
): Promise<{ repoName: string; description: string; files: RepoFileInput[] }> {
  const candidates: Array<{ file: File; path: string }> = [];
  let rootFolder = 'local-project';

  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];
    const rel = file.webkitRelativePath || file.name;
    if (rel.includes('/')) rootFolder = rel.split('/')[0];
    const normalized = rel.includes('/') ? rel.split('/').slice(1).join('/') : rel;
    if (isAnalyzablePath(normalized) && file.size < 180_000) {
      candidates.push({ file, path: normalized });
    }
  }

  const selected = selectStratifiedPaths(candidates, 45, rootFolder);
  if (selected.length === 0) {
    throw new Error('That folder has no source code ReadMyRepo can read (TypeScript, JavaScript, Python, Go, Rust, C/C++, Swift or Kotlin).');
  }

  const files = await Promise.all(selected.map(async ({ file, path }) => ({ path, content: await file.text() })));
  // Same as GitHub scans: add the most-imported files the sample missed.
  const byPath = new Map(candidates.map((c) => [c.path, c.file]));
  const extra = missingImportTargets(files, candidates.map((c) => c.path), 12);
  files.push(...(await Promise.all(extra.map(async (path) => ({ path, content: await byPath.get(path)!.text() })))));
  const readable = files.filter((f) => f.content.trim().length > 0 && !f.content.includes('\u0000'));

  const note = candidates.length > readable.length
    ? `Scanned ${readable.length} of ${candidates.length.toLocaleString()} source files, picking the most connected ones.`
    : `Scanned all ${readable.length} source files.`;
  return {
    repoName: rootFolder,
    description: `Folder on your computer. Nothing was uploaded. — ${note}`,
    files: readable,
  };
}
