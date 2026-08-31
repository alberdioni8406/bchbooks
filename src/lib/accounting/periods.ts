import type {
  AccountingPeriodPreset,
  NormalizedTransaction,
  DashboardSummary,
  MonthlyReport,
  Category,
  ReportCategoryLine,
} from '../types';

export function getPeriodRange(
  preset: AccountingPeriodPreset | 'custom',
  customFrom?: string | null,
  customTo?: string | null
): { from: Date; to: Date; label: string } {
  const now = new Date();
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const endOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

  if (preset === 'custom' && customFrom && customTo) {
    return {
      from: startOfDay(new Date(customFrom)),
      to: endOfDay(new Date(customTo)),
      label: `${customFrom} → ${customTo}`,
    };
  }

  const y = now.getFullYear();
  const m = now.getMonth();

  switch (preset) {
    case 'this_month': {
      const from = new Date(y, m, 1);
      return {
        from,
        to: endOfDay(now),
        label: from.toLocaleString('en', { month: 'long', year: 'numeric' }),
      };
    }
    case 'last_month': {
      const from = new Date(y, m - 1, 1);
      const to = new Date(y, m, 0, 23, 59, 59, 999);
      return {
        from,
        to,
        label: from.toLocaleString('en', { month: 'long', year: 'numeric' }),
      };
    }
    case 'this_quarter': {
      const q = Math.floor(m / 3);
      const from = new Date(y, q * 3, 1);
      return { from, to: endOfDay(now), label: `Q${q + 1} ${y}` };
    }
    case 'this_year': {
      const from = new Date(y, 0, 1);
      return { from, to: endOfDay(now), label: String(y) };
    }
    case 'all_time':
    default:
      return { from: new Date(0), to: endOfDay(now), label: 'All time' };
  }
}

export function filterByPeriod(
  txs: NormalizedTransaction[],
  from: Date,
  to: Date
): NormalizedTransaction[] {
  return txs.filter((t) => {
    const d = new Date(t.date);
    return d >= from && d <= to;
  });
}

export function buildDashboardSummary(
  txs: NormalizedTransaction[],
  categories: Category[],
  periodLabel: string
): DashboardSummary {
  let revenueFiat = 0;
  let expensesFiat = 0;
  let bchReceived = 0;
  let bchSpent = 0;
  let uncategorized = 0;
  let transfers = 0;

  const catMap = new Map(categories.map((c) => [c.id, c]));

  for (const t of txs) {
    const fiat =
      t.valuation.available && t.valuation.fiatAmount != null
        ? t.valuation.fiatAmount
        : 0;
    const cat = t.categoryId ? catMap.get(t.categoryId) : null;

    if (t.direction === 'incoming') {
      bchReceived += t.amountBch;
      if (cat?.type === 'revenue' || !cat) revenueFiat += fiat;
    } else if (t.direction === 'outgoing') {
      bchSpent += t.amountBch;
      if (cat?.type === 'expense' || !cat) expensesFiat += fiat;
    } else {
      transfers += 1;
    }

    if (!t.categoryId) uncategorized += 1;
  }

  return {
    periodLabel,
    revenueFiat,
    expensesFiat,
    netFiat: revenueFiat - expensesFiat,
    bchReceived,
    bchSpent,
    transactionCount: txs.length,
    uncategorizedCount: uncategorized,
    transfersCount: transfers,
  };
}

export function buildMonthlyReport(
  txs: NormalizedTransaction[],
  categories: Category[],
  periodLabel: string
): MonthlyReport {
  const catMap = new Map(categories.map((c) => [c.id, c]));
  const lines = new Map<string, ReportCategoryLine>();

  let bchReceived = 0;
  let bchSpent = 0;
  let uncategorized = 0;
  let transfers = 0;

  for (const t of txs) {
    const fiat =
      t.valuation.available && t.valuation.fiatAmount != null
        ? Math.abs(t.valuation.fiatAmount)
        : 0;
    if (t.direction === 'incoming') bchReceived += t.amountBch;
    if (t.direction === 'outgoing') bchSpent += t.amountBch;
    if (t.direction === 'internal') {
      transfers += 1;
      continue;
    }
    if (!t.categoryId) {
      uncategorized += 1;
      continue;
    }
    const cat = catMap.get(t.categoryId);
    if (!cat || cat.type === 'transfer') continue;

    const key = cat.id;
    const existing = lines.get(key) || {
      categoryId: cat.id,
      categoryName: cat.name,
      type: cat.type,
      totalFiat: 0,
      totalBch: 0,
      count: 0,
    };
    existing.totalFiat += fiat;
    existing.totalBch += t.amountBch;
    existing.count += 1;
    lines.set(key, existing);
  }

  const all = Array.from(lines.values());
  const revenue = all
    .filter((l) => l.type === 'revenue')
    .sort((a, b) => b.totalFiat - a.totalFiat);
  const expenses = all
    .filter((l) => l.type === 'expense')
    .sort((a, b) => b.totalFiat - a.totalFiat);
  const totalRevenueFiat = revenue.reduce((s, l) => s + l.totalFiat, 0);
  const totalExpensesFiat = expenses.reduce((s, l) => s + l.totalFiat, 0);

  return {
    periodLabel,
    revenue,
    expenses,
    totalRevenueFiat,
    totalExpensesFiat,
    netFiat: totalRevenueFiat - totalExpensesFiat,
    bchReceived,
    bchSpent,
    transactionCount: txs.length,
    transfersCount: transfers,
    uncategorizedCount: uncategorized,
  };
}

export function formatFiat(
  n: number | null | undefined,
  currency = 'USD'
): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatBch(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  var s = n.toFixed(8);
  s = s.replace(/\.?0+$/, '');
  return s + ' BCH';
}
