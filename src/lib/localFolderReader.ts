import { RepoFileInput } from '../types/atlas';
import { isAnalyzablePath, selectStratifiedPaths } from './githubFetcher';

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

  const selected = selectStratifiedPaths(candidates, 45);
  if (selected.length === 0) {
    throw new Error('No analyzable source files found in the selected folder.');
  }

  const files = await Promise.all(
    selected.map(async ({ file, path }) => ({ path, content: await file.text() }))
  );

  return {
    repoName: rootFolder,
    description: `Local workspace folder (${files.length} source files analyzed 100% locally in-browser).`,
    files,
  };
}
