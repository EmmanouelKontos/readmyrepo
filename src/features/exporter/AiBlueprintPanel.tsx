import { useState, type ReactNode } from 'react';
import { Check, Copy, Download, FileText, Terminal } from 'lucide-react';
import { copyTextSafe } from '../../lib/clipboard';

interface AiBlueprintPanelProps {
  repoName: string;
  agentsMdBlueprint: string;
  masterFixPrompt: string;
}

interface BlueprintCardProps {
  icon: ReactNode;
  title: ReactNode;
  description: ReactNode;
  actions: ReactNode;
  body: string;
  bodyLabel: string;
}

const ICON_PROPS = { size: 15, strokeWidth: 1.75, 'aria-hidden': true } as const;

function BlueprintCard({ icon, title, description, actions, body, bodyLabel }: BlueprintCardProps) {
  return (
    <section className="surface flex min-w-0 flex-col">
      <header className="divider-b flex items-start justify-between gap-4 p-4 sm:p-5">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-muted flex">{icon}</span>
            <h3 className="heading-section">{title}</h3>
          </div>
          <p className="text-secondary measure-readable text-[0.8125rem]">{description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">{actions}</div>
      </header>
      <div className="p-4 sm:p-5">
        <pre
          aria-label={bodyLabel}
          tabIndex={0}
          className="font-mono-code max-h-[26rem] overflow-auto whitespace-pre-wrap rounded-[8px] p-4 text-[12.5px] leading-relaxed"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-hairline)' }}
        >
          {body}
        </pre>
      </div>
    </section>
  );
}

function CopiedIcon() {
  return (
    <span className="tone-success tone-text flex">
      <Check {...ICON_PROPS} size={14} />
    </span>
  );
}

export function AiBlueprintPanel({
  repoName,
  agentsMdBlueprint,
  masterFixPrompt,
}: AiBlueprintPanelProps) {
  const [copiedAgents, setCopiedAgents] = useState(false);
  const [copiedFix, setCopiedFix] = useState(false);

  async function copyText(text: string, which: 'agents' | 'fix') {
    await copyTextSafe(text);
    if (which === 'agents') {
      setCopiedAgents(true);
      setTimeout(() => setCopiedAgents(false), 2000);
    } else {
      setCopiedFix(true);
      setTimeout(() => setCopiedFix(false), 2000);
    }
  }

  function downloadAgentsMd() {
    const blob = new Blob([agentsMdBlueprint], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'AGENTS.md';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="atlas-panel-animate space-y-5">
      <div className="space-y-1">
        <h2 className="text-base font-semibold tracking-tight">AI handoff</h2>
        <p className="text-secondary measure-readable">
          Add <code className="code-inline">AGENTS.md</code> to the repo root, then paste the fix prompt into your
          coding agent.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <BlueprintCard
          icon={<FileText {...ICON_PROPS} />}
          title={<span className="font-mono-code">AGENTS.md</span>}
          description={
            <>
              Layer boundaries and file responsibilities for <span className="font-medium">{repoName}</span>.
            </>
          }
          bodyLabel="Generated AGENTS.md"
          body={agentsMdBlueprint}
          actions={
            <>
              <button
                type="button"
                onClick={() => copyText(agentsMdBlueprint, 'agents')}
                className="btn btn-ghost btn-sm"
                aria-live="polite"
              >
                {copiedAgents ? <CopiedIcon /> : <Copy {...ICON_PROPS} size={14} />}
                <span>{copiedAgents ? 'Copied' : 'Copy'}</span>
              </button>
              <button type="button" onClick={downloadAgentsMd} className="btn btn-secondary btn-sm">
                <Download {...ICON_PROPS} size={14} />
                <span>Download AGENTS.md</span>
              </button>
            </>
          }
        />

        <BlueprintCard
          icon={<Terminal {...ICON_PROPS} />}
          title="Fix prompt"
          description="Every flagged issue, ordered by severity, in one prompt."
          bodyLabel="Fix prompt"
          body={masterFixPrompt}
          actions={
            <button
              type="button"
              onClick={() => copyText(masterFixPrompt, 'fix')}
              className="btn btn-primary btn-sm"
              aria-live="polite"
            >
              {copiedFix ? <Check {...ICON_PROPS} size={14} /> : <Copy {...ICON_PROPS} size={14} />}
              <span>{copiedFix ? 'Copied' : 'Copy prompt'}</span>
            </button>
          }
        />
      </div>
    </div>
  );
}
