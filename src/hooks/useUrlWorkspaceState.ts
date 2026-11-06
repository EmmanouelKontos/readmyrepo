import { useEffect, useMemo, useRef, useState } from 'react';
import { WorkspaceTab } from '../components/layout/TopHeader';
import { PRESET_REPOSITORIES } from '../fixtures/presetRepos';
import { AuditCategory } from '../types/atlas';

function readInitialUrlState(): {
  preset: string | null;
  repo: string | null;
  tab: WorkspaceTab;
  filter: 'all' | AuditCategory;
} {
  const params = new URLSearchParams(window.location.search);
  const presetParam = params.get('preset');
  const validPreset =
    PRESET_REPOSITORIES.find((p) => p.id === presetParam)?.id ?? null;
  const tabParam = params.get('tab');
  const validTab: WorkspaceTab =
    tabParam === 'audit' || tabParam === 'blueprint' ? tabParam : 'graph';
  const filterParam = params.get('filter');
  const validFilter: 'all' | AuditCategory =
    filterParam === 'security' || filterParam === 'performance' || filterParam === 'architecture'
      ? filterParam
      : 'all';
  const repoParam = params.get('repo')?.trim() ?? '';
  // Only plain owner/repo[/path] slugs are restored; anything else is ignored.
  const validRepo = !validPreset && /^[\w.-]+\/[\w.-]+(\/[\w./-]+)?$/.test(repoParam) && !repoParam.includes('..') ? repoParam : null;
  return { preset: validPreset, repo: validRepo, tab: validTab, filter: validFilter };
}

/**
 * Keeps the current view in the address bar: an example preset or a public GitHub repo (`?repo=`),
 * plus the open tab and findings filter, so a refresh or a shared link reopens the same view.
 */
export function useUrlWorkspaceState(sharedRepo: string | null) {
  const initial = useMemo(() => readInitialUrlState(), []);
  const [activePresetId, setActivePresetId] = useState<string | null>(initial.preset);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(initial.tab);
  const [auditFilter, setAuditFilter] = useState<'all' | AuditCategory>(initial.filter);

  // Keep an incoming `?repo=` in place while that first scan is still loading.
  const keepInitialRepo = useRef(Boolean(initial.repo));
  useEffect(() => {
    if (activePresetId || sharedRepo) keepInitialRepo.current = false;
    const repo = sharedRepo ?? (keepInitialRepo.current ? initial.repo : null);
    const params = new URLSearchParams(window.location.search);
    params.delete('preset');
    params.delete('repo');
    params.delete('tab');
    params.delete('filter');
    if (activePresetId) params.set('preset', activePresetId);
    else if (repo) params.set('repo', repo);
    if (activePresetId || repo) {
      params.set('tab', activeTab);
      if (activeTab === 'audit' && auditFilter !== 'all') params.set('filter', auditFilter);
    }
    const qs = params.toString().replace(/%2F/g, '/');
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
  }, [activePresetId, sharedRepo, activeTab, auditFilter, initial.repo]);

  return {
    initialRepo: initial.repo,
    activePresetId,
    setActivePresetId,
    activeTab,
    setActiveTab,
    auditFilter,
    setAuditFilter,
  };
}

const TAB_TITLE: Record<WorkspaceTab, string> = { graph: 'Map', audit: 'Findings', blueprint: 'AI context' };

/** Browser tab title for the current view. */
export function useDocumentTitle(repoName: string | null, activeTab: WorkspaceTab, findingsCount: number) {
  useEffect(() => {
    if (!repoName) {
      document.title = 'ReadMyRepo · Understand any GitHub repo in seconds';
      return;
    }
    const tab = activeTab === 'audit' ? `${TAB_TITLE.audit} (${findingsCount})` : TAB_TITLE[activeTab];
    document.title = `${tab} · ${repoName} | ReadMyRepo`;
  }, [repoName, activeTab, findingsCount]);
}
