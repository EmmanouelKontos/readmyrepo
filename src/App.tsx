import { useEffect, useMemo, useRef, useState } from 'react';
import { TopHeader, WorkspaceTab } from './components/layout/TopHeader';
import { RepoSourceBar } from './components/layout/RepoSourceBar';
import { RepoHeroHeader } from './components/layout/RepoHeroHeader';
import { ScoreOverview } from './components/layout/ScoreOverview';
import { AppFooter, ErrorBanner } from './components/layout/AppChrome';
import { EmptyWorkspaceHero } from './components/layout/EmptyWorkspaceHero';
import { CommandPalette } from './components/layout/CommandPalette';
import { OnboardingTourModal } from './components/layout/OnboardingTourModal';
import { ArchitectureMap } from './features/graph/ArchitectureMap';
import { AuditTable } from './features/audit/AuditTable';
import { AiBlueprintPanel } from './features/exporter/AiBlueprintPanel';
import { CodeInspectorModal } from './features/inspector/CodeInspectorModal';
import { useDocumentTitle, useUrlWorkspaceState } from './hooks/useUrlWorkspaceState';
import { analyzeRepository } from './lib/analyzer';
import { fetchGitHubRepoFiles } from './lib/githubFetcher';
import { readLocalDirectoryFiles } from './lib/localFolderReader';
import { isProjectPinned, loadFilesFromIdb, loadPinnedProjects, pinOrUpdateProject, unpinProject } from './lib/pinnedProjectsStore';
import { PRESET_REPOSITORIES } from './lib/presetRepos';
import { computeSnapshotDiff, getOrStoreBaseline, resetBaselineForRepo } from './lib/snapshotTracker';
import { AuditCategory, PinnedProjectRecord, RepoAnalysisResult, RepoFileInput } from './types/atlas';

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

  const [sharedRepo, setSharedRepo] = useState<string | null>(null);
  const { initialRepo, activePresetId, setActivePresetId, activeTab, setActiveTab, auditFilter, setAuditFilter } =
    useUrlWorkspaceState(customResult ? sharedRepo : null);

  const presetAnalysis = useMemo(() => {
    if (!activePresetId) return null;
    const preset = PRESET_REPOSITORIES.find((p) => p.id === activePresetId);
    if (!preset) return null;
    const files = presetOverrides[preset.id] ?? preset.files;
    const label = presetOverrides[preset.id] ? 'Example · with your edits' : 'Example project';
    return analyzeRepository(preset.name, preset.description, label, files, { repoSlug: preset.slug, stackTags: preset.stackTags });
  }, [activePresetId, presetOverrides]);

  const analysis = customResult ?? presetAnalysis;
  useDocumentTitle(analysis?.repoName ?? null, activeTab, analysis?.findings.length ?? 0);
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
    // Reopen a public repository shared through `?repo=` (or kept across a refresh).
    if (initialRepo) void handleAnalyzeGitHub(initialRepo);
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

  function handleSelectTab(tab: WorkspaceTab, filter?: AuditCategory) {
    runScopedTransition(() => {
      if (tab === 'audit') setAuditFilter(filter ?? 'all');
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
      setCustomResult(analyzeRepository(record.repoName, record.description, 'Saved in this browser', files, { repoSlug: record.slug, stackTags: record.stackTags }));
      setSharedRepo(record.slug.startsWith('local/') ? null : record.slug);
    } else if (!record.slug.startsWith('local/')) {
      await handleAnalyzeGitHub(record.slug);
    }
  }

  function handleApplyFileChange(filePath: string, newContent: string) {
    if (!analysis) return;
    getOrStoreBaseline(analysis);
    const updatedFiles: RepoFileInput[] = analysis.nodes.map((n) => ({ path: n.path, content: n.path === filePath ? newContent : n.content }));
    if (customResult) {
      setCustomResult(analyzeRepository(customResult.repoName, customResult.description, 'With your edits', updatedFiles, { repoSlug: customResult.repoSlug, stackTags: customResult.stackTags }));
    } else if (activePresetId) {
      setPresetOverrides((prev) => ({ ...prev, [activePresetId]: updatedFiles }));
    }
  }

  async function handleAnalyzeGitHub(repoInput: string, githubToken?: string) {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const { repoName, description, files, isPrivate } = await fetchGitHubRepoFiles(repoInput, githubToken);
      const sourceLabel = isPrivate ? 'Private repo · GitHub' : 'Scanned from GitHub';
      setCustomResult(analyzeRepository(repoName, description, sourceLabel, files, { repoSlug: repoName }));
      setSharedRepo(isPrivate || githubToken ? null : repoInput.trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\/$/, ''));
      setActivePresetId(null);
    } catch (err) {
      // fetch() rejects with a bare TypeError ("Failed to fetch") when the network is down or blocked.
      setErrorMsg(err instanceof TypeError ? 'Couldn’t reach GitHub. Check your internet connection and try again.' : err instanceof Error ? err.message : 'Something went wrong while reading the repository. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleUploadFolder(fileList: FileList) {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const { repoName, description, files } = await readLocalDirectoryFiles(fileList);
      setCustomResult(analyzeRepository(repoName, description, 'Local folder', files, { repoSlug: `local/${repoName}` }));
      setSharedRepo(null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Couldn’t read that folder. Please pick it again.');
    } finally {
      setIsLoading(false);
    }
  }

  const canRescanGitHub = Boolean(customResult && analysis && !analysis.repoSlug.startsWith('local/'));
  const viewProps = (tab: WorkspaceTab) => ({
    className: `spa-view ${activeTab === tab ? 'atlas-fade-in' : 'inactive'}`,
    'aria-hidden': activeTab !== tab,
    inert: activeTab !== tab,
  });

  function handleResetBaseline() {
    if (!analysis) return;
    if (!customResult && activePresetId) setPresetOverrides((prev) => { const c = { ...prev }; delete c[activePresetId]; return c; });
    resetBaselineForRepo(analysis);
    setBaselineVersion((v) => v + 1);
  }

  return (
    <div className="min-h-screen flex flex-col">
      <TopHeader activeTab={activeTab} findingsCount={analysis?.findings.length ?? 0} repoSlug={analysis?.repoSlug} onSelectTab={handleSelectTab} onResetToHome={handleResetToHome} onOpenCommandPalette={() => setIsPaletteOpen(true)} onOpenTour={() => setIsTourOpen(true)} />
      {isLoading && <div className="atlas-loading-bar" role="progressbar" aria-label="Analyzing repository" />}

      <main ref={workspaceRef} className="flex-1 max-w-[1480px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {errorMsg && <ErrorBanner message={errorMsg} onDismiss={() => setErrorMsg(null)} />}

        {!analysis ? (
          <EmptyWorkspaceHero pinnedProjects={pinnedProjects} isLoading={isLoading} onAnalyzeGitHub={handleAnalyzeGitHub} onUploadFolder={handleUploadFolder} onSelectPinned={handleSelectPinned} onUnpinProject={(slug) => setPinnedProjects(unpinProject(slug))} />
        ) : (
          <>
            {pinnedProjects.length > 0 && <RepoSourceBar activeRepoSlug={analysis.repoSlug} pinnedProjects={pinnedProjects} onSelectPinned={handleSelectPinned} onUnpinProject={(slug) => setPinnedProjects(unpinProject(slug))} onAnalyzeGitHub={handleAnalyzeGitHub} onUploadFolder={handleUploadFolder} isLoading={isLoading} />}
            <RepoHeroHeader analysis={analysis} activeTab={activeTab} diff={snapshotDiff} isPinned={isCurrentPinned} onTogglePin={handleTogglePin} onRescanLive={canRescanGitHub ? () => void handleAnalyzeGitHub(analysis.repoSlug) : undefined} onResetBaseline={handleResetBaseline} onPrimaryAction={() => handleSelectTab(analysis.findings.length > 0 && activeTab !== 'audit' ? 'audit' : 'blueprint')} />
            <ScoreOverview analysis={analysis} diff={snapshotDiff} activeTab={activeTab} auditFilter={auditFilter} onOpenTab={handleSelectTab} />
            <section {...viewProps('graph')}><ArchitectureMap nodes={analysis.nodes} edges={analysis.edges} findings={analysis.findings} onInspectCode={(n) => setInspectedPath(n.path)} /></section>
            <section {...viewProps('audit')}><AuditTable findings={analysis.findings} initialFilter={auditFilter} onSelectFilePath={setInspectedPath} /></section>
            <section {...viewProps('blueprint')}><AiBlueprintPanel repoName={analysis.repoName} agentsMdBlueprint={analysis.agentsMdBlueprint} masterFixPrompt={analysis.masterFixPrompt} /></section>
          </>
        )}
      </main>

      <AppFooter />

      <OnboardingTourModal isOpen={isTourOpen} onClose={handleCloseTour} onSelectPreset={(id) => { setCustomResult(null); setActivePresetId(id); }} onSelectTab={handleSelectTab} />
      <CommandPalette isOpen={isPaletteOpen} onClose={() => setIsPaletteOpen(false)} nodes={analysis?.nodes ?? []} findings={analysis?.findings ?? []} onSelectNode={(n) => setInspectedPath(n.path)} onJumpToTab={handleSelectTab} />
      <CodeInspectorModal node={inspectedNode} findings={analysis?.findings ?? []} onApplyFileChange={handleApplyFileChange} onClose={() => setInspectedPath(null)} />
    </div>
  );
}
