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
        score={scores.architecture}
        delta={diff?.architectureDelta}
        subtitle={`${plural(scores.circularDepsCount, 'cycle', 'cycles')} · ${plural(scores.godFilesCount, 'large file', 'large files')}`}
        actionLabel="Map"
        isActive={activeTab === 'graph'}
        onClick={() => onOpenTab('graph')}
        icon={<Layers {...iconProps} />}
      />
      <ScoreCard
        label="Security"
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
        score={scores.totalTokens}
        delta={diff?.tokenDelta}
        suffix="tokens"
        isMetric
        subtitle={`${plural(scores.totalFiles, 'module', 'modules')} · ${scores.totalLines.toLocaleString()} lines`}
        actionLabel="AGENTS.md"
        isActive={activeTab === 'blueprint'}
        onClick={() => onOpenTab('blueprint')}
        icon={<Cpu {...iconProps} />}
      />
    </div>
  );
}
