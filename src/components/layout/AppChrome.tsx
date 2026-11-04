import { X } from 'lucide-react';

export function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div role="alert" className="tone-callout tone-danger flex items-start justify-between gap-3 px-4 py-3 text-[0.8125rem] atlas-fade-in">
      <span>{message}</span>
      <button type="button" onClick={onDismiss} aria-label="Dismiss error" className="btn btn-ghost btn-icon btn-sm -my-1 -mr-2">
        <X size={14} strokeWidth={1.75} aria-hidden="true" />
      </button>
    </div>
  );
}

export function AppFooter() {
  return (
    <footer className="divider-t mt-10">
      <div className="max-w-[1480px] mx-auto px-4 sm:px-6 lg:px-8 h-12 flex items-center justify-between gap-3 text-[0.75rem] text-muted">
        <span>RepoAtlas · Runs entirely in your browser</span>
        <span className="hidden sm:inline-flex items-center gap-1.5"><kbd>⌘K</kbd> to search</span>
      </div>
    </footer>
  );
}
