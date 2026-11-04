import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, X } from 'lucide-react';
import { WorkspaceTab } from './TopHeader';

interface OnboardingTourModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPreset: (presetId: string) => void;
  onSelectTab: (tab: WorkspaceTab) => void;
}

interface TourStep {
  id: string;
  title: string;
  description: string;
  points: string[];
  ctaLabel: string;
  presetId?: string;
  tab: WorkspaceTab;
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 'stacks',
    title: 'Works across stacks',
    description:
      'RepoAtlas maps web apps, Chrome extensions, desktop apps and C or Rust codebases. Load a preset to see it on a real project.',
    points: [
      'Next.js, Vite and Supabase projects',
      'Manifest V3 extensions and Tauri or Electron apps',
      'Large C and Rust repositories',
    ],
    ctaLabel: 'Load Tauri desktop preset',
    presetId: 'tauri-desktop-overlay',
    tab: 'graph',
  },
  {
    id: 'graph',
    title: 'Read the architecture map',
    description:
      'Each file is placed in one of six layers. Click a module to trace its imports and callers, or double-click to open its source.',
    points: [
      'Import cycles are highlighted',
      'Oversized files are flagged (limits depend on the language)',
      'Filter by issues, cycles or file size',
    ],
    ctaLabel: 'Open graph',
    tab: 'graph',
  },
  {
    id: 'audit',
    title: 'Review the audit',
    description:
      'Fourteen static rules check for leaked secrets, injection, unsafe IPC and slow query patterns. Each finding points to the exact line.',
    points: [
      'Web and API security',
      'Extension and desktop permissions',
      'Async waterfalls and N+1 queries',
    ],
    ctaLabel: 'Open audit',
    presetId: 'vibe-saas-billing',
    tab: 'audit',
  },
  {
    id: 'handoff',
    title: 'Hand off to your agent',
    description:
      'Export an AGENTS.md written for this repository, or copy a single prompt that lists every fix.',
    points: [
      'Press Ctrl K or ⌘K to search anywhere',
      'Presets, tabs and filters are kept in the URL',
    ],
    ctaLabel: 'Open AGENTS.md export',
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

  function runCta() {
    if (current.presetId) onSelectPreset(current.presetId);
    onSelectTab(current.tab);
    onClose();
  }

  return (
    <dialog ref={dialogRef} closedby="any" aria-labelledby="tour-modal-title" onClose={onClose} className="atlas-dialog" style={{ maxWidth: 'min(32rem, 94vw)' }}>
      <header className="flex items-center justify-between gap-3 px-5 pt-4">
        <div className="flex items-center gap-3">
          <span className="text-muted text-xs tabular-nums" aria-live="polite">
            Step {stepIdx + 1} of {TOUR_STEPS.length}
          </span>
          <div className="flex items-center" role="group" aria-label="Tutorial steps">
            {TOUR_STEPS.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                aria-label={`Go to step ${idx + 1}: ${s.title}`}
                aria-current={idx === stepIdx ? 'step' : undefined}
                onClick={() => setStepIdx(idx)}
                className="flex h-5 w-5 cursor-pointer items-center justify-center rounded-full"
              >
                <span
                  className="block h-1.5 rounded-full"
                  style={{
                    width: idx === stepIdx ? 14 : 6,
                    background: idx <= stepIdx ? 'var(--text-primary)' : 'var(--border-strong)',
                    transition: 'width var(--dur-base) var(--ease-out), background-color var(--dur-base) var(--ease-out)',
                  }}
                />
              </button>
            ))}
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="Close tutorial" className="btn btn-ghost btn-icon btn-sm">
          <X size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </header>

      <div key={current.id} className="atlas-fade-in space-y-3 px-5 pb-5 pt-3">
        <h2 id="tour-modal-title" className="text-lg font-semibold tracking-tight">{current.title}</h2>
        <p className="text-secondary leading-relaxed">{current.description}</p>
        <ul className="space-y-1.5 pt-1">
          {current.points.map((point) => (
            <li key={point} className="text-secondary tone-neutral flex items-center gap-2.5 text-[0.8125rem]">
              <span className="tone-dot" aria-hidden="true" />
              <span>{point}</span>
            </li>
          ))}
        </ul>
        <button type="button" onClick={runCta} className="btn btn-ghost btn-sm -ml-2.5">
          <span>{current.ctaLabel}</span>
          <ArrowUpRight size={14} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>

      <footer className="divider-t flex items-center justify-between gap-3 px-5 py-3">
        <button type="button" onClick={onClose} className="btn btn-ghost">Skip</button>
        <div className="flex items-center gap-2">
          <button type="button" disabled={stepIdx === 0} onClick={() => setStepIdx((i) => Math.max(0, i - 1))} className="btn btn-secondary">
            Back
          </button>
          <button type="button" autoFocus onClick={() => (isLast ? onClose() : setStepIdx((i) => i + 1))} className="btn btn-primary min-w-[4.5rem]">
            {isLast ? 'Done' : 'Next'}
          </button>
        </div>
      </footer>
    </dialog>
  );
}
