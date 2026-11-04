/**
 * Language-aware "large file" limits, measured in code lines (blank and comment-only
 * lines excluded, so license headers and doc blocks don't count against a module).
 */
const COMPONENT = /\.(tsx|jsx|vue|svelte)$/;
const SYSTEMS = /\.(c|h|cc|cpp|hpp|hh|rs|go|m|mm|zig)$/;

export function largeFileLimit(path: string): number {
  if (COMPONENT.test(path)) return 220;
  if (SYSTEMS.test(path)) return 800;
  return 400;
}

export function largeFileLabel(path: string): string {
  if (COMPONENT.test(path)) return 'UI components';
  if (SYSTEMS.test(path)) return 'C, C++, Rust and Go files';
  return 'logic modules';
}

export function countCodeLines(content: string, path: string): number {
  const hashComments = /\.(py|rb|sh|toml|ya?ml)$/.test(path);
  let inBlock = false;
  let inDocstring = false;
  let count = 0;
  for (const raw of content.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (inBlock) {
      if (line.includes('*/')) inBlock = false;
      continue;
    }
    if (inDocstring) {
      if (line.includes('"""') || line.includes("'''")) inDocstring = false;
      continue;
    }
    if (line.startsWith('/*') || line.startsWith('/**')) {
      if (!line.includes('*/')) inBlock = true;
      continue;
    }
    if (hashComments && (line.startsWith('"""') || line.startsWith("'''"))) {
      const quote = line.slice(0, 3);
      if (line.length < 6 || !line.slice(3).includes(quote)) inDocstring = true;
      continue;
    }
    if (line.startsWith('//') || line.startsWith('*') || (hashComments && line.startsWith('#'))) continue;
    count++;
  }
  return count;
}
