'use client';

import { useState } from 'react';

export function Onboarding({
  onAdd,
  scanning,
  error,
}: {
  onAdd: (address: string, label?: string) => Promise<void>;
  scanning: boolean;
  error: string | null;
}) {
  const [address, setAddress] = useState('');
  const [label, setLabel] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim() || scanning) return;
    await onAdd(address.trim(), label.trim());
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-center text-2xl font-bold tracking-tight text-teal-800">
          BCHBOOKS
        </h1>
        <p className="mt-2 text-center text-sm text-slate-500">
          Simple accounting for Bitcoin Cash.
        </p>
        <p className="mt-6 text-center text-slate-700">
          Connect your BCH address
          <br />
          and turn your transactions
          <br />
          into useful business records.
        </p>

        <form onSubmit={submit} className="mt-8 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              BCH address (CashAddr or legacy)
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="bitcoincash:q…"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              disabled={scanning}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              Label (optional)
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Business wallet"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              disabled={scanning}
            />
          </div>
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={scanning || !address.trim()}
            className="w-full rounded-xl bg-teal-600 py-3 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:opacity-50"
          >
            {scanning ? 'Scanning transactions…' : 'Add BCH Address'}
          </button>
        </form>

        <div className="mt-6 rounded-xl bg-slate-50 p-4 text-center text-xs text-slate-500">
          <p className="font-medium text-slate-700">
            BCHBooks cannot spend your BCH.
          </p>
          <p className="mt-1">
            Read-only. No seed phrases, private keys, or spending authorization
            required. Your accounting data stays in this browser.
          </p>
        </div>
      </div>
    </div>
  );
}
