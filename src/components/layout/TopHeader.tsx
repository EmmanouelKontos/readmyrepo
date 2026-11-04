import { HelpCircle, Layers, ListChecks, Moon, Search, Sparkles, Sun, X } from 'lucide-react';
import { BrandLogo } from '../ui/BrandLogo';
import { useColorScheme } from '../../hooks/useColorScheme';

export type WorkspaceTab = 'graph' | 'audit' | 'blueprint';

interface TopHeaderProps {
  activeTab: WorkspaceTab;
  findingsCount: number;
  repoSlug?: string;
  onSelectTab: (tab: WorkspaceTab) => void;
  onResetToHome?: () => void;
  onOpenCommandPalette: () => void;
  onOpenTour: () => void;
}

const NAV_ITEMS: Array<{ key: WorkspaceTab; label: string; Icon: typeof Layers }> = [
  { key: 'graph', label: 'Map', Icon: Layers },
  { key: 'audit', label: 'Findings', Icon: ListChecks },
  { key: 'blueprint', label: 'AI context', Icon: Sparkles },
];

export function TopHeader({
  activeTab,
  findingsCount,
  repoSlug,
  onSelectTab,
  onResetToHome,
  onOpenCommandPalette,
  onOpenTour,
}: TopHeaderProps) {
  const { isDark, toggle } = useColorScheme();

  return (
    <header
      className="sticky top-0 z-30 divider-b backdrop-blur-md"
      style={{ backgroundColor: 'color-mix(in srgb, var(--bg-canvas) 86%, transparent)' }}
    >
      <a href="#main-heading" className="skip-link visually-hidden">
        Skip to main content
      </a>

      <div className="max-w-[1480px] mx-auto h-14 px-4 sm:px-6 lg:px-8 grid grid-cols-[1fr_auto] md:grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onResetToHome}
            className="flex items-center gap-2 shrink-0 rounded-md cursor-pointer"
            title="Back to start"
          >
            <BrandLogo size={24} />
            <span className="font-semibold tracking-tight text-[1rem]">ReadMyRepo</span>
          </button>

          {repoSlug && (
            <div className="hidden sm:flex items-center gap-1 min-w-0 atlas-fade-in">
              <span className="text-muted select-none" aria-hidden="true">/</span>
              <span className="font-mono-code text-[0.875rem] truncate max-w-[18rem]" title={repoSlug}>
                {repoSlug}
              </span>
              {onResetToHome && (
                <button
                  type="button"
                  onClick={onResetToHome}
                  aria-label="Close repository"
                  className="btn btn-ghost btn-icon btn-sm"
                >
                  <X size={14} strokeWidth={1.75} aria-hidden="true" />
                </button>
              )}
            </div>
          )}
        </div>

        {repoSlug ? (
          <nav aria-label="Workspace views" className="segmented order-3 md:order-none col-span-2 md:col-span-1 justify-self-center hidden md:inline-flex">
            {NAV_ITEMS.map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                aria-current={activeTab === key ? 'page' : undefined}
                onClick={() => onSelectTab(key)}
              >
                <Icon size={14} strokeWidth={1.75} aria-hidden="true" />
                <span>{label}</span>
                {key === 'audit' && <span className="count">{findingsCount}</span>}
              </button>
            ))}
          </nav>
        ) : (
          <span className="hidden md:block" aria-hidden="true" />
        )}

        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={onOpenCommandPalette}
            className="btn btn-secondary gap-2 pl-2.5 pr-1.5 text-secondary"
            aria-label="Search modules and findings"
          >
            <Search size={14} strokeWidth={1.75} aria-hidden="true" />
            <span className="hidden lg:inline text-[0.875rem] pr-6">Search</span>
            <kbd>⌘K</kbd>
          </button>
          <button type="button" onClick={onOpenTour} className="btn btn-ghost btn-icon" aria-label="Open the quick tour" title="Quick tour">
            <HelpCircle size={16} strokeWidth={1.75} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={toggle}
            aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
            title={isDark ? 'Light theme' : 'Dark theme'}
            className="btn btn-ghost btn-icon"
          >
            {isDark ? <Sun size={16} strokeWidth={1.75} aria-hidden="true" /> : <Moon size={16} strokeWidth={1.75} aria-hidden="true" />}
          </button>
        </div>
      </div>

      {repoSlug && (
        <nav aria-label="Workspace views (compact)" className="md:hidden px-4 pb-2.5 flex">
          <div className="segmented w-full grid grid-cols-3">
            {NAV_ITEMS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                aria-current={activeTab === key ? 'page' : undefined}
                onClick={() => onSelectTab(key)}
                className="justify-center"
              >
                {label}
                {key === 'audit' && <span className="count">{findingsCount}</span>}
              </button>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}
