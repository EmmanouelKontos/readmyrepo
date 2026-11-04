import { useEffect, useMemo, useState } from 'react';
import { WorkspaceTab } from '../components/layout/TopHeader';
import { PRESET_REPOSITORIES } from '../lib/presetRepos';
import { AuditCategory } from '../types/atlas';

function readInitialUrlState(): {
  preset: string | null;
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
  return { preset: validPreset, tab: validTab, filter: validFilter };
}

export function useUrlWorkspaceState(repoName: string | null, findingsCount: number) {
  const initial = useMemo(() => readInitialUrlState(), []);
  const [activePresetId, setActivePresetId] = useState<string | null>(initial.preset);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(initial.tab);
  const [auditFilter, setAuditFilter] = useState<'all' | AuditCategory>(initial.filter);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (activePresetId) {
      params.set('preset', activePresetId);
      params.set('tab', activeTab);
    } else {
      params.delete('preset');
      if (!params.has('repo')) params.delete('tab');
    }
    if (activeTab === 'audit' && auditFilter !== 'all') params.set('filter', auditFilter);
    else params.delete('filter');

    const qs = params.toString();
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);

    if (!repoName) {
      document.title = 'Architecture & Security Intelligence | RepoAtlas';
      return;
    }

    const tabTitle =
      activeTab === 'graph'
        ? 'Architecture Map'
        : activeTab === 'audit'
        ? `Security & Perf Audit (${findingsCount})`
        : 'AGENTS.md & AI Fix Blueprint';
    document.title = `${tabTitle} — ${repoName} | RepoAtlas`;
  }, [activePresetId, activeTab, auditFilter, repoName, findingsCount]);

  return {
    activePresetId,
    setActivePresetId,
    activeTab,
    setActiveTab,
    auditFilter,
    setAuditFilter,
  };
}
