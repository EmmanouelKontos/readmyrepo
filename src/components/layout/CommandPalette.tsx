import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { FileCode, LayoutGrid, Network, Search, ShieldAlert, type LucideIcon } from 'lucide-react';
import { AuditFinding, RepoNode } from '../../types/atlas';
import { SeverityBadge } from '../ui/SeverityBadge';

type PaletteTab = 'graph' | 'audit' | 'blueprint';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: RepoNode[];
  findings: AuditFinding[];
  onSelectNode: (node: RepoNode) => void;
  onJumpToTab: (tab: PaletteTab) => void;
}

type PaletteItem =
  | { kind: 'node'; id: string; node: RepoNode }
  | { kind: 'finding'; id: string; finding: AuditFinding }
  | { kind: 'view'; id: string; tab: PaletteTab; label: string; Icon: LucideIcon };

const ICON = { size: 15, strokeWidth: 1.75, 'aria-hidden': true } as const;
const GROUPS = [
  { kind: 'node', label: 'Modules' },
  { kind: 'finding', label: 'Findings' },
  { kind: 'view', label: 'Go to' },
] as const;

function ItemContent({ item }: { item: PaletteItem }) {
  if (item.kind === 'node') {
    return (
      <>
        <FileCode {...ICON} className="text-muted shrink-0" />
        <span className="font-mono-code min-w-0 flex-1 truncate text-[0.8125rem]">{item.node.path}</span>
        <span className="count">{item.node.linesOfCode} LOC</span>
        <SeverityBadge severity={item.node.maxSeverity} />
      </>
    );
  }
  if (item.kind === 'finding') {
    return (
      <>
        <ShieldAlert {...ICON} className="text-muted shrink-0" />
        <span className="min-w-0 flex-1 truncate">
          <span className="font-mono-code text-muted mr-2 text-xs">{item.finding.ruleId}</span>
          {item.finding.title}
        </span>
        <SeverityBadge severity={item.finding.severity} />
      </>
    );
  }
  return (
    <>
      <item.Icon {...ICON} className="text-muted shrink-0" />
      <span className="flex-1">{item.label}</span>
    </>
  );
}

export function CommandPalette({ isOpen, onClose, nodes, findings, onSelectNode, onJumpToTab }: CommandPaletteProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const listId = useId();
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);

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
  const views: PaletteItem[] = (
    [
      { kind: 'view', id: 'view-graph', tab: 'graph', label: 'Architecture graph', Icon: Network },
      { kind: 'view', id: 'view-audit', tab: 'audit', label: `Audit findings (${findings.length})`, Icon: ShieldAlert },
      { kind: 'view', id: 'view-blueprint', tab: 'blueprint', label: 'AGENTS.md export', Icon: LayoutGrid },
    ] satisfies PaletteItem[]
  ).filter((v) => !q || (v.kind === 'view' && v.label.toLowerCase().includes(q)));

  const items: PaletteItem[] = [
    ...matchingNodes.map((node): PaletteItem => ({ kind: 'node', id: `node-${node.id}`, node })),
    ...matchingFindings.map((finding): PaletteItem => ({ kind: 'finding', id: `finding-${finding.id}`, finding })),
    ...views,
  ];
  const safeIdx = Math.min(activeIdx, Math.max(0, items.length - 1));
  const activeItem = items[safeIdx];

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [safeIdx]);

  function runItem(item: PaletteItem) {
    if (item.kind === 'node') onSelectNode(item.node);
    else if (item.kind === 'finding') onJumpToTab('audit');
    else onJumpToTab(item.tab);
    dialogRef.current?.close();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (items.length === 0) return;
      const delta = e.key === 'ArrowDown' ? 1 : -1;
      setActiveIdx((safeIdx + delta + items.length) % items.length);
    } else if (e.key === 'Enter') {
      if (e.nativeEvent.isComposing || e.keyCode === 229) return;
      e.preventDefault();
      if (activeItem) runItem(activeItem);
    }
  }

  return (
    <dialog ref={dialogRef} {...({ closedby: 'any' } as Record<string, string>)} aria-labelledby={titleId} className="atlas-dialog" style={{ maxWidth: 'min(40rem, 94vw)', marginTop: '12vh' }}>
      <span id={titleId} className="visually-hidden">Command palette</span>
      <div className="divider-b flex items-center gap-3 px-4">
        <Search {...ICON} size={16} className="text-muted shrink-0" />
        <input
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={activeItem ? `${listId}-${activeItem.id}` : undefined}
          aria-labelledby={titleId}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setActiveIdx(0); }}
          onKeyDown={handleKeyDown}
          placeholder="Search modules, rules or views"
          className="h-14 w-full bg-transparent text-[0.9375rem] outline-none placeholder:text-[var(--text-muted)] focus-visible:outline-none"
          autoFocus
        />
        <button type="button" aria-label="Close command palette" onClick={() => dialogRef.current?.close()} className="kbd shrink-0 cursor-pointer">Esc</button>
      </div>

      <div ref={listRef} id={listId} role="listbox" aria-label="Results" className="max-h-[22rem] overflow-y-auto p-2">
        {items.length === 0 && <p className="text-muted px-3 py-8 text-center">No results for “{query.trim()}”</p>}
        {GROUPS.map((group) => {
          const groupItems = items.filter((it) => it.kind === group.kind);
          if (groupItems.length === 0) return null;
          return (
            <div key={group.kind} role="group" aria-label={group.label} className="pb-1">
              <div className="eyebrow flex items-center gap-1.5 px-3 pb-1 pt-2">
                {group.label} <span className="count">{groupItems.length}</span>
              </div>
              {groupItems.map((item) => {
                const isActive = item === activeItem;
                return (
                  <div key={item.id} id={`${listId}-${item.id}`} role="option" aria-selected={isActive} data-active={isActive} onMouseMove={() => !isActive && setActiveIdx(items.indexOf(item))} onClick={() => runItem(item)} className="flex h-9 cursor-pointer items-center gap-2.5 rounded-[6px] px-3" style={{ background: isActive ? 'var(--bg-elevated)' : 'transparent' }}>
                    <ItemContent item={item} />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="divider-t text-muted flex items-center gap-4 px-4 py-2.5 text-xs">
        <span className="flex items-center gap-1.5"><kbd>↑</kbd><kbd>↓</kbd> Navigate</span>
        <span className="flex items-center gap-1.5"><kbd>↵</kbd> Open</span>
        <span className="flex items-center gap-1.5"><kbd>Esc</kbd> Close</span>
      </div>
    </dialog>
  );
}
