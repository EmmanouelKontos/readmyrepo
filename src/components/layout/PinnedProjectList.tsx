import { X } from 'lucide-react';
import { PinnedProjectRecord } from '../../types/atlas';
import { formatDelta, scoreTone } from '../ui/scoreTone';

interface PinnedProjectListProps {
  pinnedProjects: PinnedProjectRecord[];
  onSelectPinned: (record: PinnedProjectRecord) => void;
  onUnpinProject: (slug: string) => void;
}

export function PinnedProjectList({ pinnedProjects, onSelectPinned, onUnpinProject }: PinnedProjectListProps) {
  return (
    <ul className="surface divide-y" style={{ borderColor: 'var(--border-hairline)' }}>
      {pinnedProjects.map((pin) => {
        const delta = pin.scores.overall - pin.baselineScores.overall;
        return (
          <li key={pin.slug} className="group flex items-center gap-2 pr-2" style={{ borderColor: 'var(--border-hairline)' }}>
            <button
              type="button"
              onClick={() => onSelectPinned(pin)}
              className="flex-1 min-w-0 flex items-center gap-3 px-4 py-3 text-left cursor-pointer rounded-[9px] transition-colors hover:bg-[var(--bg-elevated)]"
            >
              <span className={`tone-dot ${scoreTone(pin.scores.overall)}`} aria-hidden="true" />
              <span className="font-mono-code text-[0.8125rem] truncate flex-1">{pin.slug}</span>
              <span className="font-mono-code text-[0.75rem] text-muted tabular-nums hidden sm:inline">
                {pin.findingsCount} {pin.findingsCount === 1 ? 'finding' : 'findings'}
              </span>
              {delta !== 0 && (
                <span className={`font-mono-code text-[0.75rem] tabular-nums tone-text ${delta > 0 ? 'tone-success' : 'tone-danger'}`}>
                  {formatDelta(delta)}
                </span>
              )}
              <span className="font-mono-code text-[0.8125rem] tabular-nums w-7 text-right">{pin.scores.overall}</span>
            </button>
            <button
              type="button"
              onClick={() => onUnpinProject(pin.slug)}
              aria-label={`Unpin ${pin.slug}`}
              className="btn btn-ghost btn-icon btn-sm opacity-60 group-hover:opacity-100 focus-visible:opacity-100"
            >
              <X size={14} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
