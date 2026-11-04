import React, { useId, useRef, useState } from 'react';
import { ArrowRight, Cpu, FolderOpen, GitBranch, KeyRound, Layers, Loader2, Pin, ShieldCheck, Sparkles, X } from 'lucide-react';
import { PinnedProjectRecord } from '../../types/atlas';

interface EmptyWorkspaceHeroProps {
  pinnedProjects: PinnedProjectRecord[];
  isLoading: boolean;
  onAnalyzeGitHub: (repoUrl: string, githubToken?: string) => Promise<void>;
  onUploadFolder: (files: FileList) => Promise<void>;
  onSelectPinned: (record: PinnedProjectRecord) => void;
  onUnpinProject: (slug: string) => void;
}

const LIVE_GITHUB_EXAMPLES = [
  { label: 'torvalds/linux', slug: 'torvalds/linux', note: 'C11 / Kernel' },
  { label: 'colinhacks/zod', slug: 'colinhacks/zod', note: 'TypeScript ESM' },
  { label: 'shadcn-ui/ui', slug: 'shadcn-ui/ui', note: 'Monorepo UI' },
  { label: 'tauri-apps/tauri', slug: 'tauri-apps/tauri', note: 'Rust + Desktop' },
  { label: 'facebook/react', slug: 'facebook/react', note: 'Core Runtime' },
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
    <div className="space-y-6 py-2">
      <section className="p-6 sm:p-10 rounded-2xl space-y-6" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-hairline)' }}>
        <div className="space-y-3 max-w-3xl">
          <span className="inline-flex items-center gap-1.5 font-mono-code text-xs font-semibold px-2.5 py-1 rounded-md" style={{ backgroundColor: 'var(--accent-brand-soft)', color: 'var(--accent-brand)' }}>
            <Sparkles size={13} aria-hidden="true" />
            <span>100% Client-Side AST Engine · Public &amp; Private GitHub · Local Folders</span>
          </span>
          <h1 id="main-heading" tabIndex={-1} className="heading-hero text-2xl sm:text-4xl">
            Map any repository&apos;s architecture, security posture, and AI context.
          </h1>
          <p className="text-sm sm:text-base measure-readable" style={{ color: 'var(--text-secondary)' }}>
            Enter any GitHub repository URL (<code className="font-mono-code">owner/repo</code> or subpath like <code className="font-mono-code">torvalds/linux/kernel/sched</code>) or upload a local workspace folder to run a 14-rule static audit, interactive dependency topology, and <code className="font-mono-code">AGENTS.md</code> compiler.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 w-full max-w-4xl">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full">
            <label htmlFor={repoInputId} className="visually-hidden">GitHub repository URL or owner/repo slug</label>
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl flex-1 min-w-0" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-strong)' }}>
              <GitBranch size={16} className="shrink-0" style={{ color: 'var(--accent-brand)' }} aria-hidden="true" />
              <input id={repoInputId} type="text" value={repoInput} onChange={(e) => setRepoInput(e.target.value)} placeholder="https://github.com/owner/repo or owner/repo/subpath" className="w-full min-w-0 bg-transparent text-sm font-mono-code focus:outline-none" autoFocus />
            </div>

            <button type="submit" disabled={isLoading || !repoInput.trim()} className="atlas-pill-btn px-5 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-50 inline-flex items-center justify-center gap-2 shrink-0" style={{ backgroundColor: 'var(--accent-brand)' }}>
              {isLoading ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : null}
              <span>{isLoading ? 'Scanning Repo...' : 'Analyze Repository'}</span>
              {!isLoading && <ArrowRight size={15} aria-hidden="true" />}
            </button>

            <input ref={folderRef} type="file" multiple {...({ webkitdirectory: '', directory: '' } as Record<string, string>)} className="hidden" onChange={(e) => { if (e.target.files && e.target.files.length > 0) void onUploadFolder(e.target.files); }} />
            <button type="button" onClick={() => folderRef.current?.click()} className="atlas-pill-btn px-4 py-2.5 rounded-xl text-sm font-semibold cursor-pointer inline-flex items-center justify-center gap-2 shrink-0" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }}>
              <FolderOpen size={15} aria-hidden="true" />
              <span>Local Folder</span>
            </button>

            <button type="button" aria-expanded={showPat} onClick={() => setShowPat((v) => !v)} className="atlas-pill-btn px-3.5 py-2.5 rounded-xl text-xs font-semibold cursor-pointer inline-flex items-center justify-center gap-1.5 shrink-0" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-hairline)', color: 'var(--text-secondary)' }}>
              <KeyRound size={14} aria-hidden="true" />
              <span>Private PAT</span>
            </button>
          </div>

          {showPat && (
            <div className="p-3.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-strong)' }}>
              <span className="flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                <ShieldCheck size={15} className="text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
                <span>Volatile in-memory PAT — never stored on disk or sent outside <code className="font-mono-code">api.github.com</code>.</span>
              </span>
              <label htmlFor={patInputId} className="visually-hidden">GitHub Personal Access Token</label>
              <input id={patInputId} type="password" autoComplete="off" value={patInput} onChange={(e) => setPatInput(e.target.value)} placeholder="github_pat_... or ghp_..." className="px-3 py-1.5 rounded-lg font-mono-code text-xs sm:w-64 focus:outline-none" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-hairline)', color: 'var(--text-primary)' }} />
            </div>
          )}
        </form>

        <div className="space-y-2 pt-1">
          <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Or test live against a popular open-source GitHub repository:</p>
          <div className="flex flex-wrap items-center gap-2">
            {LIVE_GITHUB_EXAMPLES.map((ex) => (
              <button key={ex.slug} type="button" disabled={isLoading} onClick={() => void onAnalyzeGitHub(ex.slug, patInput.trim() || undefined)} className="atlas-pill-btn inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono-code cursor-pointer disabled:opacity-50" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-hairline)', color: 'var(--text-primary)' }}>
                <GitBranch size={12} style={{ color: 'var(--accent-brand)' }} aria-hidden="true" />
                <span className="font-semibold">{ex.label}</span>
                <span style={{ color: 'var(--text-muted)' }}>· {ex.note}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="p-5 sm:p-6 rounded-2xl space-y-3" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-hairline)' }}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Pin size={14} style={{ color: 'var(--accent-brand)' }} aria-hidden="true" />
            <span>Pinned Projects in Browser Cache ({pinnedProjects.length})</span>
          </h2>
          <span className="text-xs font-mono-code" style={{ color: 'var(--text-muted)' }}>Saved locally via IndexedDB · Restores offline in &lt;5ms</span>
        </div>

        {pinnedProjects.length === 0 ? (
          <p className="text-xs py-2" style={{ color: 'var(--text-secondary)' }}>
            No pinned repositories yet. Scan any GitHub repository or local folder above and click <strong>Pin Project</strong> to save its snapshot and track score deltas (<code className="font-mono-code">+pts</code>) over time.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {pinnedProjects.map((pin) => {
              const delta = pin.scores.overall - pin.baselineScores.overall;
              return (
                <div key={pin.slug} className="p-3.5 rounded-xl flex items-center justify-between gap-2" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-hairline)' }}>
                  <button type="button" onClick={() => onSelectPinned(pin)} className="text-left flex-1 min-w-0 cursor-pointer">
                    <div className="font-mono-code text-xs font-semibold truncate">{pin.slug}</div>
                    <div className="flex items-center gap-2 mt-1 font-mono-code text-xs tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                      <span>Score: <strong>{pin.scores.overall}/100</strong></span>
                      {delta !== 0 && <span className={delta > 0 ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-red-600 dark:text-red-400 font-bold'}>({delta > 0 ? `+${delta}` : delta} pts)</span>}
                      <span>· {pin.findingsCount} findings</span>
                    </div>
                  </button>
                  <button type="button" onClick={() => onUnpinProject(pin.slug)} aria-label={`Unpin ${pin.slug}`} className="p-1.5 rounded-lg cursor-pointer opacity-70 hover:opacity-100" style={{ color: 'var(--text-muted)' }}>
                    <X size={14} aria-hidden="true" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-xl space-y-1.5" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-hairline)' }}>
          <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: 'var(--accent-brand)' }}><Layers size={15} aria-hidden="true" /><span>01 · Multi-Language AST Topology</span></div>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>Resolves TypeScript/ESM, Rust crates, C11 <code className="font-mono-code">#include</code> headers, Chrome MV3 manifests, and Tauri IPC bridges into a layered 6-column SVG graph.</p>
        </div>
        <div className="p-5 rounded-xl space-y-1.5" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-hairline)' }}>
          <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: 'var(--accent-brand)' }}><ShieldCheck size={15} aria-hidden="true" /><span>02 · Forensic Security &amp; Perf Audit</span></div>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>Detects leaked secrets, DOM XSS, SQL interpolation, C buffer overflows, N+1 loops, and multi-hop circular dependency cycles with 1-click AI auto-remediation.</p>
        </div>
        <div className="p-5 rounded-xl space-y-1.5" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-hairline)' }}>
          <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: 'var(--accent-brand)' }}><Cpu size={15} aria-hidden="true" /><span>03 · AGENTS.md &amp; Score Delta Tracking</span></div>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>Compiles ready-to-drop <code className="font-mono-code">AGENTS.md</code> guardrails and tracks score deltas (<code className="font-mono-code">+pts</code>) across re-scans and pinned browser snapshots.</p>
        </div>
      </div>
    </div>
  );
}
