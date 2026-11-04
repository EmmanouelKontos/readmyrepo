import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Sparkles, X } from 'lucide-react';
import { WorkspaceTab } from './TopHeader';

interface OnboardingTourModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPreset: (presetId: string) => void;
  onSelectTab: (tab: WorkspaceTab) => void;
}

interface TourStep {
  stepNumber: string;
  badge: string;
  title: string;
  description: string;
  highlights: Array<{ label: string; detail: string }>;
  ctaLabel: string;
  presetId?: string;
  tab: WorkspaceTab;
}

const TOUR_STEPS: TourStep[] = [
  {
    stepNumber: '01',
    badge: 'Universal Stack Compatibility',
    title: 'Analyze Full-Stack SaaS, Chrome Extensions, Desktop Apps & Kernel Codebases',
    description:
      'RepoAtlas natively resolves dependencies and audits security/performance across 5 major software archetypes — from Next.js + Supabase web apps to Manifest V3 extensions, Tauri/Electron desktop overlays, mobile apps, and C11/Rust kernel subsystems.',
    highlights: [
      { label: 'Full-Stack Web & SaaS', detail: 'Next.js, React, Vite, Supabase, SQL & /api/* routes' },
      { label: 'Chrome Extensions (MV3)', detail: 'manifest.json service workers, popups & <all_urls> checks' },
      { label: 'Desktop & Overlay (Tauri / Electron)', detail: 'TypeScript invoke() → Rust #[tauri::command] & CSP sandbox' },
      { label: 'Systems & Mega-Repos (C / Rust)', detail: 'Stratified sampling + #include & use crate:: AST edges' },
    ],
    ctaLabel: 'Load Tauri Desktop Preset',
    presetId: 'tauri-desktop-overlay',
    tab: 'graph',
  },
  {
    stepNumber: '02',
    badge: 'Step 01 · Architecture Map',
    title: 'Trace Cross-Boundary Dependencies, Cycles & >220 LOC God Modules',
    description:
      'Every file is classified into 6 architectural layers (Entry → Feature → UI → Service → Data → Config). Click any module node to highlight its upstream callers and downstream imports, or double-click to inspect line-numbered source code.',
    highlights: [
      { label: 'Cross-Language Edges', detail: 'Connects manifest.json, fetch("/api/..."), and Tauri invoke() calls' },
      { label: 'Circular Dependency Detection', detail: 'Tarjan DFS highlights bidirectional import cycles in red' },
      { label: 'Modularity Cap (>220 LOC)', detail: 'Flags oversized monolithic files that bloat AI context windows' },
      { label: 'Interactive Canvas Zoom', detail: 'Filter by Issues, Cycles, or >220 LOC and zoom/fit the topology' },
    ],
    ctaLabel: 'Explore Architecture Map',
    tab: 'graph',
  },
  {
    stepNumber: '03',
    badge: 'Step 02 · Security & Perf Audit',
    title: 'Catch Credentials, SQLi, XSS, IPC Escapes & N+1 Loops Before Shipping',
    description:
      'The static auditor runs 14 specialized rules across web, browser extension, desktop, and systems code. Each finding pinpoints the exact file and line number with a one-click AI remediation prompt.',
    highlights: [
      { label: 'Web & API Security (SEC-001..005)', detail: 'Service-role JWTs, NEXT_PUBLIC_ leaks, XSS, SQLi & wildcard CORS' },
      { label: 'Extension & Desktop (SEC-007..008)', detail: 'MV3 <all_urls> over-permissioning & disabled Tauri/Electron CSP' },
      { label: 'Systems & Kernel (SEC-006 / PERF-006)', detail: 'Unbounded C strcpy/sprintf, CPU mdelay() & undocumented unsafe' },
      { label: 'Async Waterfalls & N+1 (PERF-001..005)', detail: 'Sequential awaits, loop queries, barrel files & unbounded selects' },
    ],
    ctaLabel: 'Inspect Security & Perf Audit',
    presetId: 'vibe-saas-billing',
    tab: 'audit',
  },
  {
    stepNumber: '04',
    badge: 'Step 03 · AGENTS.md & AI Fix',
    title: 'Compile Tailored AGENTS.md Guardrails & One-Shot Refactoring Prompts',
    description:
      'Turn static findings into immediate fixes. Export a repository-specific AGENTS.md architecture specification or copy the Master Refactoring Prompt directly into Claude Code, Cursor, or Windsurf.',
    highlights: [
      { label: 'AGENTS.md Context Compiler', detail: 'Generates layer rules, file-size caps & security invariants' },
      { label: 'Master AI Fix Prompt', detail: 'Packages every file path, line number & required fix in one prompt' },
      { label: 'Command Palette (⌘K / Ctrl+K)', detail: 'Jump to any module, audit rule, or workspace view in milliseconds' },
      { label: 'Shareable Deep-Link URLs', detail: 'Every preset, active tab & filter state syncs to the browser URL' },
    ],
    ctaLabel: 'Open AGENTS.md Compiler',
    tab: 'blueprint',
  },
];

