import { ArrowRight, GitBranch, Pin, PinOff, RefreshCw, RotateCcw, TrendingDown, TrendingUp } from 'lucide-react';
import { RepoAnalysisResult, RepoSnapshotDiff } from '../../types/atlas';
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
  const overallGrade =
    analysis.scores.overall >= 85
      ? { label: 'Production Ready', color: 'text-emerald-700 dark:text-emerald-400' }
      : analysis.scores.overall >= 65
      ? { label: 'Needs Refactoring', color: 'text-amber-700 dark:text-amber-400' }
      : { label: 'Critical Debt Detected', color: 'text-red-700 dark:text-red-400' };

  return (
    <div
      className="p-5 sm:p-6 rounded-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-5"
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-hairline)',
      }}
    >
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 font-mono-code text-xs font-semibold px-2.5 py-0.5 rounded-md"
            style={{
              backgroundColor: 'var(--accent-brand-soft)',
              color: 'var(--accent-brand)',
            }}
          >
            <GitBranch size={13} aria-hidden="true" />
            <span>{analysis.repoSlug}</span>
          </span>
          {analysis.stackTags.map((tag) => (
            <span
              key={tag}
              className="font-mono-code text-xs px-2 py-0.5 rounded-md"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-hairline)',
              }}
            >
              {tag}
            </span>
          ))}
          <span className="font-mono-code text-xs" style={{ color: 'var(--text-muted)' }}>
            · {analysis.sourceLabel} ({analysis.analyzedAt})
          </span>

          {onTogglePin && (
            <button
              type="button"
              onClick={onTogglePin}
              aria-pressed={isPinned}
              className="atlas-pill-btn inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold cursor-pointer"
              style={{
                backgroundColor: isPinned ? 'var(--accent-brand-soft)' : 'var(--bg-elevated)',
                color: isPinned ? 'var(--accent-brand)' : 'var(--text-secondary)',
                border: isPinned ? '1px solid var(--accent-brand)' : '1px solid var(--border-hairline)',
              }}
              title={isPinned ? 'Unpin project from browser cache' : 'Pin project to browser cache to track changes over time'}
            >
              {isPinned ? <PinOff size={12} aria-hidden="true" /> : <Pin size={12} aria-hidden="true" />}
              <span>{isPinned ? 'Pinned in Cache' : 'Pin Project'}</span>
            </button>
          )}

          {onRescanLive && (
            <button
              type="button"
              onClick={onRescanLive}
              className="atlas-pill-btn inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium cursor-pointer"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-hairline)',
              }}
              title="Re-fetch repository from GitHub and diff against baseline"
            >
              <RefreshCw size={11} aria-hidden="true" />
              <span>Re-Scan Live</span>
            </button>
          )}
        </div>

        <h1 id="main-heading" tabIndex={-1} className="heading-hero">
          {analysis.repoName}
        </h1>
        <p className="text-sm measure-readable" style={{ color: 'var(--text-secondary)' }}>
          {analysis.description}
        </p>
      </div>

      <div
        className="p-4 rounded-xl flex items-center justify-between lg:justify-end gap-5 shrink-0"
        style={{
          backgroundColor: 'var(--bg-elevated)',
          border: '1px solid var(--border-hairline)',
        }}
      >
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
            <span>Overall Health Index</span>
            <span className="font-mono-code text-[0.68rem] font-normal" style={{ color: 'var(--text-muted)' }}>
              (38% Sec · 32% Perf · 30% Arch)
            </span>
          </div>
          <div className="flex flex-wrap items-baseline gap-2 font-mono-code tabular-nums mt-0.5">
            <span className={`text-2xl font-bold ${overallGrade.color}`}>
              {analysis.scores.overall}
            </span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              /100 · {overallGrade.label}
            </span>
            {diff && diff.overallDelta !== 0 && (
              <span
                className={`inline-flex items-center gap-1 text-[0.7rem] font-bold px-2 py-0.5 rounded-full ${
                  diff.overallDelta > 0
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                    : 'bg-red-500/15 text-red-700 dark:text-red-300'
                }`}
                title={`Compared against baseline at ${diff.baselineTimestamp}`}
              >
                {diff.overallDelta > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                <span>
                  {diff.overallDelta > 0 ? `+${diff.overallDelta}` : diff.overallDelta} pts
                </span>
              </span>
            )}
          </div>
          {diff && (diff.resolvedFindingsCount > 0 || diff.newFindingsCount > 0) && (
            <div className="flex flex-wrap items-center gap-2 mt-1.5 font-mono-code text-[0.68rem]">
              {diff.resolvedFindingsCount > 0 && (
                <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                  ✓ {diff.resolvedFindingsCount} {diff.resolvedFindingsCount === 1 ? 'finding' : 'findings'} resolved
                </span>
              )}
              {diff.newFindingsCount > 0 && (
                <span className="text-red-600 dark:text-red-400 font-semibold">
                  +{diff.newFindingsCount} new {diff.newFindingsCount === 1 ? 'finding' : 'findings'}
                </span>
              )}
              {onResetBaseline && (
                <button
                  type="button"
                  onClick={onResetBaseline}
                  className="inline-flex items-center gap-1 underline cursor-pointer opacity-80 hover:opacity-100"
                  style={{ color: 'var(--text-muted)' }}
                  title="Reset change-tracking baseline to current state"
                >
                  <RotateCcw size={10} />
                  <span>Reset baseline</span>
                </button>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onPrimaryAction}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-white cursor-pointer transition-opacity hover:opacity-95"
          style={{ backgroundColor: 'var(--accent-brand)' }}
        >
          <span>
            {analysis.findings.length > 0 && activeTab !== 'audit'
              ? `Review ${analysis.findings.length} Findings`
              : 'Export AI Blueprint'}
          </span>
          <ArrowRight size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
