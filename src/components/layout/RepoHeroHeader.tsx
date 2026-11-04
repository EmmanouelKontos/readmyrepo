import { ArrowRight, Pin, PinOff, RefreshCw, RotateCcw } from 'lucide-react';
import { RepoAnalysisResult, RepoSnapshotDiff } from '../../types/atlas';
import { formatDelta, scoreLabel, scoreTone } from '../ui/scoreTone';
import { WorkspaceTab } from './TopHeader';

interface RepoHeroHeaderProps {
  analysis: RepoAnalysisResult;
  activeTab: WorkspaceTab;
  diff?: RepoSnapshotDiff | null;
  isPinned?: boolean;
  onTogglePin?: () => void;
  onRescanLive?: () => void;
  onResetBaseline?: () => void;
  onPrimaryAction: () => void;
}

export function RepoHeroHeader({
  analysis,
  activeTab,
  diff,
  isPinned = false,
  onTogglePin,
  onRescanLive,
  onResetBaseline,
  onPrimaryAction,
}: RepoHeroHeaderProps) {
  const overall = analysis.scores.overall;
  const tone = scoreTone(overall);
  const meta = [...analysis.stackTags, analysis.sourceLabel, analysis.analyzedAt].filter(Boolean);
  const hasChanges = Boolean(diff && (diff.overallDelta !== 0 || diff.resolvedFindingsCount > 0 || diff.newFindingsCount > 0));
  const primaryLabel =
    analysis.findings.length > 0 && activeTab !== 'audit'
      ? `Review ${analysis.findings.length} ${analysis.findings.length === 1 ? 'finding' : 'findings'}`
      : 'Open AI context';

  return (
    <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 atlas-fade-in">
      <div className="space-y-2 min-w-0">
        <p className="text-[0.8125rem] text-muted truncate">
          <span className="font-mono-code text-secondary">{analysis.repoSlug}</span>
          {meta.map((m) => (
            <span key={m}> · {m}</span>
          ))}
        </p>
        <h1 id="main-heading" tabIndex={-1} className="heading-hero">
          {analysis.repoName}
        </h1>
        {analysis.description && (
          <p className="text-secondary measure-readable line-clamp-2">{analysis.description}</p>
        )}
      </div>

      <div className="flex flex-col items-start lg:items-end gap-3 shrink-0">
        <div className="flex items-end gap-4">
          <div className="text-left lg:text-right" title="Weighted: 38% security · 32% performance · 30% architecture">
            <div className="flex items-baseline gap-1.5 lg:justify-end">
              <span className="font-mono-code text-[2.5rem] leading-none font-medium tracking-tight tabular-nums">{overall}</span>
              <span className="font-mono-code text-muted text-[0.8125rem]">/100</span>
            </div>
            <div className="flex items-center gap-1.5 mt-1.5 text-[0.8125rem] lg:justify-end">
              <span className={`tone-dot ${tone}`} aria-hidden="true" />
              <span className="text-secondary">Overall · {scoreLabel(overall)}</span>
              {diff && diff.overallDelta !== 0 && (
                <span className={`chip tone-chip font-mono-code ${diff.overallDelta > 0 ? 'tone-success' : 'tone-danger'}`} title={`Since ${diff.baselineTimestamp}`}>
                  {formatDelta(diff.overallDelta)}
                </span>
              )}
            </div>
          </div>
        </div>

        {hasChanges && diff && (
          <p className="text-[0.75rem] text-muted flex flex-wrap items-center gap-x-2 gap-y-1 lg:justify-end">
            {diff.resolvedFindingsCount > 0 && <span className="tone-success tone-text">{diff.resolvedFindingsCount} resolved</span>}
            {diff.newFindingsCount > 0 && <span className="tone-danger tone-text">{diff.newFindingsCount} new</span>}
            <span>since {diff.baselineTimestamp}</span>
            {onResetBaseline && (
              <button type="button" onClick={onResetBaseline} className="inline-flex items-center gap-1 underline underline-offset-2 cursor-pointer hover:text-[var(--text-primary)]">
                <RotateCcw size={11} strokeWidth={1.75} aria-hidden="true" />
                Reset baseline
              </button>
            )}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-1.5">
          {onTogglePin && (
            <button
              type="button"
              onClick={onTogglePin}
              aria-pressed={isPinned}
              className="btn btn-secondary"
              title={isPinned ? 'Remove from pinned projects' : 'Save to this browser and track changes'}
            >
              {isPinned ? <PinOff size={14} strokeWidth={1.75} aria-hidden="true" /> : <Pin size={14} strokeWidth={1.75} aria-hidden="true" />}
              {isPinned ? 'Unpin' : 'Pin'}
            </button>
          )}
          {onRescanLive && (
            <button type="button" onClick={onRescanLive} className="btn btn-secondary" title="Fetch the latest version from GitHub and compare">
              <RefreshCw size={14} strokeWidth={1.75} aria-hidden="true" />
              Rescan
            </button>
          )}
          <button type="button" onClick={onPrimaryAction} className="btn btn-primary">
            {primaryLabel}
            <ArrowRight size={14} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
}
