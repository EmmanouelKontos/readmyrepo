import { useEffect, useId, useRef, useState } from 'react';
import { Check, Copy, Edit3, FileCode, Wand2, X } from 'lucide-react';
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

export function CodeInspectorModal({
  node,
  findings,
  onApplyFileChange,
  onClose,
}: CodeInspectorModalProps) {
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

  const fileFindings = node ? findings.filter((f) => f.filePath === node.path) : [];
  const flaggedLines = new Set(fileFindings.map((f) => f.lineNumber));
  const lines = node ? node.content.split('\n').slice(0, 80) : [];

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
    setFixAppliedBanner('AI remediation applied — repository scores & dependency graph updated live.');
  }

  function handleSaveManualEdit() {
    if (!node || !onApplyFileChange) return;
    onApplyFileChange(node.path, draftCode);
    setIsEditing(false);
    setFixAppliedBanner('Live source edit applied — scores & audit findings recomputed.');
  }

  return (
    <dialog ref={dialogRef} {...({ closedby: 'any' } as Record<string, string>)} aria-labelledby={titleId} className="atlas-dialog">
      {node && (
        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 mb-4" style={{ borderBottom: '1px solid var(--border-hairline)' }}>
            <div className="flex flex-wrap items-center gap-2.5">
              <FileCode size={18} style={{ color: 'var(--accent-brand)' }} aria-hidden="true" />
              <h2 id={titleId} className="font-mono-code font-semibold text-sm">{node.path}</h2>
              <SeverityBadge severity={node.maxSeverity} />
              <span className="font-mono-code text-xs" style={{ color: 'var(--text-muted)' }}>{node.linesOfCode} LOC · ~{node.estimatedTokens} tokens</span>
            </div>

            <div className="flex items-center gap-2">
              {onApplyFileChange && fileFindings.length > 0 && (
                <button type="button" onClick={handleSimulateQuickFix} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white cursor-pointer" style={{ backgroundColor: 'var(--accent-brand)' }}>
                  <Wand2 size={13} aria-hidden="true" />
                  <span>Simulate AI Fix &amp; Re-Scan</span>
                </button>
              )}
              {onApplyFileChange && (
                <button type="button" onClick={() => setIsEditing((prev) => !prev)} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer" style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-hairline)' }}>
                  <Edit3 size={12} aria-hidden="true" />
                  <span>{isEditing ? 'View Lines' : 'Live Edit'}</span>
                </button>
              )}
              <button type="button" aria-label="Close source code inspector" onClick={() => dialogRef.current?.close()} className="p-1.5 rounded-lg cursor-pointer" style={{ color: 'var(--text-muted)' }}>
                <X size={18} aria-hidden="true" />
              </button>
            </div>
          </div>

          {fixAppliedBanner && (
            <div className="mb-3 px-3.5 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-xs font-medium text-emerald-700 dark:text-emerald-300">
              ✓ {fixAppliedBanner}
            </div>
          )}

          {fileFindings.length > 0 && (
            <div className="mb-4 space-y-2">
              {fileFindings.map((f) => (
                <div key={f.id} className="p-3 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-strong)' }}>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono-code font-semibold" style={{ color: 'var(--accent-brand)' }}>{f.ruleId} (Line {f.lineNumber}) — {f.title}</span>
                      <SeverityBadge severity={f.severity} />
                    </div>
                    <p style={{ color: 'var(--text-secondary)' }}>{f.remediation}</p>
                  </div>
                  <button type="button" onClick={() => copyFindingPrompt(f)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white shrink-0 cursor-pointer" style={{ backgroundColor: 'var(--accent-brand)' }}>
                    {copiedId === f.id ? <Check size={13} /> : <Copy size={13} />}
                    <span>{copiedId === f.id ? 'Copied Fix' : 'Copy AI Fix'}</span>
                  </button>
                </div>
              ))}
            </div>
          )}

          {isEditing ? (
            <div className="space-y-2.5">
              <textarea value={draftCode} onChange={(e) => setDraftCode(e.target.value)} rows={14} aria-label={`Edit source code for ${node.path}`} className="w-full rounded-xl p-3.5 font-mono-code text-xs leading-relaxed focus:outline-none" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }} />
              <div className="flex items-center justify-end gap-2">
                <button type="button" onClick={handleSaveManualEdit} className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white cursor-pointer" style={{ backgroundColor: 'var(--accent-brand)' }}>
                  Apply Edit &amp; Re-Analyze Live
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl overflow-auto max-h-[24rem] p-3.5 font-mono-code text-xs leading-relaxed" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-hairline)' }}>
              {lines.map((line, idx) => {
                const lineNo = idx + 1;
                return (
                  <div key={lineNo} className={`flex gap-3 px-2 py-0.5 rounded ${flaggedLines.has(lineNo) ? 'bg-red-500/15 font-semibold' : ''}`}>
                    <span className="w-8 text-right select-none tabular-nums" style={{ color: 'var(--text-muted)' }}>{lineNo}</span>
                    <span className="whitespace-pre">{line || ' '}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </dialog>
  );
}
