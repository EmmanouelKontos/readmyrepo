import React from 'react';
import { ArrowUpRight } from 'lucide-react';

interface ScoreCardProps {
  label: string;
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
  const toneColor = isMetric
    ? 'text-stone-900 dark:text-stone-100'
    : score >= 85
    ? 'text-emerald-700 dark:text-emerald-400'
    : score >= 65
    ? 'text-amber-700 dark:text-amber-400'
    : 'text-red-700 dark:text-red-400';

  const barColor = isMetric
    ? 'var(--accent-brand)'
    : score >= 85
    ? '#10B981'
    : score >= 65
    ? '#F59E0B'
    : '#EF4444';

  const statusText = isMetric
    ? 'Context Ready'
    : score >= 85
    ? 'Healthy'
    : score >= 65
    ? 'Needs Review'
    : 'Action Required';

  const percentage = isMetric ? 100 : Math.min(100, Math.max(8, score));

  return (
    <button
      type="button"
      onClick={onClick}
      className="atlas-interactive-card group w-full h-full text-left p-4 sm:p-5 rounded-xl cursor-pointer flex flex-col justify-between"
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: isActive
          ? '1px solid var(--accent-brand)'
          : '1px solid var(--border-hairline)',
        boxShadow: isActive ? '0 2px 10px rgba(0, 0, 0, 0.05)' : 'none',
      }}
    >
      <div className="w-full">
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <span
            className="text-xs font-semibold tracking-tight"
            style={{ color: 'var(--text-secondary)' }}
          >
            {label}
          </span>
          <span
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              color: 'var(--accent-brand)',
            }}
          >
            {icon}
          </span>
        </div>

        <div className="flex items-baseline justify-between gap-2">
          <div className="flex items-baseline gap-1.5 font-mono-code tabular-nums">
            <span className={`text-2xl sm:text-3xl font-bold tracking-tight ${toneColor}`}>
              {score.toLocaleString()}
            </span>
            {suffix && (
              <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                {suffix}
              </span>
            )}
            {delta !== undefined && delta !== 0 && (
              <span
                className={`text-[0.68rem] font-bold px-1.5 py-0.5 rounded-md ${
                  (isMetric ? delta < 0 : delta > 0)
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                    : 'bg-red-500/15 text-red-700 dark:text-red-300'
                }`}
                title="Change since initial baseline scan"
              >
                {delta > 0 ? `+${delta}` : delta}
              </span>
            )}
          </div>
          <span
            className="text-[0.7rem] font-mono-code font-medium px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              color: 'var(--text-secondary)',
            }}
          >
            {statusText}
          </span>
        </div>

        {/* Subtle health bar */}
        <div
          className="w-full h-1.5 rounded-full overflow-hidden mt-3 mb-2.5"
          style={{ backgroundColor: 'var(--bg-elevated)' }}
          aria-hidden="true"
        >
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${percentage}%`,
              backgroundColor: barColor,
            }}
          />
        </div>
      </div>

      <div className="w-full flex items-center justify-between gap-2 pt-1">
        <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
          {subtitle}
        </p>
        {actionLabel && (
          <span
            className="inline-flex items-center gap-0.5 text-xs font-semibold shrink-0 group-hover:translate-x-0.5 transition-transform"
            style={{ color: 'var(--accent-brand)' }}
          >
            <span>{actionLabel}</span>
            <ArrowUpRight size={13} aria-hidden="true" />
          </span>
        )}
      </div>
    </button>
  );
}
