import { useState } from 'react';
import { Check, Copy, Download, FileText, Sparkles, Terminal } from 'lucide-react';
import { copyTextSafe } from '../../lib/clipboard';

interface AiBlueprintPanelProps {
  repoName: string;
  agentsMdBlueprint: string;
  masterFixPrompt: string;
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
      {/* Workflow Orientation Strip */}
      <div
        className="p-4 rounded-xl grid grid-cols-1 md:grid-cols-3 gap-4"
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-hairline)',
        }}
      >
        {[
          {
            step: 'Step 01',
            title: 'Save AGENTS.md to Repo Root',
            desc: 'Gives AI coding agents an instant map of your layer boundaries and file responsibilities.',
          },
          {
            step: 'Step 02',
            title: 'Copy Prioritized Fix Queue',
            desc: 'Bundles all security, performance, and modularity violations into a single structured prompt.',
          },
          {
            step: 'Step 03',
            title: 'Run in Antigravity or Claude',
            desc: 'Paste the prompt into your agent to remediate all flagged issues in one pass.',
          },
        ].map((item) => (
          <div key={item.step} className="flex items-start gap-3">
            <span
              className="font-mono-code text-xs font-semibold px-2 py-0.5 rounded shrink-0 mt-0.5"
              style={{
                backgroundColor: 'var(--accent-brand-soft)',
                color: 'var(--accent-brand)',
              }}
            >
              {item.step}
            </span>
            <div>
              <h3 className="text-sm font-semibold">{item.title}</h3>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                {item.desc}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left: Auto-generated AGENTS.md Blueprint */}
        <div
          className="rounded-xl p-5 flex flex-col justify-between"
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-hairline)',
          }}
        >
          <div>
            <div
              className="flex flex-wrap items-center justify-between gap-2 pb-3.5 mb-3.5"
              style={{ borderBottom: '1px solid var(--border-hairline)' }}
            >
              <div className="flex items-center gap-2">
                <Sparkles size={16} style={{ color: 'var(--accent-brand)' }} aria-hidden="true" />
                <h2 className="heading-section">
                  Generated <code className="font-mono-code text-sm">AGENTS.md</code> Blueprint
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => copyText(agentsMdBlueprint, 'agents')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap"
                  style={{
                    backgroundColor: 'var(--bg-elevated)',
                    border: '1px solid var(--border-strong)',
                  }}
                >
                  {copiedAgents ? (
                    <Check size={13} className="text-emerald-600" aria-hidden="true" />
                  ) : (
                    <Copy size={13} aria-hidden="true" />
                  )}
                  <span>{copiedAgents ? 'Copied' : 'Copy Markdown'}</span>
                </button>
                <button
                  type="button"
                  onClick={downloadAgentsMd}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white cursor-pointer transition-opacity whitespace-nowrap"
                  style={{ backgroundColor: 'var(--accent-brand)' }}
                >
                  <Download size={13} aria-hidden="true" />
                  <span>Download AGENTS.md</span>
                </button>
              </div>
            </div>
            <p className="text-xs mb-3.5 measure-readable" style={{ color: 'var(--text-secondary)' }}>
              Drop this file into the root of <strong>{repoName}</strong> so AI coding assistants respect your module boundaries without burning context window tokens.
            </p>
            <pre
              className="p-4 rounded-xl text-xs font-mono-code leading-relaxed overflow-x-auto max-h-[26rem] whitespace-pre-wrap"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                border: '1px solid var(--border-hairline)',
              }}
            >
              {agentsMdBlueprint}
            </pre>
          </div>
        </div>

        {/* Right: Master One-Shot AI Refactor Prompt */}
        <div
          className="rounded-xl p-5 flex flex-col justify-between"
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-hairline)',
          }}
        >
          <div>
            <div
              className="flex flex-wrap items-center justify-between gap-2 pb-3.5 mb-3.5"
              style={{ borderBottom: '1px solid var(--border-hairline)' }}
            >
              <div className="flex items-center gap-2">
                <Terminal size={16} style={{ color: 'var(--accent-brand)' }} aria-hidden="true" />
                <h2 className="heading-section">One-Shot AI Remediation Prompt</h2>
              </div>
              <button
                type="button"
                onClick={() => copyText(masterFixPrompt, 'fix')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white cursor-pointer transition-opacity whitespace-nowrap"
                style={{ backgroundColor: 'var(--accent-brand)' }}
              >
                {copiedFix ? <Check size={13} aria-hidden="true" /> : <FileText size={13} aria-hidden="true" />}
                <span>{copiedFix ? 'Copied Master Prompt!' : 'Copy Full Fix Prompt'}</span>
              </button>
            </div>
            <p className="text-xs mb-3.5 measure-readable" style={{ color: 'var(--text-secondary)' }}>
              Paste this prioritized remediation prompt into your AI coding agent to resolve all detected security leaks, N+1 waterfalls, and architectural debt in a single pass.
            </p>
            <pre
              className="p-4 rounded-xl text-xs font-mono-code leading-relaxed overflow-x-auto max-h-[26rem] whitespace-pre-wrap"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                border: '1px solid var(--border-hairline)',
              }}
            >
              {masterFixPrompt}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
