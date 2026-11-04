import { useEffect, useId, useRef, useState } from 'react';
import { Check, CheckCircle2, Copy, FileCode, X } from 'lucide-react';
import { AuditFinding, RepoNode } from '../../types/atlas';
import { SeverityBadge } from '../../components/ui/SeverityBadge';
import { copyTextSafe } from '../../lib/clipboard';
import { applyQuickRemediationToCode } from '../../lib/snapshotTracker';

interface CodeInspectorModalProps {
  node: RepoNode | null;
  findings: AuditFinding[];
  onApplyFileChange?: (filePath: string, newContent: string) => void;
  onClose: () => void;
}

const ICON = { size: 14, strokeWidth: 1.75, 'aria-hidden': true } as const;
const CODE_BOX = { background: 'var(--bg-elevated)', border: '1px solid var(--border-hairline)' } as const;
const MAX_LINES = 80;
const FLAGGED_ROW = { background: 'color-mix(in srgb, var(--tone-danger) 8%, transparent)', borderLeftColor: 'var(--tone-danger)' } as const;

function CodeLines({ lines, flagged }: { lines: string[]; flagged: Set<number> }) {
  return (
    <div tabIndex={0} aria-label="Source code" className="font-mono-code max-h-[24rem] overflow-auto rounded-[8px] py-2 text-[12.5px] leading-relaxed" style={CODE_BOX}>
      {lines.map((line, idx) => {
        const lineNo = idx + 1;
        const isFlagged = flagged.has(lineNo);
        return (
          <div key={lineNo} className="flex gap-4 border-l-2 pl-2.5 pr-3" style={isFlagged ? FLAGGED_ROW : { borderLeftColor: 'transparent' }}>
            <span className="w-8 shrink-0 select-none text-right tabular-nums" style={{ color: isFlagged ? 'var(--tone-danger)' : 'var(--text-muted)' }}>{lineNo}</span>
            <span className="whitespace-pre">{line || ' '}</span>
          </div>
        );
      })}
    </div>
  );
}

