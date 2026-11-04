import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Cpu, Layers, ShieldAlert, Sparkles } from 'lucide-react';
import { TopHeader, WorkspaceTab } from './components/layout/TopHeader';
import { RepoAtlasLogo } from './components/ui/RepoAtlasLogo';
import { RepoSourceBar } from './components/layout/RepoSourceBar';
import { RepoHeroHeader } from './components/layout/RepoHeroHeader';
import { EmptyWorkspaceHero } from './components/layout/EmptyWorkspaceHero';
import { CommandPalette } from './components/layout/CommandPalette';
import { OnboardingTourModal } from './components/layout/OnboardingTourModal';
import { ScoreCard } from './components/ui/ScoreCard';
import { ArchitectureMap } from './features/graph/ArchitectureMap';
import { AuditTable } from './features/audit/AuditTable';
import { AiBlueprintPanel } from './features/exporter/AiBlueprintPanel';
import { CodeInspectorModal } from './features/inspector/CodeInspectorModal';
import { useUrlWorkspaceState } from './hooks/useUrlWorkspaceState';
import { analyzeRepository } from './lib/analyzer';
import { fetchGitHubRepoFiles } from './lib/githubFetcher';
import { readLocalDirectoryFiles } from './lib/localFolderReader';
import { isProjectPinned, loadFilesFromIdb, loadPinnedProjects, pinOrUpdateProject, unpinProject } from './lib/pinnedProjectsStore';
import { PRESET_REPOSITORIES } from './lib/presetRepos';
import { computeSnapshotDiff, getOrStoreBaseline, resetBaselineForRepo } from './lib/snapshotTracker';
import { PinnedProjectRecord, RepoAnalysisResult, RepoFileInput } from './types/atlas';

const TOUR_STORAGE_KEY = 'repo-atlas-tour-completed-v1';

