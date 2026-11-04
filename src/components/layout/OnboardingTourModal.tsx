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
      'Paste any GitHub repository and RepoAtlas reads its code in your browser: web apps, Chrome extensions, desktop apps, and Python, Go, Rust or C projects. Try an example project first.',
    points: [
      'Next.js, Vite and Supabase web apps',
      'Chrome extensions and Tauri or Electron desktop apps',
      'Python, Go, Rust and C codebases, even very large ones',
    ],
    ctaLabel: 'Open the desktop app example',
    presetId: 'tauri-desktop-overlay',
    tab: 'graph',
  },
  {
    id: 'graph',
    title: 'Read the map',
    description:
      'Every box is a file and every arrow points to a file it uses. Files are grouped in columns by role, from entry points on the left to settings on the right. Click a file to see what it uses and what uses it.',
    points: [
      'Import loops (files that depend on each other in a circle) show in red',
      'Oversized files are marked in orange',
      'Use the filters to show only files with problems',
    ],
    ctaLabel: 'Open the map',
    tab: 'graph',
  },
  {
    id: 'audit',
    title: 'Check the findings',
    description:
      '17 checks look for leaked keys, unsafe code, slow database patterns and messy structure. Each finding shows the exact line, why it matters and how to fix it.',
    points: [
      'Security: secrets, raw HTML, SQL built from user input',
      'Speed: requests in a row, a query per item, loading whole tables',
      'Structure: import loops and oversized files',
    ],
    ctaLabel: 'Open the findings',
    presetId: 'vibe-saas-billing',
    tab: 'audit',
  },
  {
    id: 'handoff',
    title: 'Hand it to your AI assistant',
    description:
      'Download an AGENTS.md guide that tells AI coding assistants how this project is organised, or copy one prompt that asks them to fix everything found.',
    points: [
      'Press Ctrl K (⌘K on Mac) to search files and findings',
      'The page address keeps your current view, so you can share it',
    ],
    ctaLabel: 'Open AI context',
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
