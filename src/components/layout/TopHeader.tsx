import { useEffect, useState } from 'react';
import { HelpCircle, Layers, Moon, Search, ShieldAlert, Sparkles, Sun } from 'lucide-react';
import { RepoAtlasLogo } from '../ui/RepoAtlasLogo';

export type WorkspaceTab = 'graph' | 'audit' | 'blueprint';

interface TopHeaderProps {
  activeTab: WorkspaceTab;
  findingsCount: number;
  onSelectTab: (tab: WorkspaceTab) => void;
  onResetToHome?: () => void;
  onOpenCommandPalette: () => void;
  onOpenTour: () => void;
}

export function TopHeader({
  activeTab,
  findingsCount,
  onSelectTab,
  onResetToHome,
  onOpenCommandPalette,
  onOpenTour,
}: TopHeaderProps) {
  const [resolvedDark, setResolvedDark] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const computeRenderedScheme = () => {
      const meta = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
      const content = meta?.content ?? 'light dark';
      if (content === 'dark') setResolvedDark(true);
      else if (content === 'light') setResolvedDark(false);
      else setResolvedDark(mq.matches);
    };

    computeRenderedScheme();
    mq.addEventListener('change', computeRenderedScheme);
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'color-scheme') {
        const meta = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
        if (meta) meta.content = e.newValue ?? 'light dark';
        computeRenderedScheme();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => {
      mq.removeEventListener('change', computeRenderedScheme);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  function handleToggleColorScheme() {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const systemScheme = mq.matches ? 'dark' : 'light';
    const targetScheme = resolvedDark ? 'light' : 'dark';
    const meta = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
    try {
      if (targetScheme === systemScheme) {
        localStorage.removeItem('color-scheme');
        if (meta) meta.content = 'light dark';
      } else {
        localStorage.setItem('color-scheme', targetScheme);
        if (meta) meta.content = targetScheme;
      }
    } catch {
      if (meta) meta.content = targetScheme;
    }
    setResolvedDark(targetScheme === 'dark');
  }

  const navItems: Array<{
    key: WorkspaceTab;
    step: string;
    label: string;
    shortLabel: string;
    badge?: string;
    Icon: typeof Layers;
  }> = [
    { key: 'graph', step: '01', label: 'Architecture Map', shortLabel: 'Map', Icon: Layers },
    {
      key: 'audit',
      step: '02',
      label: 'Security & Perf Audit',
      shortLabel: 'Audit',
      badge: String(findingsCount),
      Icon: ShieldAlert,
    },
    { key: 'blueprint', step: '03', label: 'AGENTS.md & AI Fix', shortLabel: 'AI Fix', Icon: Sparkles },
  ];

  return (
    <header
      className="sticky top-0 z-30 px-4 sm:px-6 lg:px-10 py-2.5 backdrop-blur-md"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--bg-canvas) 90%, transparent)',
        borderBottom: '1px solid var(--border-hairline)',
      }}
    >
      <a href="#main-heading" className="skip-link visually-hidden">
        Skip to main content
      </a>

      <div className="max-w-[1640px] mx-auto flex flex-wrap lg:grid lg:grid-cols-[1fr_auto_1fr] items-center justify-between gap-2.5">
        <button
          type="button"
          onClick={onResetToHome}
          className="flex items-center gap-2.5 shrink-0 lg:justify-self-start cursor-pointer text-left"
          title="Return to RepoAtlas Launchpad"
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{
              backgroundColor: 'var(--accent-brand-soft)',
              border: '1px solid var(--border-strong)',
            }}
          >
            <RepoAtlasLogo size={22} />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-display font-bold text-base tracking-tight">RepoAtlas</span>
            <span
              className="font-mono-code text-xs px-2 py-0.5 rounded-md font-medium hidden sm:inline-block"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-hairline)',
              }}
            >
              AST + AI Guardrails
            </span>
          </div>
        </button>

        <nav
          aria-label="Primary"
          className="order-3 lg:order-2 w-full lg:w-auto lg:justify-self-center grid grid-cols-3 lg:flex items-center gap-1 p-1 rounded-xl"
          style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-hairline)' }}
        >
          {navItems.map(({ key, step, label, shortLabel, badge, Icon }) => {
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onSelectTab(key)}
                className="flex items-center justify-center lg:justify-start gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium cursor-pointer transition-all whitespace-nowrap"
                style={{
                  backgroundColor: isActive ? 'var(--bg-surface)' : 'transparent',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  boxShadow: isActive ? '0 1px 2px rgba(0, 0, 0, 0.06)' : 'none',
                }}
              >
                <span className="font-mono-code text-xs font-semibold" style={{ color: isActive ? 'var(--accent-brand)' : 'var(--text-muted)' }}>
                  {step}
                </span>
                <Icon size={14} strokeWidth={1.7} className="hidden sm:inline shrink-0" aria-hidden="true" />
                <span className="sm:hidden">{shortLabel}</span>
                <span className="hidden sm:inline">{label}</span>
                {badge !== undefined && (
                  <span
                    className="font-mono-code text-xs px-1.5 py-0.2 rounded-full font-semibold"
                    style={{
                      backgroundColor: isActive ? 'var(--accent-brand-soft)' : 'var(--bg-subtle)',
                      color: isActive ? 'var(--accent-brand)' : 'var(--text-secondary)',
                    }}
                  >
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="order-2 lg:order-3 flex items-center gap-2 shrink-0 lg:justify-self-end">
          <button
            type="button"
            onClick={onOpenTour}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors"
            style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-hairline)', color: 'var(--text-secondary)' }}
          >
            <HelpCircle size={14} strokeWidth={1.75} style={{ color: 'var(--accent-brand)' }} aria-hidden="true" />
            <span className="hidden sm:inline">Quick Tour</span>
          </button>

          <button
            type="button"
            onClick={onOpenCommandPalette}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium cursor-pointer transition-colors"
            style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-strong)', color: 'var(--text-secondary)' }}
          >
            <Search size={14} strokeWidth={1.75} aria-hidden="true" />
            <span className="hidden xl:inline">Search</span>
            <kbd
              className="font-mono-code text-xs px-1.5 py-0.5 rounded"
              style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-hairline)' }}
            >
              ⌘K
            </kbd>
          </button>

          <button
            type="button"
            onClick={handleToggleColorScheme}
            aria-label={resolvedDark ? 'Switch to light theme' : 'Switch to dark theme'}
            className="p-2 rounded-lg cursor-pointer transition-colors"
            style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-hairline)', color: 'var(--text-primary)' }}
          >
            {resolvedDark ? <Sun size={16} strokeWidth={1.75} aria-hidden="true" /> : <Moon size={16} strokeWidth={1.75} aria-hidden="true" />}
          </button>
        </div>
      </div>
    </header>
  );
}