export function App() {
  const [customResult, setCustomResult] = useState<RepoAnalysisResult | null>(null);
  const [presetOverrides, setPresetOverrides] = useState<Record<string, RepoFileInput[]>>({});
  const [pinnedProjects, setPinnedProjects] = useState<PinnedProjectRecord[]>(() => loadPinnedProjects());
  const [inspectedPath, setInspectedPath] = useState<string | null>(null);
  const [baselineVersion, setBaselineVersion] = useState(0);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isTourOpen, setIsTourOpen] = useState<boolean>(() => {
    try {
      return new URLSearchParams(window.location.search).get('tour') === '1';
    } catch {
      return false;
    }
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const workspaceRef = useRef<HTMLElement>(null);

  const { activePresetId, setActivePresetId, activeTab, setActiveTab, auditFilter, setAuditFilter } =
    useUrlWorkspaceState(
      customResult?.repoName ?? (PRESET_REPOSITORIES.find((p) => p.id === window.location.search)?.name ?? null),
      customResult?.findings.length ?? 0
    );

  const presetAnalysis = useMemo(() => {
    if (!activePresetId) return null;
    const preset = PRESET_REPOSITORIES.find((p) => p.id === activePresetId);
    if (!preset) return null;
    const files = presetOverrides[preset.id] ?? preset.files;
    const label = presetOverrides[preset.id] ? 'Live Refactored Sandbox' : 'Reference Sandbox';
    return analyzeRepository(preset.name, preset.description, label, files, { repoSlug: preset.slug, stackTags: preset.stackTags });
  }, [activePresetId, presetOverrides]);

  const analysis = customResult ?? presetAnalysis;
  const isCurrentPinned = analysis ? isProjectPinned(analysis.repoSlug, pinnedProjects) : false;
  const inspectedNode = useMemo(
    () => (analysis && inspectedPath ? analysis.nodes.find((n) => n.path === inspectedPath) ?? null : null),
    [analysis, inspectedPath]
  );

  const snapshotDiff = useMemo(() => {
    void baselineVersion;
    if (!analysis) return null;
    return computeSnapshotDiff(getOrStoreBaseline(analysis), analysis);
  }, [analysis, baselineVersion]);

  useEffect(() => {
    if (analysis && isProjectPinned(analysis.repoSlug, loadPinnedProjects())) {
      setPinnedProjects(pinOrUpdateProject(analysis, customResult ? undefined : activePresetId ?? undefined));
    }
  }, [analysis, activePresetId, customResult]);

  useEffect(() => {
    const repoParam = new URLSearchParams(window.location.search).get('repo');
    if (repoParam) void handleAnalyzeGitHub(repoParam);
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  function runScopedTransition(update: () => void) {
    const el = workspaceRef.current as (HTMLElement & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } }) | null;
    if (el && typeof el.startViewTransition === 'function') el.startViewTransition(update).ready.catch(() => {});
    else update();
  }

  function handleSelectTab(tab: WorkspaceTab) {
    runScopedTransition(() => {
      if (tab === 'audit') setAuditFilter('all');
      setActiveTab(tab);
    });
  }

  function handleResetToHome() {
    runScopedTransition(() => {
      setCustomResult(null);
      setActivePresetId(null);
      setErrorMsg(null);
    });
  }

  function handleCloseTour() {
    setIsTourOpen(false);
    try { localStorage.setItem(TOUR_STORAGE_KEY, 'true'); } catch { /* ignore */ }
  }

  function handleTogglePin() {
    if (!analysis) return;
    if (isCurrentPinned) setPinnedProjects(unpinProject(analysis.repoSlug));
    else setPinnedProjects(pinOrUpdateProject(analysis, customResult ? undefined : activePresetId ?? undefined));
  }

  async function handleSelectPinned(record: PinnedProjectRecord) {
    setErrorMsg(null);
    if (record.presetId && !record.files?.length) {
      setCustomResult(null);
      setActivePresetId(record.presetId);
      return;
    }
    const files = record.files?.length ? record.files : await loadFilesFromIdb(record.slug);
    if (files && files.length > 0) {
      setCustomResult(analyzeRepository(record.repoName, record.description, 'Pinned Browser Cache', files, { repoSlug: record.slug, stackTags: record.stackTags }));
    } else if (!record.slug.startsWith('local/')) {
      await handleAnalyzeGitHub(record.slug);
    }
  }

  function handleApplyFileChange(filePath: string, newContent: string) {
    if (!analysis) return;
    getOrStoreBaseline(analysis);
    const updatedFiles: RepoFileInput[] = analysis.nodes.map((n) => ({ path: n.path, content: n.path === filePath ? newContent : n.content }));
    if (customResult) {
      setCustomResult(analyzeRepository(customResult.repoName, customResult.description, 'Live Refactored Scan', updatedFiles, { repoSlug: customResult.repoSlug, stackTags: customResult.stackTags }));
    } else if (activePresetId) {
      setPresetOverrides((prev) => ({ ...prev, [activePresetId]: updatedFiles }));
    }
  }

  async function handleAnalyzeGitHub(repoInput: string, githubToken?: string) {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const { repoName, description, files, isPrivate } = await fetchGitHubRepoFiles(repoInput, githubToken);
      const sourceLabel = isPrivate ? 'Private GitHub Scan' : 'Live GitHub Scan';
      setCustomResult(analyzeRepository(repoName, description, sourceLabel, files, { repoSlug: repoName }));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to analyze repository.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleUploadFolder(fileList: FileList) {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const { repoName, description, files } = await readLocalDirectoryFiles(fileList);
      setCustomResult(analyzeRepository(repoName, description, 'Local Workspace', files, { repoSlug: `local/${repoName}` }));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to read local directory.');
    } finally {
      setIsLoading(false);
    }
  }

  const canRescanGitHub = Boolean(customResult && analysis && !analysis.repoSlug.startsWith('local/'));

  return (
    <div className="min-h-screen flex flex-col">
      <TopHeader activeTab={activeTab} findingsCount={analysis?.findings.length ?? 0} onSelectTab={handleSelectTab} onResetToHome={handleResetToHome} onOpenCommandPalette={() => setIsPaletteOpen(true)} onOpenTour={() => setIsTourOpen(true)} />
      {(analysis || pinnedProjects.length > 0) && (
        <RepoSourceBar activeRepoSlug={analysis?.repoSlug} pinnedProjects={pinnedProjects} onClearProject={handleResetToHome} onSelectPinned={handleSelectPinned} onUnpinProject={(slug) => setPinnedProjects(unpinProject(slug))} onAnalyzeGitHub={handleAnalyzeGitHub} onUploadFolder={handleUploadFolder} isLoading={isLoading} />
      )}

      <main ref={workspaceRef} className="flex-1 max-w-[1640px] w-full mx-auto px-4 sm:px-6 lg:px-10 py-6 space-y-6">
        {errorMsg && <div role="alert" className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-700 dark:text-red-300">{errorMsg}</div>}

        {!analysis ? (
          <EmptyWorkspaceHero pinnedProjects={pinnedProjects} isLoading={isLoading} onAnalyzeGitHub={handleAnalyzeGitHub} onUploadFolder={handleUploadFolder} onSelectPinned={handleSelectPinned} onUnpinProject={(slug) => setPinnedProjects(unpinProject(slug))} />
        ) : (
          <>
            <RepoHeroHeader analysis={analysis} activeTab={activeTab} diff={snapshotDiff} isPinned={isCurrentPinned} onTogglePin={handleTogglePin} onRescanLive={canRescanGitHub ? () => void handleAnalyzeGitHub(analysis.repoSlug) : undefined} onResetBaseline={() => { if (!customResult && activePresetId) setPresetOverrides((prev) => { const c = { ...prev }; delete c[activePresetId]; return c; }); resetBaselineForRepo(analysis); setBaselineVersion((v) => v + 1); }} onPrimaryAction={() => { if (analysis.findings.length > 0 && activeTab !== 'audit') { setAuditFilter('all'); setActiveTab('audit'); } else setActiveTab('blueprint'); }} />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
              <ScoreCard label="Architecture & Modularity" score={analysis.scores.architecture} delta={snapshotDiff?.architectureDelta} subtitle={`${analysis.scores.circularDepsCount} circular cycles · ${analysis.scores.godFilesCount} god files (>220 LOC)`} actionLabel="Map" isActive={activeTab === 'graph'} onClick={() => setActiveTab('graph')} icon={<Layers size={16} strokeWidth={1.7} aria-hidden="true" />} />
              <ScoreCard label="Security Posture" score={analysis.scores.security} delta={snapshotDiff?.securityDelta} subtitle={analysis.findings.filter((f) => f.category === 'security').length === 0 ? '0 vulnerabilities · 8 security rules verified' : `${analysis.findings.filter((f) => f.category === 'security').length} security ${analysis.findings.filter((f) => f.category === 'security').length === 1 ? 'advisory' : 'advisories'} flagged`} actionLabel="Audit" isActive={activeTab === 'audit' && auditFilter === 'security'} onClick={() => { setAuditFilter('security'); setActiveTab('audit'); }} icon={<ShieldAlert size={16} strokeWidth={1.7} aria-hidden="true" />} />
              <ScoreCard label="Performance & Bundle" score={analysis.scores.performance} delta={snapshotDiff?.performanceDelta} subtitle={analysis.findings.filter((f) => f.category === 'performance').length === 0 ? '0 bottlenecks · 6 perf rules verified' : `${analysis.findings.filter((f) => f.category === 'performance').length} runtime/bundle ${analysis.findings.filter((f) => f.category === 'performance').length === 1 ? 'issue' : 'issues'} flagged`} actionLabel="Audit" isActive={activeTab === 'audit' && auditFilter === 'performance'} onClick={() => { setAuditFilter('performance'); setActiveTab('audit'); }} icon={<Activity size={16} strokeWidth={1.7} aria-hidden="true" />} />
              <ScoreCard label="AI Context Footprint" score={analysis.scores.totalTokens} delta={snapshotDiff?.tokenDelta} suffix="tokens" isMetric subtitle={`${analysis.scores.totalFiles} modules · ${analysis.scores.totalLines.toLocaleString()} total LOC`} actionLabel="AGENTS.md" isActive={activeTab === 'blueprint'} onClick={() => setActiveTab('blueprint')} icon={<Cpu size={16} strokeWidth={1.7} aria-hidden="true" />} />
            </div>
            <section className={`spa-view ${activeTab === 'graph' ? '' : 'inactive'}`} aria-hidden={activeTab !== 'graph'} {...(activeTab !== 'graph' ? ({ inert: '' } as Record<string, string>) : {})}><ArchitectureMap nodes={analysis.nodes} edges={analysis.edges} findings={analysis.findings} onInspectCode={(n) => setInspectedPath(n.path)} /></section>
            <section className={`spa-view ${activeTab === 'audit' ? '' : 'inactive'}`} aria-hidden={activeTab !== 'audit'} {...(activeTab !== 'audit' ? ({ inert: '' } as Record<string, string>) : {})}><AuditTable findings={analysis.findings} initialFilter={auditFilter} onSelectFilePath={setInspectedPath} /></section>
            <section className={`spa-view ${activeTab === 'blueprint' ? '' : 'inactive'}`} aria-hidden={activeTab !== 'blueprint'} {...(activeTab !== 'blueprint' ? ({ inert: '' } as Record<string, string>) : {})}><AiBlueprintPanel repoName={analysis.repoName} agentsMdBlueprint={analysis.agentsMdBlueprint} masterFixPrompt={analysis.masterFixPrompt} /></section>
          </>
        )}
      </main>

      <footer className="px-4 sm:px-6 lg:px-10 py-4 mt-8 text-xs" style={{ borderTop: '1px solid var(--border-hairline)', color: 'var(--text-muted)' }}>
        <div className="max-w-[1640px] mx-auto flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-1.5"><RepoAtlasLogo size={16} /> RepoAtlas — Universal AST Dependency Mapper, Security/Perf Auditor &amp; AI Context Compiler</span>
          <span className="font-mono-code flex items-center gap-1.5"><Sparkles size={12} aria-hidden="true" /> Press ⌘K / Ctrl+K to jump to any module or audit rule</span>
        </div>
      </footer>

      <OnboardingTourModal isOpen={isTourOpen} onClose={handleCloseTour} onSelectPreset={(id) => { setCustomResult(null); setActivePresetId(id); }} onSelectTab={handleSelectTab} />
      <CommandPalette isOpen={isPaletteOpen} onClose={() => setIsPaletteOpen(false)} nodes={analysis?.nodes ?? []} findings={analysis?.findings ?? []} onSelectNode={(n) => setInspectedPath(n.path)} onJumpToTab={handleSelectTab} />
      <CodeInspectorModal node={inspectedNode} findings={analysis?.findings ?? []} onApplyFileChange={handleApplyFileChange} onClose={() => setInspectedPath(null)} />
    </div>
  );
}
