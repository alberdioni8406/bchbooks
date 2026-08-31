'use client';

import { useState } from 'react';
import type { WatchedAddress, AppPreferences, FiatCurrency } from '@/lib/types';

var DONATION = 'bitcoincash:qrtv37u522gz8a5lezfqk5vukly93cu7gc8tn09040';

export function SettingsView(props: {
  addresses: WatchedAddress[];
  prefs: AppPreferences | null;
  onAddAddress: (address: string, label?: string) => Promise<void>;
  onRemoveAddress: (id: string) => Promise<void>;
  scanning: boolean;
  scanError: string | null;
  onReload: () => Promise<void>;
  onPrefsChange: (p: AppPreferences) => Promise<void>;
}) {
  var addresses = props.addresses;
  var prefs = props.prefs;
  var onAddAddress = props.onAddAddress;
  var onRemoveAddress = props.onRemoveAddress;
  var scanning = props.scanning;
  var scanError = props.scanError;
  var onPrefsChange = props.onPrefsChange;

  var newAddrState = useState('');
  var newAddr = newAddrState[0];
  var setNewAddr = newAddrState[1];
  var newLabelState = useState('');
  var newLabel = newLabelState[0];
  var setNewLabel = newLabelState[1];
  var removingState = useState<string | null>(null);
  var removing = removingState[0];
  var setRemoving = removingState[1];

  async function handleRemove(id: string, label: string) {
    var ok = window.confirm(
      'Remove address "' +
        label +
        '" from this browser?\n\nIts local transaction records will be deleted. Other addresses are not affected.'
    );
    if (!ok) return;
    setRemoving(id);
    try {
      await onRemoveAddress(id);
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-slate-500">
          You can watch as many BCH addresses as you need. Each keeps its own
          history. All data stays in this browser (IndexedDB).
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold">Watched BCH addresses</h2>
        <p className="mt-1 text-xs text-slate-500">
          Adding a new address does not erase previous ones. Dashboard and
          reports combine activity across all watched addresses.
        </p>
        <ul className="mt-3 divide-y divide-slate-100">
          {addresses.map(function (a) {
            return (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{a.label}</p>
                  <p className="break-all font-mono text-xs text-slate-500">
                    {a.address}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    Balance:{' '}
                    {a.balanceBch != null ? a.balanceBch.toFixed(8) : '—'} BCH ·{' '}
                    {a.txCount != null ? a.txCount : 0} txs
                    {a.lastScannedAt
                      ? ' · scanned ' +
                        new Date(a.lastScannedAt).toLocaleString()
                      : ''}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={removing === a.id || scanning}
                  onClick={function () {
                    handleRemove(a.id, a.label);
                  }}
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                >
                  {removing === a.id ? 'Removing…' : 'Remove'}
                </button>
              </li>
            );
          })}
          {addresses.length === 0 ? (
            <li className="py-3 text-sm text-slate-500">No addresses yet.</li>
          ) : null}
        </ul>

        <form
          className="mt-4 space-y-2"
          onSubmit={async function (e) {
            e.preventDefault();
            if (!newAddr.trim()) return;
            await onAddAddress(newAddr.trim(), newLabel.trim());
            setNewAddr('');
            setNewLabel('');
          }}
        >
          <input
            value={newAddr}
            onChange={function (e) {
              setNewAddr(e.target.value);
            }}
            placeholder="Add another BCH address"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
            disabled={scanning}
          />
          <input
            value={newLabel}
            onChange={function (e) {
              setNewLabel(e.target.value);
            }}
            placeholder="Label (optional)"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            disabled={scanning}
          />
          {scanError ? (
            <p className="text-sm text-red-600">{scanError}</p>
          ) : null}
          <button
            type="submit"
            disabled={scanning || !newAddr.trim()}
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {scanning ? 'Scanning…' : 'Add address'}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold">Fiat display</h2>
        <select
          value={(prefs && prefs.fiatCurrency) || 'USD'}
          onChange={async function (e) {
            if (!prefs) return;
            await onPrefsChange(
              Object.assign({}, prefs, {
                fiatCurrency: e.target.value as FiatCurrency,
              })
            );
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

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold">Privacy & security</h2>
        <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-600">
          <li>BCHBooks is read-only. It cannot spend your BCH.</li>
          <li>No seed phrases or private keys are ever requested.</li>
          <li>Accounting data is stored only in this browser.</li>
        </ul>
      </section>

      <section className="rounded-2xl border border-teal-100 bg-teal-50/50 p-5">
        <h2 className="text-sm font-semibold text-teal-900">
          Support BCHBooks
        </h2>
        <p className="mt-2 text-sm text-teal-800">
          BCHBooks is free and read-only by design. Building and running it is
          not: servers, explorer access, and the hours to keep accounting honest
          for Bitcoin Cash all add up. Independent builders fund that work with
          sats from people who actually use the tools.
        </p>
        <p className="mt-2 text-sm text-teal-800">
          If this ledger saves you time or friction, send what feels fair. Every
          sat helps keep the project alive, improved, and free of the usual
          extraction model.
        </p>
        <div className="mt-3 break-all rounded-lg bg-white p-3 font-mono text-xs text-slate-700">
          {DONATION}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Cypherpunk default: voluntary support, no gate, no custody, no seed
          phrases — ever.
        </p>
      </section>
    </div>
  );
}
