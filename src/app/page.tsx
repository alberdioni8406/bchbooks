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
  deleteAddress,
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
import {
  isValidBchAddressFormat,
  normalizeAddress,
} from '@/lib/utils/bch-address';
import {
  fetchAddressInfo,
  fetchAddressTransactions,
} from '@/lib/bch/adapter';
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
  var readyState = useState(false);
  var ready = readyState[0];
  var setReady = readyState[1];

  var addressesState = useState<WatchedAddress[]>([]);
  var addresses = addressesState[0];
  var setAddresses = addressesState[1];

  var transactionsState = useState<NormalizedTransaction[]>([]);
  var transactions = transactionsState[0];
  var setTransactions = transactionsState[1];

  var categoriesState = useState<Category[]>([]);
  var categories = categoriesState[0];
  var setCategories = categoriesState[1];

  var rulesState = useState<ClassificationRule[]>([]);
  var rules = rulesState[0];
  var setRules = rulesState[1];

  var prefsState = useState<AppPreferences | null>(null);
  var prefs = prefsState[0];
  var setPrefs = prefsState[1];

  var viewState = useState<View>('dashboard');
  var view = viewState[0];
  var setView = viewState[1];

  var scanningState = useState(false);
  var scanning = scanningState[0];
  var setScanning = scanningState[1];

  var scanErrorState = useState<string | null>(null);
  var scanError = scanErrorState[0];
  var setScanError = scanErrorState[1];

  var selectedTxState = useState<NormalizedTransaction | null>(null);
  var selectedTx = selectedTxState[0];
  var setSelectedTx = selectedTxState[1];

  var load = useCallback(async function () {
    await ensureDefaults();
    var results = await Promise.all([
      getAllAddresses(),
      getAllTransactions(),
      getAllCategories(),
      getAllRules(),
      getPreferences(),
    ]);
    setAddresses(results[0]);
    setTransactions(results[1]);
    setCategories(results[2]);
    setRules(results[3]);
    setPrefs(results[4]);
    setReady(true);
  }, []);

  useEffect(
    function () {
      load().catch(console.error);
    },
    [load]
  );

  async function scanAddress(rawAddress: string, label?: string) {
    var labelText = label || '';
    setScanError(null);
    if (!isValidBchAddressFormat(rawAddress)) {
      setScanError('That does not look like a valid Bitcoin Cash address.');
      return;
    }
    var address = normalizeAddress(rawAddress);
    setScanning(true);
    try {
      var info = await fetchAddressInfo(address);
      var providerTxs = await fetchAddressTransactions(address);

      var existing = addresses.find(function (a) {
        return a.address === address;
      });
      var watched: WatchedAddress = {
        id: existing ? existing.id : uid(),
        address: address,
        label: labelText || (existing && existing.label) || shortLabel(address),
        addedAt: existing ? existing.addedAt : new Date().toISOString(),
        lastScannedAt: new Date().toISOString(),
        balanceBch: info.balanceSats / 1e8,
        totalReceivedBch: info.totalReceivedSats / 1e8,
        totalSentBch: info.totalSentSats / 1e8,
        txCount: info.txCount,
      };
      await putAddress(watched);

      var fiat = (prefs && prefs.fiatCurrency) || 'USD';
      var allAddrs = addresses
        .map(function (a) {
          return a.address;
        })
        .concat([address]);
      var normalized = await normalizeProviderTxs(
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
      var msg = e instanceof Error ? e.message : 'Could not scan address';
      setScanError(
        msg.indexOf('unavailable') !== -1 || msg.indexOf('timed') !== -1
          ? 'The BCH data provider is temporarily unavailable. Please try again in a moment.'
          : msg
      );
    } finally {
      setScanning(false);
    }
  }

  async function refreshAll() {
    for (var i = 0; i < addresses.length; i++) {
      await scanAddress(addresses[i].address, addresses[i].label);
    }
  }

  async function goHome() {
    var ok = window.confirm(
      'Return to the home screen and start over?\n\n' +
        'Watched addresses will be removed from this browser. ' +
        'You can add an address again anytime. Local data never leaves your device.'
    );
    if (!ok) return;
    try {
      for (var i = 0; i < addresses.length; i++) {
        await deleteAddress(addresses[i].id);
      }
      setAddresses([]);
      setTransactions([]);
      setView('dashboard');
      setScanError(null);
      setSelectedTx(null);
    } catch (e) {
      setScanError(
        e instanceof Error ? e.message : 'Could not reset local data'
      );
    }
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-slate-500">Loading BCHBooks…</p>
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

  var period = getPeriodRange(
    (prefs && prefs.period) || 'this_month',
    prefs ? prefs.customFrom : null,
    prefs ? prefs.customTo : null
  );
  var periodTxs = filterByPeriod(transactions, period.from, period.to);
  var summary: DashboardSummary = buildDashboardSummary(
    periodTxs,
    categories,
    period.label
  );

  return (
    <AppShell
      view={view}
      onViewChange={setView}
      onHome={goHome}
      addressCount={addresses.length}
      uncategorized={summary.uncategorizedCount}
    >
      {view === 'dashboard' ? (
        <DashboardView
          summary={summary}
          period={(prefs && prefs.period) || 'this_month'}
          onPeriodChange={async function (p) {
            if (!prefs) return;
            var next = Object.assign({}, prefs, { period: p });
            await setPreferences(next);
            setPrefs(next);
          }}
          onRefresh={refreshAll}
          scanning={scanning}
          transactions={periodTxs}
          categories={categories}
        />
      ) : null}
      {view === 'transactions' ? (
        <TransactionsView
          transactions={transactions}
          categories={categories}
          selected={selectedTx}
          onSelect={setSelectedTx}
          onReload={load}
        />
      ) : null}
      {view === 'reports' ? (
        <ReportsView
          transactions={periodTxs}
          categories={categories}
          periodLabel={period.label}
          prefs={prefs}
        />
      ) : null}
      {view === 'categories' ? (
        <CategoriesView
          categories={categories}
          rules={rules}
          addresses={addresses}
          onReload={load}
        />
      ) : null}
      {view === 'settings' ? (
        <SettingsView
          addresses={addresses}
          prefs={prefs}
          onAddAddress={scanAddress}
          scanning={scanning}
          scanError={scanError}
          onReload={load}
          onPrefsChange={async function (p) {
            await setPreferences(p);
            setPrefs(p);
          }}
        />
      ) : null}
    </AppShell>
  );
}

function shortLabel(addr: string) {
  var a = addr.replace('bitcoincash:', '');
  return a.slice(0, 6) + '…' + a.slice(-4);
}
