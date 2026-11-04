import React, { useId, useRef, useState } from 'react';
import { ArrowLeft, FolderOpen, GitBranch, KeyRound, Loader2, Pin, ShieldCheck, X } from 'lucide-react';
import { PinnedProjectRecord } from '../../types/atlas';

interface RepoSourceBarProps {
  activeRepoSlug?: string;
  pinnedProjects?: PinnedProjectRecord[];
  onClearProject?: () => void;
  onSelectPinned?: (record: PinnedProjectRecord) => void;
  onUnpinProject?: (slug: string) => void;
  onAnalyzeGitHub: (repoUrl: string, githubToken?: string) => Promise<void>;
  onUploadFolder: (files: FileList) => Promise<void>;
  isLoading: boolean;
}

const BADGE_TONE_CLASSES = {
  danger: 'bg-red-500/12 text-red-700 dark:text-red-300 border-red-500/25',
  success: 'bg-emerald-500/12 text-emerald-800 dark:text-emerald-300 border-emerald-500/25',
  warning: 'bg-amber-500/12 text-amber-800 dark:text-amber-300 border-amber-500/25',
};

export function RepoSourceBar({
  activeRepoSlug,
  pinnedProjects = [],
  onClearProject,
  onSelectPinned,
  onUnpinProject,
  onAnalyzeGitHub,
  onUploadFolder,
  isLoading,
}: RepoSourceBarProps) {
  const [githubInput, setGithubInput] = useState('');
  const [githubToken, setGithubToken] = useState('');
  const [showTokenDrawer, setShowTokenDrawer] = useState(false);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const githubInputId = useId();
  const patInputId = useId();

  async function handleGitHubSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!githubInput.trim()) return;
    await onAnalyzeGitHub(githubInput, githubToken || undefined);
  }

  const hasToken = githubToken.trim().length > 0;

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-2.5" style={{ backgroundColor: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-hairline)' }}>
      <div className="max-w-[1640px] mx-auto space-y-2">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            {activeRepoSlug && onClearProject && (
              <button
                type="button"
                onClick={onClearProject}
                className="atlas-pill-btn flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer"
                style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-strong)' }}
                title="Close current repository and return to Launchpad"
              >
                <ArrowLeft size={13} aria-hidden="true" />
                <span>Launchpad</span>
              </button>
            )}

            {activeRepoSlug && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold" style={{ backgroundColor: 'var(--accent-brand-soft)', color: 'var(--accent-brand)', border: '1px solid var(--border-strong)' }}>
                <GitBranch size={13} aria-hidden="true" />
                <span className="font-mono-code">{activeRepoSlug}</span>
              </span>
            )}

            {pinnedProjects.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[0.7rem] font-semibold tracking-wide ml-1 flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                  <Pin size={11} style={{ color: 'var(--accent-brand)' }} aria-hidden="true" />
                  <span>Pinned ({pinnedProjects.length}):</span>
                </span>
                {pinnedProjects.map((pin) => {
                  const isCurrent = activeRepoSlug === pin.slug;
                  const delta = pin.scores.overall - pin.baselineScores.overall;
                  const tone = pin.scores.overall >= 85 ? 'success' : pin.scores.overall >= 65 ? 'warning' : 'danger';
                  return (
                    <div
                      key={pin.slug}
                      className="inline-flex items-center rounded-lg text-xs overflow-hidden"
                      style={{
                        backgroundColor: isCurrent ? 'var(--bg-surface)' : 'transparent',
                        border: isCurrent ? '1px solid var(--accent-brand)' : '1px solid var(--border-hairline)',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => onSelectPinned?.(pin)}
                        className="flex items-center gap-1.5 px-2 py-0.5 cursor-pointer font-mono-code text-[0.72rem]"
                        style={{ color: isCurrent ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                        title={`Restore ${pin.repoName} from browser cache`}
                      >
                        <span className="font-semibold">{pin.slug}</span>
                        <span className={`px-1 rounded border text-[0.65rem] tabular-nums ${BADGE_TONE_CLASSES[tone]}`}>{pin.scores.overall}/100</span>
                        {delta !== 0 && (
                          <span className={`text-[0.65rem] font-bold tabular-nums ${delta > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                            {delta > 0 ? `+${delta}` : delta}
                          </span>
                        )}
                      </button>
                      {onUnpinProject && (
                        <button
                          type="button"
                          onClick={() => onUnpinProject(pin.slug)}
                          aria-label={`Unpin ${pin.slug}`}
                          className="px-1.5 py-0.5 cursor-pointer hover:opacity-100 opacity-65"
                          style={{ color: 'var(--text-muted)', borderLeft: '1px solid var(--border-hairline)' }}
                        >
                          <X size={11} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
            <form onSubmit={handleGitHubSubmit} className="flex items-center gap-1.5 flex-1 sm:flex-initial">
              <label htmlFor={githubInputId} className="visually-hidden">GitHub repository owner and name</label>
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg flex-1 sm:flex-initial" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-strong)' }}>
                <GitBranch size={13} strokeWidth={1.6} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
                <input id={githubInputId} type="text" value={githubInput} onChange={(e) => setGithubInput(e.target.value)} placeholder="owner/repo or subpath" className="bg-transparent text-xs focus:outline-none w-full sm:w-44 font-mono-code" />
              </div>
              <button type="submit" disabled={isLoading || !githubInput.trim()} className="atlas-pill-btn px-3 py-1.5 rounded-lg text-xs font-semibold text-white cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shrink-0" style={{ backgroundColor: 'var(--accent-brand)' }}>
                {isLoading ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : null}
                <span>Scan</span>
              </button>
            </form>

            <button
              type="button"
              aria-expanded={showTokenDrawer}
              onClick={() => setShowTokenDrawer((prev) => !prev)}
              className="atlas-pill-btn flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer shrink-0"
              style={{
                backgroundColor: hasToken ? 'var(--accent-brand-soft)' : 'var(--bg-surface)',
                border: hasToken ? '1px solid var(--accent-brand)' : '1px solid var(--border-strong)',
                color: hasToken ? 'var(--accent-brand)' : 'var(--text-secondary)',
              }}
            >
              <KeyRound size={13} strokeWidth={1.6} aria-hidden="true" />
              <span>{hasToken ? 'PAT Active' : 'Private Repo'}</span>
            </button>

            <input ref={folderInputRef} type="file" multiple {...({ webkitdirectory: '', directory: '' } as Record<string, string>)} className="hidden" onChange={(e) => { if (e.target.files && e.target.files.length > 0) void onUploadFolder(e.target.files); }} />
            <button type="button" onClick={() => folderInputRef.current?.click()} className="atlas-pill-btn flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer shrink-0" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }}>
              <FolderOpen size={13} strokeWidth={1.6} aria-hidden="true" />
              <span>Local Folder</span>
            </button>
          </div>
        </div>

        <div hidden={!showTokenDrawer} className="atlas-collapsible p-3 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-strong)' }}>
          <div className="flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
            <ShieldCheck size={15} className="text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
            <span><strong style={{ color: 'var(--text-primary)' }}>Private GitHub Repository Access:</strong> Held strictly in volatile browser memory — never saved to disk or sent outside <code className="font-mono-code">https://api.github.com</code>.</span>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor={patInputId} className="visually-hidden">GitHub Fine-Grained Personal Access Token</label>
            <input id={patInputId} type="password" autoComplete="off" spellCheck={false} value={githubToken} onChange={(e) => setGithubToken(e.target.value)} placeholder="github_pat_... or ghp_... (Read-Only)" className="px-2.5 py-1.5 rounded-lg text-xs font-mono-code w-full sm:w-64 focus:outline-none" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-hairline)', color: 'var(--text-primary)' }} />
            {hasToken && <button type="button" onClick={() => setGithubToken('')} className="px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer" style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-hairline)' }}>Clear</button>}
            <button type="button" onClick={() => setShowTokenDrawer(false)} aria-label="Hide token bar" className="p-1.5 rounded-lg cursor-pointer" style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}><X size={14} aria-hidden="true" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
