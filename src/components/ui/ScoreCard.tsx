import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { formatDelta, scoreLabel, scoreTone } from './scoreTone';

interface ScoreCardProps {
  label: string;
  /** One plain-language line: what this number measures. */
  description: string;
  score: number;
  delta?: number;
  suffix?: string;
  subtitle: string;
  actionLabel?: string;
  isMetric?: boolean;
  isActive?: boolean;
  onClick?: () => void;
  icon: React.ReactNode;
}

export function ScoreCard({
  label,
  description,
  score,
  delta,
  suffix = '/100',
  subtitle,
  actionLabel,
  isMetric = false,
  isActive = false,
  onClick,
  icon,
}: ScoreCardProps) {
  const tone = isMetric ? 'tone-neutral' : scoreTone(score);
  const isImprovement = delta !== undefined && (isMetric ? delta < 0 : delta > 0);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      className="atlas-interactive-card surface group w-full h-full text-left p-4 cursor-pointer flex flex-col gap-3"
      style={isActive ? { borderColor: 'color-mix(in srgb, var(--text-primary) 38%, transparent)' } : undefined}
    >
      <div className="w-full flex items-start justify-between gap-2">
        <span className="min-w-0">
          <span className="block text-[0.8125rem] text-secondary">{label}</span>
          <span className="block text-[0.71875rem] text-muted leading-snug mt-0.5">{description}</span>
        </span>
        <span className="text-muted shrink-0 mt-0.5" aria-hidden="true">{icon}</span>
      </div>

      <div className="flex items-baseline gap-1.5 font-mono-code tabular-nums">
        <span className="text-[1.75rem] leading-none font-medium tracking-tight">{score.toLocaleString()}</span>
        {suffix && <span className="text-[0.75rem] text-muted">{suffix}</span>}
        {delta !== undefined && delta !== 0 && (
          <span className={`chip tone-chip ml-1 ${isImprovement ? 'tone-success' : 'tone-danger'}`} title="Change since you pinned this project">
            {formatDelta(delta)}
          </span>
        )}
      </div>

      {!isMetric && (
        <div className={`meter w-full ${tone}`} aria-hidden="true">
          <span style={{ width: `${Math.min(100, Math.max(3, score))}%` }} />
        </div>
      )}

      <div className="w-full flex items-center justify-between gap-2 mt-auto">
        <p className="text-[0.75rem] text-muted truncate">
          {!isMetric && <span className={`tone-text ${tone}`}>{scoreLabel(score)}</span>}
          {!isMetric && ' · '}
          {subtitle}
        </p>
        {actionLabel && (
          <span className="inline-flex items-center gap-0.5 text-[0.75rem] text-muted shrink-0 transition-colors group-hover:text-[var(--text-primary)]">
            {actionLabel}
            <ArrowUpRight size={12} strokeWidth={1.75} aria-hidden="true" />
          </span>
        )}
      </div>
    </button>
  );
}
