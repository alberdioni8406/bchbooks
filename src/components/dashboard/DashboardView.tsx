'use client';

import type { DashboardSummary, NormalizedTransaction, Category, AccountingPeriodPreset } from '@/lib/types';
import { formatFiat, formatBch } from '@/lib/accounting/periods';

const PERIODS: { id: AccountingPeriodPreset; label: string }[] = [
  { id: 'this_month', label: 'This month' },
  { id: 'last_month', label: 'Last month' },
  { id: 'this_quarter', label: 'This quarter' },
  { id: 'this_year', label: 'This year' },
  { id: 'all_time', label: 'All time' },
];

export function DashboardView({
  summary,
  period,
  onPeriodChange,
  onRefresh,
  scanning,
  transactions,
  categories,
}: {
  summary: DashboardSummary;
  period: AccountingPeriodPreset | 'custom';
  onPeriodChange: (p: AccountingPeriodPreset) => void;
  onRefresh: () => void;
  scanning: boolean;
  transactions: NormalizedTransaction[];
  categories: Category[];
}) {
  // Simple bar data for revenue vs expenses
  const max = Math.max(summary.revenueFiat, summary.expensesFiat, 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500">{summary.periodLabel}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={period === 'custom' ? 'this_month' : period}
            onChange={(e) => onPeriodChange(e.target.value as AccountingPeriodPreset)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm"
          >
            {PERIODS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          <button
            onClick={onRefresh}
            disabled={scanning}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {scanning ? 'Scanning…' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card label="Revenue" value={formatFiat(summary.revenueFiat)} tone="success" />
        <Card label="Expenses" value={formatFiat(summary.expensesFiat)} tone="danger" />
        <Card label="Net" value={formatFiat(summary.netFiat)} tone={summary.netFiat >= 0 ? 'success' : 'danger'} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card label="BCH received" value={formatBch(summary.bchReceived)} />
        <Card label="BCH spent" value={formatBch(summary.bchSpent)} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card label="Transactions" value={String(summary.transactionCount)} />
        <Card
          label="Uncategorized"
          value={String(summary.uncategorizedCount)}
          tone={summary.uncategorizedCount > 0 ? 'warn' : undefined}
        />
      </div>

      {/* Simple revenue / expense chart */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-medium text-slate-500">Revenue vs Expenses</h2>
        <div className="space-y-3">
          <Bar label="Revenue" value={summary.revenueFiat} max={max} color="bg-emerald-500" />
          <Bar label="Expenses" value={summary.expensesFiat} max={max} color="bg-rose-500" />
        </div>
      </div>

      {transactions.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
          <p className="font-medium text-slate-700">No BCH transactions found for this period.</p>
          <p className="mt-1 text-sm text-slate-500">
            Once activity is detected, your accounting ledger will appear here.
          </p>
        </div>
      )}
    </div>
  );
}

function Card({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'success' | 'danger' | 'warn';
}) {
  const color =
    tone === 'success'
      ? 'text-emerald-700'
      : tone === 'danger'
        ? 'text-rose-700'
        : tone === 'warn'
          ? 'text-amber-700'
          : 'text-slate-900';
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}

function Bar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className="text-slate-600">{label}</span>
        <span className="font-medium tabular-nums">{formatFiat(value)}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
