import { PresetRepository } from '../types/atlas';
import { ADDITIONAL_PRESET_REPOSITORIES } from './presetCleanRepos';
import { SYSTEMS_PRESET_REPOSITORIES } from './presetSystemsRepos';

const GOD_DASHBOARD_LINES = Array.from(
  { length: 215 },
  (_, idx) => `  const metricRow${idx + 1} = invoices.filter((i) => i.amountCents > ${idx * 100}).length;`
).join('\n');

export const PRESET_REPOSITORIES: PresetRepository[] = [
  {
    id: 'vibe-saas-billing',
    name: 'Pulse AI Billing Workspace',
    slug: 'acme-ai/pulse-ai-saas',
    stackTags: ['Next.js App Router', 'Supabase', 'TypeScript'],
    badge: '12 Issues',
    badgeTone: 'danger',
    description:
      'Fast-shipped AI SaaS workspace built with Next.js and Supabase containing exposed service-role credentials, N+1 query loops, a circular dependency, and oversized god components.',
    files: [
      {
        path: 'src/app/page.tsx',
        content: `"use client";
import React, { useEffect, useState } from 'react';
import { BillingDashboard } from '../features/billing/BillingDashboard';
import { fetchCurrentWorkspace, supabase } from '../services/supabaseClient';
import { Button, Card, MetricBadge } from '../components/ui/index';

export default function HomePage() {
  const [workspace, setWorkspace] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);

  useEffect(() => {
    async function loadInitialData() {
      // Sequential network waterfall (PERF-002)
      const ws = await fetchCurrentWorkspace();
      const inv = await supabase.from('invoices').select('*');
      setWorkspace(ws);
      setInvoices(inv.data ?? []);
    }
    loadInitialData();
  }, []);

  return (
    <main className="p-8">
      <Card>
        <h1>{workspace?.name ?? 'Pulse AI Workspace'}</h1>
        <MetricBadge label="Active Plan" value="Pro Tier" />
        <BillingDashboard invoices={invoices} />
        <Button label="Upgrade Subscription" />
      </Card>
    </main>
  );
}
${GOD_DASHBOARD_LINES.slice(0, 3800)}`,
      },
      {
        path: 'src/features/billing/BillingDashboard.tsx',
        content: `import React from 'react';
import { syncCustomerInvoices } from '../../services/billingService';
import { Card } from '../../components/ui/Card';
import { InvoiceRow } from '../../types/billing';

export function BillingDashboard({ invoices }: { invoices: InvoiceRow[] }) {
  const rawAnnouncementHtml = "<div class='banner'>Welcome back! Promo code: <b>SPRING26</b></div>";

  return (
    <section>
      {/* Unsanitized HTML injection (SEC-003) */}
      <div dangerouslySetInnerHTML={{ __html: rawAnnouncementHtml }} />
      <Card>
        <h2>Monthly Recurring Invoices ({invoices.length})</h2>
        <button onClick={() => syncCustomerInvoices(invoices.map((i) => i.customerId))}>
          Sync Stripe Ledger
        </button>
      </Card>
    </section>
  );
}
${GOD_DASHBOARD_LINES}`,
      },
      {
        path: 'src/services/billingService.ts',
        content: `import { supabase } from './supabaseClient';
import { BillingDashboard } from '../features/billing/BillingDashboard';
import { InvoiceRow } from '../types/billing';

export async function syncCustomerInvoices(customerIds: string[]): Promise<InvoiceRow[]> {
  const results: InvoiceRow[] = [];
  // N+1 query inside a loop (PERF-004)
  for (const customerId of customerIds) {
    const { data } = await supabase.from('invoices').select('*').eq('customer_id', customerId);
    if (data) results.push(...data);
  }
  return results;
}

export async function searchInvoicesRaw(searchTerm: string) {
  // Raw SQL string interpolation (SEC-004)
  const rawQuery = \`SELECT * FROM invoices WHERE customer_email = '\${searchTerm}' ORDER BY created_at DESC\`;
  return supabase.rpc('exec_raw_sql', { query: rawQuery });
}

export const dashboardRef = BillingDashboard;
`,
      },
      {
        path: 'src/services/supabaseClient.ts',
        content: `import { UserSession } from '../types/billing';

// Privileged secret exposed via client prefix + hardcoded JWT (SEC-001 & SEC-002)
export const NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UifQ";

export const supabase = {
  from: (_table: string) => ({
    select: (_cols: string) => ({
      data: [],
      eq: async (_col: string, _val: string) => ({ data: [] }),
    }),
  }),
  rpc: async (_fn: string, _args: Record<string, unknown>) => ({ data: [] }),
};

export async function fetchCurrentWorkspace(): Promise<UserSession> {
  return { id: 'ws_01', name: 'Acme AI Labs', plan: 'pro' };
}
`,
      },
      {
        path: 'src/app/api/webhook/route.ts',
        content: `import { syncCustomerInvoices } from '../../../services/billingService';

export async function POST(req: Request) {
  const payload = await req.json();
  await syncCustomerInvoices([payload.customerId]);

  // Wildcard CORS on mutating webhook route (SEC-005)
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
`,
      },
      {
        path: 'src/components/ui/index.ts',
        content: `// Barrel file re-exporting all UI modules (PERF-003)
export * from './Button';
export * from './Card';
export * from './MetricBadge';
`,
      },
      {
        path: 'src/components/ui/Button.tsx',
        content: `import React from 'react';
export function Button({ label }: { label: string }) {
  return <button className="px-4 py-2 rounded">{label}</button>;
}
`,
      },
      {
        path: 'src/components/ui/Card.tsx',
        content: `import React from 'react';
export function Card({ children }: { children: React.ReactNode }) {
  return <div className="p-6 rounded-xl border">{children}</div >;
}
`,
      },
      {
        path: 'src/components/ui/MetricBadge.tsx',
        content: `import React from 'react';
export function MetricBadge({ label, value }: { label: string; value: string }) {
  return <span className="text-xs font-mono">{label}: {value}</span>;
}
`,
      },
      {
        path: 'src/types/billing.ts',
        content: `export interface InvoiceRow {
  id: string;
  customerId: string;
  amountCents: number;
  status: 'paid' | 'open';
}

export interface UserSession {
  id: string;
  name: string;
  plan: 'free' | 'pro' | 'enterprise';
}
`,
      },
    ],
  },
  ...ADDITIONAL_PRESET_REPOSITORIES,
  ...SYSTEMS_PRESET_REPOSITORIES,
];
