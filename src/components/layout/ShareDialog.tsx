import { useRef, useState } from 'react';
import { Check, Copy, Share2, X } from 'lucide-react';
import { badgeHtml, badgeImageUrl, badgeMarkdown, reportUrl, xShareUrl } from '../../lib/badge';
import { copyTextSafe } from '../../lib/clipboard';

interface ShareDialogProps {
  /** Public GitHub slug (owner/repo or owner/repo/path) the report link re-scans. */
  repoSlug: string;
  score: number;
}

type SnippetFormat = 'markdown' | 'html';
type Copied = 'badge' | 'link' | null;

const ICON = { size: 14, strokeWidth: 1.75, 'aria-hidden': true } as const;

function XLogo() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

/** "Share" button plus a dialog: README badge, report link, and a prefilled X post. */
export function ShareDialog({ repoSlug, score }: ShareDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [format, setFormat] = useState<SnippetFormat>('markdown');
  const [copied, setCopied] = useState<Copied>(null);
  const snippet = format === 'markdown' ? badgeMarkdown(repoSlug, score) : badgeHtml(repoSlug, score);
  const link = reportUrl(repoSlug);

  async function copy(text: string, what: Exclude<Copied, null>) {
    await copyTextSafe(text);
    setCopied(what);
    window.setTimeout(() => setCopied((cur) => (cur === what ? null : cur)), 1800);
  }

  const CopyButton = ({ text, what, label }: { text: string; what: Exclude<Copied, null>; label: string }) => (
    <button type="button" onClick={() => void copy(text, what)} className="btn btn-secondary btn-sm shrink-0" aria-live="polite">
      {copied === what ? <Check {...ICON} className="tone-success tone-text" /> : <Copy {...ICON} />}
      {copied === what ? 'Copied' : label}
    </button>
  );

  return (
    <>
      <button type="button" onClick={() => dialogRef.current?.showModal()} className="btn btn-secondary" title="Get a README badge, a link to this report, or post it on X">
        <Share2 {...ICON} />
        Share
      </button>

      <dialog ref={dialogRef} closedby="any" aria-labelledby="share-title" className="atlas-dialog text-left" style={{ maxWidth: 'min(36rem, 94vw)' }}>
        <header className="flex items-center justify-between gap-3 px-5 pt-4">
          <h2 id="share-title" className="text-lg font-semibold tracking-tight">Share this report</h2>
          <button type="button" onClick={() => dialogRef.current?.close()} aria-label="Close" className="btn btn-ghost btn-icon btn-sm">
            <X size={16} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </header>

        <div className="space-y-6 px-5 pb-5 pt-3">
          <section className="space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="heading-section">README badge</h3>
              <div className="segmented segmented-sm" role="group" aria-label="Snippet format">
                <button type="button" aria-pressed={format === 'markdown'} onClick={() => setFormat('markdown')}>Markdown</button>
                <button type="button" aria-pressed={format === 'html'} onClick={() => setFormat('html')}>HTML</button>
              </div>
            </div>
            <p className="text-[0.875rem] text-secondary">
              Paste this at the top of your README. The badge shows today's score and links to this live report.
            </p>
            <div className="surface-quiet px-3 py-3 flex items-center justify-center">
              <img src={badgeImageUrl(score)} alt={`ReadMyRepo score: ${score}/100`} height={20} />
            </div>
            <div className="flex items-start gap-2">
              <code className="code-inline block flex-1 min-w-0 break-all text-[0.8125rem] leading-relaxed py-2 px-2.5 max-h-28 overflow-y-auto" tabIndex={0}>{snippet}</code>
              <CopyButton text={snippet} what="badge" label="Copy" />
            </div>
          </section>

          <section className="space-y-2.5">
            <h3 className="heading-section">Link to this report</h3>
            <div className="flex items-center gap-2">
              <div className="field flex-1 min-w-0">
                <input type="text" readOnly value={link} aria-label="Report link" onFocus={(e) => e.currentTarget.select()} className="font-mono-code text-[0.8125rem]" />
              </div>
              <CopyButton text={link} what="link" label="Copy link" />
            </div>
          </section>

          <section className="space-y-2">
            <a href={xShareUrl(repoSlug, score)} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
              <XLogo />
              Post on X
            </a>
            <p className="text-[0.8125rem] text-muted">Opens X with a ready-made post. Nothing is posted until you press Post there.</p>
          </section>
        </div>
      </dialog>
    </>
  );
}
