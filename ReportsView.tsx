'use client';

import type { NormalizedTransaction, Category, AppPreferences } from '@/lib/types';
import { buildMonthlyReport, formatFiat, formatBch } from '@/lib/accounting/periods';

export function ReportsView({
  transactions,
  categories,
  periodLabel,
  prefs,
}: {
  transactions: NormalizedTransaction[];
  categories: Category[];
  periodLabel: string;
  prefs: AppPreferences | null;
}) {
  const report = buildMonthlyReport(transactions, categories, periodLabel);

  const exportCsv = () => {
    const lines = [
      'Date,Direction,BCH,Fiat,Currency,Category,Memo,TXID,Status',
      ...transactions.map((t) => {
        const cat = categories.find((c) => c.id === t.categoryId);
        return [
          t.date,
          t.direction,
          t.amountBch,
          t.valuation.fiatAmount ?? '',
          t.valuation.fiatCurrency,
          cat?.name ?? 'Uncategorized',
          (t.memo || '').replace(/,/g, ';'),
          t.txid,
          t.status,
        ].join(',');
      }),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bchbooks-${periodLabel.replace(/\s+/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printPdf = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Report</h1>
          <p className="text-sm text-slate-500">{periodLabel}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportCsv}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
          >
            Export CSV
          </button>
          <button
            onClick={printPdf}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
          >
            Export PDF
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 print:border-0 print:shadow-none">
        <div className="mb-6 text-center">
          <h2 className="text-lg font-bold tracking-tight text-teal-800">BCHBOOKS</h2>
          <p className="text-sm text-slate-500">{periodLabel}</p>
        </div>

        <section className="mb-6">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Revenue
          </h3>
          <div className="space-y-1 border-b border-slate-100 pb-3">
            {report.revenue.length === 0 && (
              <p className="text-sm text-slate-400">No categorized revenue</p>
            )}
            {report.revenue.map((l) => (
              <div key={l.categoryId} className="flex justify-between text-sm">
                <span>{l.categoryName}</span>
                <span className="tabular-nums">{formatFiat(l.totalFiat)}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between font-semibold">
            <span>Total Revenue</span>
            <span className="tabular-nums text-emerald-700">
              {formatFiat(report.totalRevenueFiat)}
            </span>
          </div>
        </section>

        <section className="mb-6">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Expenses
          </h3>
          <div className="space-y-1 border-b border-slate-100 pb-3">
            {report.expenses.length === 0 && (
              <p className="text-sm text-slate-400">No categorized expenses</p>
            )}
            {report.expenses.map((l) => (
              <div key={l.categoryId} className="flex justify-between text-sm">
                <span>{l.categoryName}</span>
                <span className="tabular-nums">{formatFiat(l.totalFiat)}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between font-semibold">
            <span>Total Expenses</span>
            <span className="tabular-nums text-rose-700">
              {formatFiat(report.totalExpensesFiat)}
            </span>
          </div>
        </section>

        <div className="flex justify-between border-t border-slate-200 pt-4 text-lg font-bold">
          <span>Net</span>
          <span
            className={`tabular-nums ${
              report.netFiat >= 0 ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            {formatFiat(report.netFiat)}
          </span>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3 text-sm text-slate-600 sm:grid-cols-4">
          <div>
            <p className="text-xs text-slate-400">BCH received</p>
            <p className="font-medium tabular-nums">{formatBch(report.bchReceived)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">BCH spent</p>
            <p className="font-medium tabular-nums">{formatBch(report.bchSpent)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Transactions</p>
            <p className="font-medium">{report.transactionCount}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Uncategorized</p>
            <p className="font-medium">{report.uncategorizedCount}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
