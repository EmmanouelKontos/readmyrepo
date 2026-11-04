import { Coffee, X } from 'lucide-react';

const AUTHOR_URL = 'https://github.com/EmmanouelKontos';
const SUPPORT_URL = 'https://buymeacoffee.com/emmanouilkontos';

export function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div role="alert" className="tone-callout tone-danger flex items-start justify-between gap-3 px-4 py-3 text-[0.875rem] atlas-fade-in">
      <span>{message}</span>
      <button type="button" onClick={onDismiss} aria-label="Dismiss error" className="btn btn-ghost btn-icon btn-sm -my-1 -mr-2">
        <X size={14} strokeWidth={1.75} aria-hidden="true" />
      </button>
    </div>
  );
}

const FOOTER_LINK = 'underline-offset-2 hover:underline hover:text-[var(--text-primary)] transition-colors';

export function AppFooter() {
  return (
    <footer className="divider-t mt-10">
      <div className="max-w-[1480px] mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-[0.8125rem] text-muted">
        <span>ReadMyRepo · Runs entirely in your browser</span>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span>
            Made by{' '}
            <a href={AUTHOR_URL} target="_blank" rel="noopener noreferrer" className={`text-secondary ${FOOTER_LINK}`}>
              Emmanouil Kontos
            </a>
          </span>
          <a href={SUPPORT_URL} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-1.5 ${FOOTER_LINK}`}>
            <Coffee size={14} strokeWidth={1.75} aria-hidden="true" />
            Support this project
          </a>
          <span className="hidden sm:inline-flex items-center gap-1.5"><kbd>⌘K</kbd> to search</span>
        </div>
      </div>
    </footer>
  );
}
