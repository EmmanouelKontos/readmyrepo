import { useEffect, useId, useRef, useState } from 'react';
import { FileCode, Search, ShieldAlert, Sparkles, X } from 'lucide-react';
import { AuditFinding, RepoNode } from '../../types/atlas';
import { SeverityBadge } from '../ui/SeverityBadge';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: RepoNode[];
  findings: AuditFinding[];
  onSelectNode: (node: RepoNode) => void;
  onJumpToTab: (tab: 'graph' | 'audit' | 'blueprint') => void;
}

export function CommandPalette({
  isOpen,
  onClose,
  nodes,
  findings,
  onSelectNode,
  onJumpToTab,
}: CommandPaletteProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [query, setQuery] = useState('');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    else if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => onClose();
    dialog.addEventListener('close', handleClose);

    let handleBackdropClick: ((event: MouseEvent) => void) | undefined;
    if (!('closedBy' in HTMLDialogElement.prototype)) {
      handleBackdropClick = (event: MouseEvent) => {
        if (event.target !== dialog) return;
        const rect = dialog.getBoundingClientRect();
        const inside =
          rect.top <= event.clientY &&
          event.clientY <= rect.top + rect.height &&
          rect.left <= event.clientX &&
          event.clientX <= rect.left + rect.width;
        if (!inside) dialog.close();
      };
      dialog.addEventListener('click', handleBackdropClick);
    }

    return () => {
      dialog.removeEventListener('close', handleClose);
      if (handleBackdropClick) dialog.removeEventListener('click', handleBackdropClick);
    };
  }, [onClose]);

  const q = query.trim().toLowerCase();
  const matchingNodes = nodes.filter((n) => !q || n.path.toLowerCase().includes(q)).slice(0, 6);
  const matchingFindings = findings
    .filter((f) => !q || f.title.toLowerCase().includes(q) || f.ruleId.toLowerCase().includes(q))
    .slice(0, 4);

  return (
    <dialog
      ref={dialogRef}
      {...({ closedby: 'any' } as Record<string, string>)}
      aria-labelledby={titleId}
      className="atlas-dialog"
    >
      <div className="p-5">
        <div
          className="flex items-center justify-between pb-3.5 mb-3.5"
          style={{ borderBottom: '1px solid var(--border-hairline)' }}
        >
          <div className="flex items-center gap-2.5 flex-1">
            <Search size={16} strokeWidth={1.7} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (e.nativeEvent.isComposing || e.keyCode === 229) return;
                  e.preventDefault();
                  if (matchingNodes.length > 0) {
                    onSelectNode(matchingNodes[0]);
                    dialogRef.current?.close();
                  } else if (matchingFindings.length > 0) {
                    onJumpToTab('audit');
                    dialogRef.current?.close();
                  }
                }
              }}
              placeholder="Jump to module, security rule, or export blueprint (Press Enter)..."
              aria-labelledby={titleId}
              className="w-full bg-transparent text-sm focus:outline-none"
              autoFocus
            />
          </div>
          <span id={titleId} className="visually-hidden">
            Command Palette Search
          </span>
          <button
            type="button"
            aria-label="Close command palette"
            onClick={() => dialogRef.current?.close()}
            className="p-1.5 rounded-lg cursor-pointer"
            style={{ color: 'var(--text-muted)' }}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
          {(
            [
              ['graph', '01 · Architecture Graph', Sparkles],
              ['audit', `02 · Security & Perf (${findings.length})`, ShieldAlert],
              ['blueprint', '03 · Export AGENTS.md', FileCode],
            ] as const
          ).map(([tab, label, Icon]) => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                onJumpToTab(tab);
                dialogRef.current?.close();
              }}
              className="flex items-center gap-2 p-2.5 rounded-xl text-xs font-semibold text-left cursor-pointer"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                border: '1px solid var(--border-hairline)',
              }}
            >
              <Icon size={14} style={{ color: 'var(--accent-brand)' }} aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        <div className="mb-4 space-y-1.5">
          <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
            Repository Modules ({matchingNodes.length})
          </p>
          {matchingNodes.map((node) => (
            <button
              key={node.id}
              type="button"
              onClick={() => {
                onSelectNode(node);
                dialogRef.current?.close();
              }}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs cursor-pointer"
              style={{ backgroundColor: 'var(--bg-elevated)' }}
            >
              <span className="font-mono-code font-medium truncate">{node.path}</span>
              <div className="flex items-center gap-2">
                <span className="font-mono-code text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {node.linesOfCode} LOC
                </span>
                <SeverityBadge severity={node.maxSeverity} />
              </div>
            </button>
          ))}
        </div>

        {matchingFindings.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Audit Findings ({matchingFindings.length})
            </p>
            {matchingFindings.map((finding) => (
              <button
                key={finding.id}
                type="button"
                onClick={() => {
                  onJumpToTab('audit');
                  dialogRef.current?.close();
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs cursor-pointer"
                style={{ backgroundColor: 'var(--bg-elevated)' }}
              >
                <span className="truncate">
                  <strong className="font-mono-code mr-1.5">{finding.ruleId}</strong>
                  {finding.title}
                </span>
                <SeverityBadge severity={finding.severity} />
              </button>
            ))}
          </div>
        )}
      </div>
    </dialog>
  );
}
