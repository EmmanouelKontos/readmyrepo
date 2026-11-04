import { PresetRepository } from '../types/atlas';

export const ADDITIONAL_PRESET_REPOSITORIES: PresetRepository[] = [
  {
    id: 'clean-linear-reference',
    name: 'Chronicle Studio Reference',
    slug: 'chronicle-hq/chronicle-studio',
    stackTags: ['React 19', 'Strict Layers', 'Zero Cycles'],
    badge: '100/100 Clean',
    badgeTone: 'success',
    description:
      'Gold-standard modular architecture demonstrating strict unidirectional layer flow (Entry → Feature → UI / Service → Data), zero circular imports, and compact <120 LOC files.',
    files: [
      {
        path: 'src/app/App.tsx',
        content: `import React from 'react';
import { TimelineView } from '../features/timeline/TimelineView';
import { TopBar } from '../components/ui/TopBar';

export function App() {
  return (
    <div className="min-h-screen">
      <TopBar title="Chronicle Studio" />
      <TimelineView />
    </div>
  );
}
`,
      },
      {
        path: 'src/features/timeline/TimelineView.tsx',
        content: `import React, { useEffect, useState } from 'react';
import { fetchTimelineSnapshot } from '../../services/timelineService';
import { SurfaceCard } from '../../components/ui/SurfaceCard';
import { MilestoneEvent } from '../../types/timeline';

export function TimelineView() {
  const [events, setEvents] = useState<MilestoneEvent[]>([]);

  useEffect(() => {
    fetchTimelineSnapshot(25).then(setEvents);
  }, []);

  return (
    <SurfaceCard>
      <ul className="space-y-2">
        {events.map((ev) => (
          <li key={ev.id}>{ev.title} — {ev.timestamp}</li>
        ))}
      </ul>
    </SurfaceCard>
  );
}
`,
      },
      {
        path: 'src/services/timelineService.ts',
        content: `import { MilestoneEvent } from '../types/timeline';

export async function fetchTimelineSnapshot(limit = 25): Promise<MilestoneEvent[]> {
  const [recent, pinned] = await Promise.all([
    Promise.resolve([{ id: '1', title: 'Release v2.4', timestamp: '2026-11-04' }]),
    Promise.resolve([] as MilestoneEvent[]),
  ]);
  return [...pinned, ...recent].slice(0, limit);
}
`,
      },
      {
        path: 'src/components/ui/TopBar.tsx',
        content: `import React from 'react';
export function TopBar({ title }: { title: string }) {
  return <header className="px-6 py-4 border-b font-semibold">{title}</header>;
}
`,
      },
      {
        path: 'src/components/ui/SurfaceCard.tsx',
        content: `import React from 'react';
export function SurfaceCard({ children }: { children: React.ReactNode }) {
  return <section className="p-6 rounded-xl border">{children}</section>;
}
`,
      },
      {
        path: 'src/types/timeline.ts',
        content: `export interface MilestoneEvent {
  id: string;
  title: string;
  timestamp: string;
}
`,
      },
    ],
  },
  {
    id: 'mv3-browser-extension',
    name: 'FocusGuard Browser Extension',
    slug: 'focusguard/focus-guard-mv3',
    stackTags: ['Manifest V3', 'Service Worker', 'TypeScript'],
    badge: '2 Advisories',
    badgeTone: 'warning',
    description:
      'Manifest V3 Chrome Extension with isolated background service worker, popup UI, and storage client — illustrates manifest entrypoint resolution, <all_urls> permission auditing, and network waterfall detection.',
    files: [
      {
        path: 'src/entry/popup.tsx',
        content: `import React from 'react';
import { FocusTimerCard } from '../features/timer/FocusTimerCard';
import { Badge } from '../components/ui/Badge';

export function PopupApp() {
  return (
    <div className="w-80 p-4">
      <Badge text="MV3 Active" />
      <FocusTimerCard />
    </div>
  );
}
`,
      },
      {
        path: 'manifest.json',
        content: `{
  "manifest_version": 3,
  "name": "FocusGuard MV3",
  "version": "1.2.0",
  "permissions": ["storage", "activeTab"],
  "host_permissions": ["<all_urls>"],
  "action": { "default_popup": "src/entry/popup.tsx" },
  "background": { "service_worker": "src/service/backgroundWorker.ts" }
}`,
      },
      {
        path: 'src/features/timer/FocusTimerCard.tsx',
        content: `import React from 'react';
import { getActiveSession, recordRuleHit } from '../../service/storageClient';
import { SessionRule } from '../../types/session';

export function FocusTimerCard() {
  async function syncRules(rules: SessionRule[]) {
    const s1 = await fetch('/api/rules');
    const s2 = await fetch('/api/stats');
    return { s1, s2, rules, getActiveSession, recordRuleHit };
  }
  return <div onClick={() => syncRules([])}>25:00 Focus Session</div>;
}
`,
      },
      {
        path: 'src/service/backgroundWorker.ts',
        content: `import { getActiveSession } from './storageClient';

export async function onTabUpdated(url: string) {
  const session = await getActiveSession();
  return { url, active: session.isActive };
}
`,
      },
      {
        path: 'src/service/storageClient.ts',
        content: `import { SessionState } from '../types/session';

export async function getActiveSession(): Promise<SessionState> {
  return { isActive: true, blockedDomains: ['news.ycombinator.com'] };
}

export async function recordRuleHit(domain: string): Promise<void> {
  console.info('Blocked domain:', domain);
}
`,
      },
      {
        path: 'src/components/ui/Badge.tsx',
        content: `import React from 'react';
export function Badge({ text }: { text: string }) {
  return <span className="px-2 py-0.5 text-xs rounded">{text}</span>;
}
`,
      },
      {
        path: 'src/types/session.ts',
        content: `export interface SessionRule {
  id: string;
  pattern: string;
}

export interface SessionState {
  isActive: boolean;
  blockedDomains: string[];
}
`,
      },
    ],
  },
];
