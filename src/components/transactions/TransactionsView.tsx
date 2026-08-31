'use client';

import { useState } from 'react';
import type { NormalizedTransaction, Category } from '@/lib/types';
import { formatFiat, formatBch } from '@/lib/accounting/periods';
import { updateTransactionCategory } from '@/lib/storage/db';

export function TransactionsView({
  transactions,
  categories,
  selected,
  onSelect,
  onReload,
}: {
  transactions: NormalizedTransaction[];
  categories: Category[];
  selected: NormalizedTransaction | null;
  onSelect: (t: NormalizedTransaction | null) => void;
  onReload: () => Promise<void>;
}) {
  const sorted = [...transactions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  if (sorted.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
        <p className="font-medium text-slate-700">No BCH transactions found.</p>
        <p className="mt-1 text-sm text-slate-500">
          Once activity is detected, your accounting ledger will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Transactions</h1>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium text-right">BCH</th>
              <th className="px-4 py-3 font-medium text-right">Fiat</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Memo</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((t) => {
              const cat = categories.find((c) => c.id === t.categoryId);
              const sign = t.direction === 'incoming' ? '+' : t.direction === 'outgoing' ? '−' : '';
              return (
                <tr
                  key={t.id}
                  onClick={() => onSelect(t)}
                  className="cursor-pointer border-b border-slate-50 hover:bg-teal-50/40"
                >
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                    {new Date(t.date).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="px-4 py-3 capitalize text-slate-700">{t.direction}</td>
                  <td
                    className={`px-4 py-3 text-right font-medium tabular-nums ${
                      t.direction === 'incoming'
                        ? 'text-emerald-700'
                        : t.direction === 'outgoing'
                          ? 'text-rose-700'
                          : 'text-slate-600'
                    }`}
                  >
                    {sign}
                    {formatBch(t.amountBch).replace(' BCH', '')} BCH
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                    {t.valuation.available
                      ? formatFiat(t.valuation.fiatAmount)
                      : 'Unavailable'}
                  </td>
                  <td className="px-4 py-3">
                    {cat ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">
                        {cat.name}
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-800">
                        Uncategorized
                      </span>
                    )}
                  </td>
                  <td className="max-w-[140px] truncate px-4 py-3 text-slate-500">
                    {t.memo || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs ${
                        t.status === 'confirmed' ? 'text-emerald-600' : 'text-amber-600'
                      }`}
                    >
                      {t.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selected && (
        <TxDetail
          tx={selected}
          categories={categories}
          onClose={() => onSelect(null)}
          onSaved={async () => {
            await onReload();
            onSelect(null);
          }}
        />
      )}
    </div>
  );
}

function TxDetail({
  tx,
  categories,
  onClose,
  onSaved,
}: {
  tx: NormalizedTransaction;
  categories: Category[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [categoryId, setCategoryId] = useState(tx.categoryId || '');
  const [notes, setNotes] = useState(tx.notes || '');
  const [openTech, setOpenTech] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await updateTransactionCategory(tx.id, categoryId || null, notes || null);
      await onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/30 p-4 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <h2 className="text-lg font-semibold">Transaction</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>

        <dl className="mt-4 space-y-3 text-sm">
          <Row label="Date" value={new Date(tx.date).toLocaleString()} />
          <Row
            label="Amount"
            value={`${tx.direction === 'incoming' ? '+' : tx.direction === 'outgoing' ? '−' : ''}${formatBch(tx.amountBch)}`}
          />
          <Row
            label="Fiat value"
            value={
              tx.valuation.available
                ? `${formatFiat(tx.valuation.fiatAmount)} @ ${tx.valuation.exchangeRate?.toFixed(2)} ${tx.valuation.fiatCurrency}/BCH`
                : 'Unavailable'
            }
          />
          <Row label="Direction" value={tx.direction} />
          <Row label="Status" value={tx.status} />
          {tx.memo && <Row label="Memo" value={tx.memo} />}
        </dl>

        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">Uncategorized</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.type})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Optional internal note"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => setOpenTech(!openTech)}
          className="mt-4 text-xs font-medium text-teal-700"
        >
          {openTech ? 'Hide' : 'Show'} transaction details
        </button>
        {openTech && (
          <dl className="mt-2 space-y-1 rounded-lg bg-slate-50 p-3 font-mono text-xs text-slate-600">
            <Row label="TXID" value={tx.txid} mono />
            <Row label="Block" value={tx.blockHeight != null ? String(tx.blockHeight) : '—'} />
            <Row label="Counterparty" value={tx.counterparty || '—'} mono />
            <Row
              label="Rate provider"
              value={tx.valuation.provider || '—'}
            />
          </dl>
        )}

        <div className="mt-6 flex gap-2">
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 rounded-xl bg-teal-600 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className={`text-right text-slate-800 ${mono ? 'break-all font-mono text-xs' : ''}`}>
        {value}
      </dd>
    </div>
  );
}
