'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  ensureDefaults,
  getAllAddresses,
  getAllTransactions,
  getAllCategories,
  getAllRules,
  getPreferences,
  putAddress,
  putTransactions,
  setPreferences,
  uid,
} from '@/lib/storage/db';
import type {
  WatchedAddress,
  NormalizedTransaction,
  Category,
  ClassificationRule,
  AppPreferences,
  DashboardSummary,
} from '@/lib/types';
import { isValidBchAddressFormat, normalizeAddress } from '@/lib/utils/bch-address';
import { fetchAddressInfo, fetchAddressTransactions } from '@/lib/bch/adapter';
import { normalizeProviderTxs } from '@/lib/accounting/normalize';
import {
  getPeriodRange,
  filterByPeriod,
  buildDashboardSummary,
} from '@/lib/accounting/periods';
import { Onboarding } from '@/components/onboarding/Onboarding';
import { AppShell } from '@/components/AppShell';
import { DashboardView } from '@/components/dashboard/DashboardView';
import { TransactionsView } from '@/components/transactions/TransactionsView';
import { ReportsView } from '@/components/reports/ReportsView';
import { CategoriesView } from '@/components/categories/CategoriesView';
import { SettingsView } from '@/components/settings/SettingsView';

type View = 'dashboard' | 'transactions' | 'reports' | 'categories' | 'settings';

export default function Home() {
  const [ready, setReady] = useState(false);
  const [addresses, setAddresses] = useState<WatchedAddress[]>([]);
  const [transactions, setTransactions] = useState<NormalizedTransaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [rules, setRules] = useState<ClassificationRule[]>([]);
  const [prefs, setPrefs] = useState<AppPreferences | null>(null);
  const [view, setView] = useState<View>('dashboard');
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [selectedTx, setSelectedTx] = useState<NormalizedTransaction | null>(null);

  const load = useCallback(async () => {
    await ensureDefaults();
    const [addrs, txs, cats, rls, pr] = await Promise.all([
      getAllAddresses(),
      getAllTransactions(),
      getAllCategories(),
      getAllRules(),
      getPreferences(),
    ]);
    setAddresses(addrs);
    setTransactions(txs);
    setCategories(cats);
    setRules(rls);
    setPrefs(pr);
    setReady(true);
  }, []);

  useEffect(() => {
    load().catch(console.error);
  }, [load]);

  const scanAddress = async (rawAddress: string, label = '') => {
    setScanError(null);
    if (!isValidBchAddressFormat(rawAddress)) {
      setScanError('That does not look like a valid Bitcoin Cash address.');
      return;
    }
    const address = normalizeAddress(rawAddress);
    setScanning(true);
    try {
      const info = await fetchAddressInfo(address);
      const providerTxs = await fetchAddressTransactions(address);

      const existing = addresses.find((a) => a.address === address);
      const watched: WatchedAddress = {
        id: existing?.id || uid(),
        address,
        label: label || existing?.label || shortLabel(address),
        addedAt: existing?.addedAt || new Date().toISOString(),
        lastScannedAt: new Date().toISOString(),
        balanceBch: info.balanceSats / 1e8,
        totalReceivedBch: info.totalReceivedSats / 1e8,
        totalSentBch: info.totalSentSats / 1e8,
        txCount: info.txCount,
      };
      await putAddress(watched);

      const fiat = prefs?.fiatCurrency || 'USD';
      const allAddrs = [...addresses.map((a) => a.address), address];
      const normalized = await normalizeProviderTxs(
        providerTxs,
        address,
        allAddrs,
        rules,
        categories,
        fiat
      );
      await putTransactions(normalized);

      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not scan address';
      setScanError(
        msg.includes('unavailable') || msg.includes('timed')
          ? 'The BCH data provider is temporarily unavailable. Please try again in a moment.'
          : msg
      );
    } finally {
      setScanning(false);
    }
  };

  const refreshAll = async () => {
    for (const a of addresses) {
      await scanAddress(a.address, a.label);
    }
  };

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-slate-500 text-sm">Loading BCHBooks…</p>
      </div>
    );
  }

  if (addresses.length === 0) {
    return (
      <Onboarding
        onAdd={scanAddress}
        scanning={scanning}
        error={scanError}
      />
    );
  }

  const period = getPeriodRange(
    prefs?.period || 'this_month',
    prefs?.customFrom,
    prefs?.customTo
  );
  const periodTxs = filterByPeriod(transactions, period.from, period.to);
  const summary: DashboardSummary = buildDashboardSummary(
    periodTxs,
    categories,
    period.label
  );

  return (
    <AppShell
      view={view}
      onViewChange={setView}
      addressCount={addresses.length}
      uncategorized={summary.uncategorizedCount}
    >
      {view === 'dashboard' && (
        <DashboardView
          summary={summary}
          period={prefs?.period || 'this_month'}
          onPeriodChange={async (p) => {
            if (!prefs) return;
            const next = { ...prefs, period: p };
            await setPreferences(next);
            setPrefs(next);
          }}
          onRefresh={refreshAll}
          scanning={scanning}
          transactions={periodTxs}
          categories={categories}
        />
      )}
      {view === 'transactions' && (
        <TransactionsView
          transactions={transactions}
          categories={categories}
          selected={selectedTx}
          onSelect={setSelectedTx}
          onReload={load}
        />
      )}
      {view === 'reports' && (
        <ReportsView
          transactions={periodTxs}
          categories={categories}
          periodLabel={period.label}
          prefs={prefs}
        />
      )}
      {view === 'categories' && (
        <CategoriesView
          categories={categories}
          rules={rules}
          addresses={addresses}
          onReload={load}
        />
      )}
      {view === 'settings' && (
        <SettingsView
          addresses={addresses}
          prefs={prefs}
          onAddAddress={scanAddress}
          scanning={scanning}
          scanError={scanError}
          onReload={load}
          onPrefsChange={async (p) => {
            await setPreferences(p);
            setPrefs(p);
          }}
        />
      )}
    </AppShell>
  );
}

function shortLabel(addr: string) {
  const a = addr.replace('bitcoincash:', '');
  return a.slice(0, 6) + '…' + a.slice(-4);
}