export function OnboardingTourModal({ isOpen, onClose, onSelectPreset, onSelectTab }: OnboardingTourModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) {
      setStepIdx(0);
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setStepIdx((i) => Math.min(TOUR_STEPS.length - 1, i + 1));
      if (e.key === 'ArrowLeft') setStepIdx((i) => Math.max(0, i - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  const current = TOUR_STEPS[stepIdx];
  const isLast = stepIdx === TOUR_STEPS.length - 1;

  return (
    <dialog ref={dialogRef} closedby="any" aria-labelledby="tour-modal-title" onClose={onClose} className="atlas-dialog" style={{ maxWidth: 'min(46rem, 94vw)' }}>
      <div className="p-5 sm:p-6 space-y-5">
        <div className="flex items-center justify-between gap-3 pb-3.5" style={{ borderBottom: '1px solid var(--border-hairline)' }}>
          <div className="flex items-center gap-2">
            <span className="font-mono-code text-xs px-2.5 py-1 rounded-md font-semibold flex items-center gap-1.5" style={{ backgroundColor: 'var(--accent-brand-soft)', color: 'var(--accent-brand)' }}>
              <Sparkles size={13} aria-hidden="true" />
              <span>Quick Tour · {stepIdx + 1}/{TOUR_STEPS.length}</span>
            </span>
            <span className="text-xs hidden sm:inline" style={{ color: 'var(--text-muted)' }}>{current.badge}</span>
          </div>

          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer" style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-hairline)' }}>
              Skip Tutorial
            </button>
            <button type="button" onClick={onClose} aria-label="Close tutorial" className="p-1.5 rounded-lg cursor-pointer" style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
              <X size={15} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2" role="tablist" aria-label="Tutorial steps">
          {TOUR_STEPS.map((s, idx) => {
            const active = idx === stepIdx;
            return (
              <button key={s.stepNumber} type="button" role="tab" aria-selected={active} onClick={() => setStepIdx(idx)} className="text-left p-2 rounded-lg cursor-pointer transition-all flex items-center justify-between text-xs font-mono-code font-semibold" style={{ backgroundColor: active ? 'var(--accent-brand-soft)' : 'var(--bg-elevated)', border: active ? '1px solid var(--accent-brand)' : '1px solid var(--border-hairline)', color: active ? 'var(--accent-brand)' : 'var(--text-muted)' }}>
                <span>STEP {s.stepNumber}</span>
                {idx < stepIdx && <CheckCircle2 size={12} className="text-emerald-600 dark:text-emerald-400" aria-hidden="true" />}
              </button>
            );
          })}
        </div>

        <div className="space-y-2.5">
          <h2 id="tour-modal-title" className="text-lg sm:text-xl font-bold tracking-tight">{current.title}</h2>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{current.description}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {current.highlights.map((item) => (
            <div key={item.label} className="p-3 rounded-xl space-y-1" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-hairline)' }}>
              <div className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{item.label}</div>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{item.detail}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-3.5" style={{ borderTop: '1px solid var(--border-hairline)' }}>
          <button type="button" onClick={() => { if (current.presetId) onSelectPreset(current.presetId); onSelectTab(current.tab); onClose(); }} className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer" style={{ backgroundColor: 'var(--accent-brand-soft)', color: 'var(--accent-brand)', border: '1px solid var(--border-strong)' }}>
            {current.ctaLabel} ↗
          </button>

          <div className="flex items-center gap-2">
            <button type="button" disabled={stepIdx === 0} onClick={() => setStepIdx((i) => Math.max(0, i - 1))} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer disabled:opacity-40" style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-hairline)' }}>
              <ArrowLeft size={13} aria-hidden="true" />
              <span>Previous</span>
            </button>

            <button type="button" autoFocus onClick={() => (isLast ? onClose() : setStepIdx((i) => i + 1))} className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white cursor-pointer" style={{ backgroundColor: 'var(--accent-brand)' }}>
              <span>{isLast ? 'Start Exploring' : 'Next Step'}</span>
              {isLast ? <CheckCircle2 size={13} aria-hidden="true" /> : <ArrowRight size={13} aria-hidden="true" />}
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
