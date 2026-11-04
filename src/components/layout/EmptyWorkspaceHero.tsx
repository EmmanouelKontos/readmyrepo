import React, { useId, useRef, useState } from 'react';
import { ArrowRight, FolderOpen, GitBranch, KeyRound, Layers, ListChecks, Loader2, ShieldCheck, Sparkles } from 'lucide-react';
import { PinnedProjectRecord } from '../../types/atlas';
import { PinnedProjectList } from './PinnedProjectList';

interface EmptyWorkspaceHeroProps {
  pinnedProjects: PinnedProjectRecord[];
  isLoading: boolean;
  onAnalyzeGitHub: (repoUrl: string, githubToken?: string) => Promise<void>;
  onUploadFolder: (files: FileList) => Promise<void>;
  onSelectPinned: (record: PinnedProjectRecord) => void;
  onUnpinProject: (slug: string) => void;
}

const EXAMPLES = ['torvalds/linux', 'colinhacks/zod', 'shadcn-ui/ui', 'tauri-apps/tauri', 'facebook/react'];

const FEATURES = [
  { Icon: Layers, title: 'Dependency map', body: 'Imports across TS/JS, Python, Go, Rust, C, Chrome extensions and Tauri apps, grouped by layer.' },
  { Icon: ListChecks, title: 'Findings', body: 'Leaked secrets, unsafe HTML, N+1 queries, cycles and oversized modules, each with a fix.' },
  { Icon: Sparkles, title: 'AI context', body: 'A ready-to-commit AGENTS.md and a single prompt to fix everything that was found.' },
];

export function EmptyWorkspaceHero({
  pinnedProjects,
  isLoading,
  onAnalyzeGitHub,
  onUploadFolder,
  onSelectPinned,
  onUnpinProject,
}: EmptyWorkspaceHeroProps) {
  const [repoInput, setRepoInput] = useState('');
  const [patInput, setPatInput] = useState('');
  const [showPat, setShowPat] = useState(false);
  const folderRef = useRef<HTMLInputElement>(null);
  const repoInputId = useId();
  const patInputId = useId();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!repoInput.trim()) return;
    await onAnalyzeGitHub(repoInput.trim(), patInput.trim() || undefined);
  }

  return (
    <div className="max-w-[680px] mx-auto pt-10 sm:pt-20 pb-8 space-y-14 atlas-stagger">
      <section className="space-y-7 text-center" style={{ '--i': 0 } as React.CSSProperties}>
        <div className="space-y-3">
          <h1 id="main-heading" tabIndex={-1} className="heading-hero">
            See how a codebase fits together
          </h1>
          <p className="text-secondary text-[0.9375rem] max-w-[34rem] mx-auto">
            Paste a GitHub repository to get its dependency map, security and performance findings, and an AGENTS.md
            for your AI tools. Everything runs in your browser.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-left">
          <div className="flex flex-col sm:flex-row gap-2">
            <label htmlFor={repoInputId} className="visually-hidden">GitHub repository URL or owner/repo</label>
            <div className="field field-lg flex-1">
              <GitBranch size={16} strokeWidth={1.75} className="text-muted" aria-hidden="true" />
              <input
                id={repoInputId}
                type="text"
                value={repoInput}
                onChange={(e) => setRepoInput(e.target.value)}
                placeholder="owner/repo or https://github.com/…"
                className="font-mono-code text-[0.875rem]"
                autoComplete="off"
                spellCheck={false}
                autoFocus
              />
            </div>
            <button type="submit" disabled={isLoading || !repoInput.trim()} className="btn btn-primary btn-lg sm:w-36">
              {isLoading ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : null}
              <span>{isLoading ? 'Analyzing' : 'Analyze'}</span>
              {!isLoading && <ArrowRight size={15} strokeWidth={1.75} aria-hidden="true" />}
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1">
            <input
              ref={folderRef}
              type="file"
              multiple
              {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
              className="hidden"
              onChange={(e) => { if (e.target.files && e.target.files.length > 0) void onUploadFolder(e.target.files); }}
            />
            <button type="button" onClick={() => folderRef.current?.click()} className="btn btn-ghost btn-sm">
              <FolderOpen size={14} strokeWidth={1.75} aria-hidden="true" />
              Open local folder
            </button>
            <button type="button" aria-expanded={showPat} onClick={() => setShowPat((v) => !v)} className="btn btn-ghost btn-sm">
              <KeyRound size={14} strokeWidth={1.75} aria-hidden="true" />
              {patInput.trim() ? 'Token added' : 'Private repository'}
            </button>
          </div>

          <div hidden={!showPat} className="atlas-collapsible surface p-4 space-y-3">
            <div className="flex items-start gap-2.5 text-[0.8125rem] text-secondary">
              <ShieldCheck size={16} strokeWidth={1.75} className="tone-success tone-text shrink-0 mt-0.5" aria-hidden="true" />
              <p>
                Use a read-only fine-grained token. It stays in memory for this tab only and is sent to{' '}
                <span className="code-inline">api.github.com</span> and nowhere else.
              </p>
            </div>
            <label htmlFor={patInputId} className="visually-hidden">GitHub personal access token</label>
            <div className="field">
              <input
                id={patInputId}
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={patInput}
                onChange={(e) => setPatInput(e.target.value)}
                placeholder="github_pat_…"
                className="font-mono-code text-[0.8125rem]"
              />
            </div>
          </div>
        </form>

        <div className="space-y-2.5">
          <p className="eyebrow">Try an example</p>
          <div className="flex flex-wrap justify-center gap-1.5">
            {EXAMPLES.map((slug) => (
              <button
                key={slug}
                type="button"
                disabled={isLoading}
                onClick={() => void onAnalyzeGitHub(slug, patInput.trim() || undefined)}
                className="btn btn-secondary btn-sm font-mono-code text-secondary"
              >
                {slug}
              </button>
            ))}
          </div>
        </div>
      </section>

      {pinnedProjects.length > 0 && (
        <section className="space-y-2.5" style={{ '--i': 1 } as React.CSSProperties} aria-labelledby="pinned-heading">
          <div className="flex items-baseline justify-between">
            <h2 id="pinned-heading" className="eyebrow">Pinned</h2>
            <span className="text-[0.75rem] text-muted">Saved in this browser</span>
          </div>
          <PinnedProjectList pinnedProjects={pinnedProjects} onSelectPinned={onSelectPinned} onUnpinProject={onUnpinProject} />
        </section>
      )}

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-8 divider-t" style={{ '--i': 2 } as React.CSSProperties}>
        {FEATURES.map(({ Icon, title, body }) => (
          <div key={title} className="space-y-1.5">
            <div className="flex items-center gap-2 font-medium">
              <Icon size={15} strokeWidth={1.75} className="text-muted" aria-hidden="true" />
              {title}
            </div>
            <p className="text-[0.8125rem] text-secondary">{body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
