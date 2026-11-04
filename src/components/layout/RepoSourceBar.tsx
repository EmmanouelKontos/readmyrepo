import React, { useId, useRef, useState } from 'react';
import { ArrowRight, FolderOpen, KeyRound, Loader2, X } from 'lucide-react';
import { PinnedProjectRecord } from '../../types/atlas';
import { scoreTone } from '../ui/scoreTone';

interface RepoSourceBarProps {
  activeRepoSlug?: string;
  pinnedProjects?: PinnedProjectRecord[];
  onSelectPinned?: (record: PinnedProjectRecord) => void;
  onUnpinProject?: (slug: string) => void;
  onAnalyzeGitHub: (repoUrl: string, githubToken?: string) => Promise<void>;
  onUploadFolder: (files: FileList) => Promise<void>;
  isLoading: boolean;
}

export function RepoSourceBar({
  activeRepoSlug,
  pinnedProjects = [],
  onSelectPinned,
  onUnpinProject,
  onAnalyzeGitHub,
  onUploadFolder,
  isLoading,
}: RepoSourceBarProps) {
  const [githubInput, setGithubInput] = useState('');
  const [githubToken, setGithubToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const githubInputId = useId();
  const patInputId = useId();
  const hasToken = githubToken.trim().length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!githubInput.trim()) return;
    await onAnalyzeGitHub(githubInput.trim(), githubToken.trim() || undefined);
    setGithubInput('');
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 min-w-0 overflow-x-auto">
          {pinnedProjects.length > 0 && <span className="eyebrow mr-1 shrink-0">Pinned</span>}
          {pinnedProjects.map((pin) => {
            const isCurrent = activeRepoSlug === pin.slug;
            return (
              <span key={pin.slug} className="group inline-flex items-center shrink-0 rounded-md" style={{ background: isCurrent ? 'var(--bg-elevated)' : 'transparent' }}>
                <button
                  type="button"
                  onClick={() => onSelectPinned?.(pin)}
                  aria-current={isCurrent ? 'true' : undefined}
                  className="inline-flex items-center gap-1.5 h-7 pl-2 pr-1 rounded-md font-mono-code text-[0.75rem] cursor-pointer transition-colors hover:bg-[var(--bg-elevated)]"
                  style={{ color: isCurrent ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                  title={`Open ${pin.repoName}`}
                >
                  <span className={`tone-dot ${scoreTone(pin.scores.overall)}`} aria-hidden="true" />
                  {pin.slug}
                  <span className="text-muted tabular-nums">{pin.scores.overall}</span>
                </button>
                {onUnpinProject && (
                  <button
                    type="button"
                    onClick={() => onUnpinProject(pin.slug)}
                    aria-label={`Unpin ${pin.slug}`}
                    className="btn btn-ghost btn-icon btn-sm w-6 h-6 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    <X size={12} strokeWidth={1.75} aria-hidden="true" />
                  </button>
                )}
              </span>
            );
          })}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <form onSubmit={handleSubmit} className="flex-1 lg:flex-none">
            <label htmlFor={githubInputId} className="visually-hidden">Analyze another GitHub repository</label>
            <div className="field lg:w-72 pr-1">
              <input
                id={githubInputId}
                type="text"
                value={githubInput}
                onChange={(e) => setGithubInput(e.target.value)}
                placeholder="Analyze another repo…"
                className="font-mono-code text-[0.8125rem]"
                autoComplete="off"
                spellCheck={false}
              />
              <button type="submit" disabled={isLoading || !githubInput.trim()} aria-label="Analyze" className="btn btn-ghost btn-icon btn-sm w-6 h-6">
                {isLoading ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <ArrowRight size={13} strokeWidth={1.75} aria-hidden="true" />}
              </button>
            </div>
          </form>
          <button
            type="button"
            aria-expanded={showToken}
            onClick={() => setShowToken((v) => !v)}
            className="btn btn-ghost btn-icon"
            aria-label={hasToken ? 'Token added — edit private repository token' : 'Add private repository token'}
            title={hasToken ? 'Token added' : 'Private repository'}
          >
            <KeyRound size={15} strokeWidth={1.75} className={hasToken ? 'tone-success tone-text' : undefined} aria-hidden="true" />
          </button>
          <input
            ref={folderInputRef}
            type="file"
            multiple
            {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
            className="hidden"
            onChange={(e) => { if (e.target.files && e.target.files.length > 0) void onUploadFolder(e.target.files); }}
          />
          <button type="button" onClick={() => folderInputRef.current?.click()} className="btn btn-ghost btn-icon" aria-label="Open local folder" title="Open local folder">
            <FolderOpen size={15} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div hidden={!showToken} className="atlas-collapsible surface p-3 flex flex-col md:flex-row md:items-center gap-3">
        <p className="flex-1 text-[0.8125rem] text-secondary">
          Read-only token, kept in memory for this tab and sent only to <span className="code-inline">api.github.com</span>.
        </p>
        <label htmlFor={patInputId} className="visually-hidden">GitHub personal access token</label>
        <div className="field md:w-72">
          <input
            id={patInputId}
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={githubToken}
            onChange={(e) => setGithubToken(e.target.value)}
            placeholder="github_pat_…"
            className="font-mono-code text-[0.8125rem]"
          />
        </div>
        {hasToken && (
          <button type="button" onClick={() => setGithubToken('')} className="btn btn-secondary btn-sm">Clear</button>
        )}
      </div>
    </div>
  );
}
