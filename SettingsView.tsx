'use client';

import { useState } from 'react';
import type { WatchedAddress, AppPreferences, FiatCurrency } from '@/lib/types';

export function SettingsView({
  addresses,
  prefs,
  onAddAddress,
  scanning,
  scanError,
  onReload,
  onPrefsChange,
}: {
  addresses: WatchedAddress[];
  prefs: AppPreferences | null;
  onAddAddress: (address: string, label?: string) => Promise<void>;
  scanning: boolean;
  scanError: string | null;
  onReload: () => Promise<void>;
  onPrefsChange: (p: AppPreferences) => Promise<void>;
}) {
  const [newAddr, setNewAddr] = useState('');
  const [newLabel, setNewLabel] = useState('');

  const donation = prefs?.donationAddress || '';

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-slate-500">
          Addresses, preferences and support. All data stays in this browser (IndexedDB).
        </p>
      </div>

      {/* Addresses */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold">Watched BCH addresses</h2>
        <ul className="mt-3 divide-y divide-slate-100">
          {addresses.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div>
                <p className="font-medium">{a.label}</p>
                <p className="font-mono text-xs text-slate-500">{a.address}</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  Balance: {a.balanceBch != null ? a.balanceBch.toFixed(8) : '—'} BCH ·{' '}
                  {a.txCount ?? 0} txs
                  {a.lastScannedAt &&
                    ` · scanned ${new Date(a.lastScannedAt).toLocaleString()}`}
                </p>
              </div>
            </li>
          ))}
        </ul>

        <form
          className="mt-4 space-y-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!newAddr.trim()) return;
            await onAddAddress(newAddr.trim(), newLabel.trim());
            setNewAddr('');
            setNewLabel('');
          }}
        >
          <input
            value={newAddr}
            onChange={(e) => setNewAddr(e.target.value)}
            placeholder="Add another BCH address"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono"
            disabled={scanning}
          />
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Label (optional)"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            disabled={scanning}
          />
          {scanError && <p className="text-sm text-red-600">{scanError}</p>}
          <button
            type="submit"
            disabled={scanning || !newAddr.trim()}
            className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {scanning ? 'Scanning…' : 'Add address'}
          </button>
        </form>
      </section>

      {/* Fiat preference */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold">Fiat currency</h2>
        <p className="mt-1 text-xs text-slate-500">
          Historical valuations are stored with the rate at the time of the transaction.
          Changing currency applies to new valuations only.
        </p>
        <select
          value={prefs?.fiatCurrency || 'USD'}
          onChange={async (e) => {
            if (!prefs) return;
            await onPrefsChange({
              ...prefs,
              fiatCurrency: e.target.value as FiatCurrency,
            });
          }}
          className="mt-3 rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
          <option value="GBP">GBP</option>
          <option value="ZAR">ZAR</option>
          <option value="MZN">MZN</option>
        </select>
      </section>

      {/* Privacy */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold">Privacy & security</h2>
        <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-600">
          <li>BCHBooks is read-only. It cannot spend your BCH.</li>
          <li>No seed phrases, private keys or wallet passwords are ever requested.</li>
          <li>Transaction data is public on the BCH blockchain; your categories and notes are private to this browser.</li>
          <li>No analytics or unnecessary data is sent to third parties beyond the BCH data provider.</li>
        </ul>
      </section>

      {/* Support / donation */}
      <section className="rounded-2xl border border-teal-100 bg-teal-50/50 p-5">
        <h2 className="text-sm font-semibold text-teal-900">Support BCHBooks</h2>
        <p className="mt-1 text-sm text-teal-800">
          BCHBooks is free. If it helps your business, consider a small BCH donation.
        </p>
        {donation && !donation.includes('qqqqqq') ? (
          <div className="mt-3 break-all rounded-lg bg-white p-3 font-mono text-xs text-slate-700">
            {donation}
          </div>
        ) : (
          <p className="mt-3 text-xs text-slate-500">
            Set your donation address in the code (DEFAULT_DONATION_ADDRESS in{' '}
            <code>src/lib/types.ts</code>) or replace the placeholder in Settings storage.
          </p>
        )}
        <p className="mt-2 text-xs text-slate-500">
          Monetization (Pro / Business tiers) can be added later when needed. For now
          everything is free.
        </p>
      </section>
    </div>
  );
}