export function CodeInspectorModal({ node, findings, onApplyFileChange, onClose }: CodeInspectorModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [draftCode, setDraftCode] = useState('');
  const [fixAppliedBanner, setFixAppliedBanner] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (node) {
      setDraftCode(node.content);
      setIsEditing(false);
      setFixAppliedBanner(null);
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [node]);

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
        const inside = rect.top <= event.clientY && event.clientY <= rect.top + rect.height &&
          rect.left <= event.clientX && event.clientX <= rect.left + rect.width;
        if (!inside) dialog.close();
      };
      dialog.addEventListener('click', handleBackdropClick);
    }

    return () => {
      dialog.removeEventListener('close', handleClose);
      if (handleBackdropClick) dialog.removeEventListener('click', handleBackdropClick);
    };
  }, [onClose]);

  const fileFindings = node ? findings.filter((f) => f.filePath === node.path) : [];
  const flaggedLines = new Set(fileFindings.map((f) => f.lineNumber));
  const allLines = node ? node.content.split('\n') : [];
  const canFix = Boolean(onApplyFileChange) && fileFindings.length > 0;

  async function copyFindingPrompt(finding: AuditFinding) {
    await copyTextSafe(finding.aiFixPrompt);
    setCopiedId(finding.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function handleSimulateQuickFix() {
    if (!node || !onApplyFileChange) return;
    const remediated = applyQuickRemediationToCode(node.path, node.content, findings);
    setDraftCode(remediated);
    onApplyFileChange(node.path, remediated);
    setFixAppliedBanner('Fix applied. Scores and the dependency graph are updated.');
  }

  function handleSaveManualEdit() {
    if (!node || !onApplyFileChange) return;
    onApplyFileChange(node.path, draftCode);
    setIsEditing(false);
    setFixAppliedBanner('Edit applied. Scores and findings are recomputed.');
  }

  const closeDialog = () => dialogRef.current?.close();

  return (
    <dialog ref={dialogRef} {...({ closedby: 'any' } as Record<string, string>)} aria-labelledby={titleId} className="atlas-dialog">
      {node && (
        <div className="flex max-h-[min(88vh,52rem)] flex-col">
          <header className="divider-b flex items-start justify-between gap-3 px-5 py-4">
            <div className="flex min-w-0 items-start gap-2.5">
              <FileCode {...ICON} size={16} className="text-muted mt-0.5 shrink-0" />
              <div className="min-w-0 space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 id={titleId} className="font-mono-code truncate text-[0.875rem] font-semibold">{node.path}</h2>
                  <SeverityBadge severity={node.maxSeverity} />
                </div>
                <p className="text-muted text-xs tabular-nums">
                  {node.linesOfCode} lines · ~{node.estimatedTokens} tokens · {fileFindings.length} {fileFindings.length === 1 ? 'finding' : 'findings'}
                </p>
              </div>
            </div>
            <button type="button" aria-label="Close source code inspector" onClick={closeDialog} className="btn btn-ghost btn-icon btn-sm shrink-0">
              <X {...ICON} size={16} />
            </button>
          </header>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            {fixAppliedBanner && (
              <div role="status" className="tone-success tone-callout atlas-fade-in flex items-center gap-2 px-3 py-2 text-[0.8125rem]">
                <CheckCircle2 {...ICON} className="tone-text shrink-0" /><span>{fixAppliedBanner}</span>
              </div>
            )}

            {fileFindings.length > 0 && (
              <ul className="space-y-2">
                {fileFindings.map((f) => (
                  <li key={f.id} className="surface-quiet flex flex-col justify-between gap-3 p-3 sm:flex-row sm:items-center">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <SeverityBadge severity={f.severity} />
                        <span className="text-[0.8125rem] font-medium">{f.title}</span>
                        <span className="font-mono-code text-muted text-xs">{f.ruleId} · line {f.lineNumber}</span>
                      </div>
                      <p className="text-secondary text-[0.8125rem]">{f.remediation}</p>
                    </div>
                    <button type="button" onClick={() => copyFindingPrompt(f)} className="btn btn-ghost btn-sm shrink-0" aria-live="polite">
                      {copiedId === f.id ? <Check {...ICON} className="tone-success tone-text" /> : <Copy {...ICON} />}
                      <span>{copiedId === f.id ? 'Copied' : 'Copy prompt'}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="eyebrow">Source</span>
                {onApplyFileChange && (
                  <div className="segmented segmented-sm" role="group" aria-label="Source mode">
                    <button type="button" aria-pressed={!isEditing} onClick={() => setIsEditing(false)}>View</button><button type="button" aria-pressed={isEditing} onClick={() => setIsEditing(true)}>Edit</button>
                  </div>
                )}
              </div>
              {isEditing ? (
                <textarea value={draftCode} onChange={(e) => setDraftCode(e.target.value)} rows={14} aria-label={`Edit source code for ${node.path}`} spellCheck={false} className="font-mono-code block w-full resize-y rounded-[8px] p-3.5 text-[12.5px] leading-relaxed" style={{ ...CODE_BOX, color: 'var(--text-primary)' }} />
              ) : (
                <CodeLines lines={allLines.slice(0, MAX_LINES)} flagged={flaggedLines} />
              )}
            </div>
          </div>

          <footer className="divider-t flex flex-wrap items-center justify-between gap-3 px-5 py-3">
            <span className="text-muted text-xs tabular-nums">
              {!isEditing && allLines.length > MAX_LINES ? `Showing first ${MAX_LINES} of ${allLines.length} lines` : ''}
            </span>
            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  {canFix && <button type="button" onClick={handleSimulateQuickFix} className="btn btn-secondary">Apply suggested fix</button>}
                  <button type="button" onClick={handleSaveManualEdit} className="btn btn-primary">Apply edit</button>
                </>
              ) : (
                <>
                  <button type="button" onClick={closeDialog} className="btn btn-secondary">Close</button>
                  {canFix && <button type="button" onClick={handleSimulateQuickFix} className="btn btn-primary">Apply suggested fix</button>}
                </>
              )}
            </div>
          </footer>
        </div>
      )}
    </dialog>
  );
}
