import { PinnedProjectRecord, RepoAnalysisResult, RepoFileInput } from '../types/atlas';

// Storage keys keep the original 'repo-atlas' prefix so existing pinned projects and baselines survive the rename.
const STORAGE_KEY = 'repo-atlas-pinned-v1';
const IDB_NAME = 'repo-atlas-idb-v1';
const IDB_STORE = 'pinned_files';
const MAX_PINNED_PROJECTS = 12;

const memoryStore = new Map<string, PinnedProjectRecord>();

function openFilesDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function saveFilesToIdb(slug: string, files: RepoFileInput[]): Promise<void> {
  const db = await openFilesDb();
  if (!db) return;
  try {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(files, slug);
  } catch {
    // Ignore IDB quota/transaction errors
  }
}

async function deleteFilesFromIdb(slug: string): Promise<void> {
  const db = await openFilesDb();
  if (!db) return;
  try {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(slug);
  } catch {
    // Ignore IDB errors
  }
}

export async function loadFilesFromIdb(slug: string): Promise<RepoFileInput[] | null> {
  const mem = memoryStore.get(slug);
  if (mem && mem.files.length > 0) return mem.files;

  const db = await openFilesDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(slug);
      req.onsuccess = () => resolve(Array.isArray(req.result) ? (req.result as RepoFileInput[]) : null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function readLocalRecords(): PinnedProjectRecord[] {
  try {
    if (typeof localStorage === 'undefined') {
      return Array.from(memoryStore.values());
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return Array.from(memoryStore.values());
    const parsed = JSON.parse(raw) as PinnedProjectRecord[];
    if (!Array.isArray(parsed)) return [];
    for (const item of parsed) {
      const existing = memoryStore.get(item.slug);
      memoryStore.set(item.slug, {
        ...item,
        files: item.files?.length ? item.files : existing?.files ?? [],
      });
    }
    return Array.from(memoryStore.values());
  } catch {
    return Array.from(memoryStore.values());
  }
}

function writeLocalRecords(records: PinnedProjectRecord[]): void {
  try {
    if (typeof localStorage === 'undefined') return;
    // Try saving with full files first; if quota exceeded, save metadata-only to localStorage (files live in IDB/memory)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch {
      const compact = records.map((r) => ({ ...r, files: [] }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(compact));
    }
  } catch {
    // Ignore storage errors
  }
}

export function loadPinnedProjects(): PinnedProjectRecord[] {
  return readLocalRecords();
}

export function isProjectPinned(slug: string, list: PinnedProjectRecord[]): boolean {
  return list.some((item) => item.slug === slug);
}

export function pinOrUpdateProject(
  analysis: RepoAnalysisResult,
  presetId?: string
): PinnedProjectRecord[] {
  const current = readLocalRecords();
  const existing = current.find((item) => item.slug === analysis.repoSlug);
  const files: RepoFileInput[] = analysis.nodes.map((n) => ({
    path: n.path,
    content: n.content,
  }));

  const record: PinnedProjectRecord = {
    slug: analysis.repoSlug,
    repoName: analysis.repoName,
    description: analysis.description,
    sourceLabel: analysis.sourceLabel,
    stackTags: analysis.stackTags,
    presetId: presetId ?? existing?.presetId,
    scores: { ...analysis.scores },
    baselineScores: existing ? { ...existing.baselineScores } : { ...analysis.scores },
    findingsCount: analysis.findings.length,
    pinnedAt: existing?.pinnedAt ?? analysis.analyzedAt,
    lastScannedAt: analysis.analyzedAt,
    files,
  };

  memoryStore.set(record.slug, record);
  void saveFilesToIdb(record.slug, files);

  const filtered = current.filter((item) => item.slug !== record.slug);
  // LRU cap at MAX_PINNED_PROJECTS
  const updated = [record, ...filtered].slice(0, MAX_PINNED_PROJECTS);
  writeLocalRecords(updated);
  return updated;
}

export function unpinProject(slug: string): PinnedProjectRecord[] {
  memoryStore.delete(slug);
  void deleteFilesFromIdb(slug);
  const updated = readLocalRecords().filter((item) => item.slug !== slug);
  writeLocalRecords(updated);
  return updated;
}

export function clearAllPinnedProjects(): void {
  memoryStore.clear();
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Ignore
  }
}
