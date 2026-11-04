import { Activity, Cpu, Layers, ShieldCheck } from 'lucide-react';
import { AuditCategory, RepoAnalysisResult, RepoSnapshotDiff } from '../../types/atlas';
import { ScoreCard } from '../ui/ScoreCard';
import { WorkspaceTab } from './TopHeader';

interface ScoreOverviewProps {
  analysis: RepoAnalysisResult;
  diff: RepoSnapshotDiff | null;
  activeTab: WorkspaceTab;
  auditFilter: 'all' | AuditCategory;
  onOpenTab: (tab: WorkspaceTab, filter?: AuditCategory) => void;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function ScoreOverview({ analysis, diff, activeTab, auditFilter, onOpenTab }: ScoreOverviewProps) {
  const { scores, findings } = analysis;
  const securityCount = findings.filter((f) => f.category === 'security').length;
  const perfCount = findings.filter((f) => f.category === 'performance').length;
  const iconProps = { size: 15, strokeWidth: 1.75, 'aria-hidden': true } as const;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 items-stretch">
      <ScoreCard
        label="Architecture"
        description="How cleanly files are split up and connected"
        score={scores.architecture}
        delta={diff?.architectureDelta}
        subtitle={`${plural(scores.circularDepsCount, 'import loop', 'import loops')} · ${plural(scores.godFilesCount, 'oversized file', 'oversized files')}`}
        actionLabel="Map"
        isActive={activeTab === 'graph'}
        onClick={() => onOpenTab('graph')}
        icon={<Layers {...iconProps} />}
      />
      <ScoreCard
        label="Security"
        description="Leaked keys and code attackers could abuse"
        score={scores.security}
        delta={diff?.securityDelta}
        subtitle={securityCount === 0 ? 'No issues' : plural(securityCount, 'issue', 'issues')}
        actionLabel="Findings"
        isActive={activeTab === 'audit' && auditFilter === 'security'}
        onClick={() => onOpenTab('audit', 'security')}
        icon={<ShieldCheck {...iconProps} />}
      />
      <ScoreCard
        label="Performance"
        description="Patterns that make the app slower than needed"
        score={scores.performance}
        delta={diff?.performanceDelta}
        subtitle={perfCount === 0 ? 'No issues' : plural(perfCount, 'issue', 'issues')}
        actionLabel="Findings"
        isActive={activeTab === 'audit' && auditFilter === 'performance'}
        onClick={() => onOpenTab('audit', 'performance')}
        icon={<Activity {...iconProps} />}
      />
      <ScoreCard
        label="AI context size"
        description="How much an AI assistant must read to load this code"
        score={scores.totalTokens}
        delta={diff?.tokenDelta}
        suffix="tokens"
        isMetric
        subtitle={`${plural(scores.totalFiles, 'file', 'files')} · ${scores.totalLines.toLocaleString()} lines`}
        actionLabel="AGENTS.md"
        isActive={activeTab === 'blueprint'}
        onClick={() => onOpenTab('blueprint')}
        icon={<Cpu {...iconProps} />}
      />
    </div>
  );
}
