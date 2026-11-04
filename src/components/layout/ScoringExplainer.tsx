import { useRef } from 'react';
import { Info, X } from 'lucide-react';

const BANDS: Array<[string, string, string]> = [
  ['85–100', 'Healthy', 'tone-success'],
  ['65–84', 'Needs work', 'tone-warning'],
  ['0–64', 'At risk', 'tone-danger'],
];

const SCORES: Array<[string, string]> = [
  ['Security', 'Secrets written into the code, raw HTML or SQL built from user input, and unsafe settings.'],
  ['Performance', 'Requests made one after another, a query per item in a loop, loading whole tables, and similar slowdowns.'],
  ['Architecture', 'Import loops (files that depend on each other in a circle), oversized files, and low-level files reaching up into high-level ones.'],
];

/** "How is this scored?" link plus a short, plain-language dialog. */
export function ScoringExplainer() {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="inline-flex items-center gap-1 text-[0.75rem] text-muted underline underline-offset-2 cursor-pointer hover:text-[var(--text-primary)]"
      >
        <Info size={12} strokeWidth={1.75} aria-hidden="true" />
        How is this scored?
      </button>

      <dialog ref={dialogRef} closedby="any" aria-labelledby="scoring-title" className="atlas-dialog text-left" style={{ maxWidth: 'min(34rem, 94vw)' }}>
        <header className="flex items-center justify-between gap-3 px-5 pt-4">
          <h2 id="scoring-title" className="text-lg font-semibold tracking-tight">How the scores work</h2>
          <button type="button" onClick={() => dialogRef.current?.close()} aria-label="Close" className="btn btn-ghost btn-icon btn-sm">
            <X size={16} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </header>

        <div className="space-y-5 px-5 pb-5 pt-3 text-[0.8125rem] text-secondary leading-relaxed">
          <p>
            Every score starts at <strong className="text-primary">100</strong>. Each problem found takes points away: serious problems
            cost the most (a critical one up to 24 points), minor ones only a few. Repeats of the same kind of problem cost less each time,
            so one noisy pattern can't sink the whole score.
          </p>

          <dl className="space-y-2">
            {SCORES.map(([name, body]) => (
              <div key={name}>
                <dt className="font-medium text-primary">{name}</dt>
                <dd>{body}</dd>
              </div>
            ))}
          </dl>

          <div className="space-y-1.5">
            <p>
              The <strong className="text-primary">overall</strong> score blends them: 38% security, 32% performance, 30% architecture.
            </p>
            <ul className="flex flex-wrap gap-x-4 gap-y-1">
              {BANDS.map(([range, label, tone]) => (
                <li key={label} className={`inline-flex items-center gap-1.5 ${tone}`}>
                  <span className="tone-dot" aria-hidden="true" />
                  <span className="font-mono-code tabular-nums">{range}</span>
                  <span className="text-secondary">{label}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-muted text-[0.75rem]">
            Oversized files count by how much of the code they make up, and imports that only describe types are ignored when looking for
            loops. Large repositories are scanned as a sample of their most important files. AI context size is not a score: it estimates
            how many tokens (about 4 characters each) an AI assistant reads to load these files.
          </p>
        </div>
      </dialog>
    </>
  );
}
