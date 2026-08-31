'use client';

import { useState } from 'react';
import type { Category, ClassificationRule, WatchedAddress } from '@/lib/types';
import { putRule, deleteRule, uid } from '@/lib/storage/db';
import { normalizeAddress, isValidBchAddressFormat } from '@/lib/utils/bch-address';

export function CategoriesView({
  categories,
  rules,
  addresses,
  onReload,
}: {
  categories: Category[];
  rules: ClassificationRule[];
  addresses: WatchedAddress[];
  onReload: () => Promise<void>;
}) {
  const revenue = categories.filter((c) => c.type === 'revenue');
  const expenses = categories.filter((c) => c.type === 'expense');
  const transfers = categories.filter((c) => c.type === 'transfer');

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Categories</h1>
        <p className="text-sm text-slate-500">
          Default categories for revenue, expenses and transfers. Custom categories can be
          added in a future update.
        </p>
      </div>

      <Group title="Revenue" items={revenue} />
      <Group title="Expenses" items={expenses} />
      <Group title="Transfers" items={transfers} />

      <RulesSection rules={rules} categories={categories} onReload={onReload} />
    </div>
  );
}

function Group({ title, items }: { title: string; items: Category[] }) {
  return (
    <div>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </h2>
      <ul className="flex flex-wrap gap-2">
        {items.map((c) => (
          <li
            key={c.id}
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-700"
          >
            {c.name}
          </li>
        ))}
      </ul>
    </div>
  );
}

function RulesSection({
  rules,
  categories,
  onReload,
}: {
  rules: ClassificationRule[];
  categories: Category[];
  onReload: () => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [matchType, setMatchType] = useState<'from_address' | 'to_address'>('from_address');
  const [address, setAddress] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!isValidBchAddressFormat(address)) {
      setError('Enter a valid BCH address for the rule.');
      return;
    }
    if (!categoryId) {
      setError('Choose a category.');
      return;
    }
    setSaving(true);
    try {
      await putRule({
        id: uid(),
        name: name || `${matchType} rule`,
        matchType,
        address: normalizeAddress(address),
        categoryId,
        createdAt: new Date().toISOString(),
      });
      setName('');
      setAddress('');
      setCategoryId('');
      await onReload();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    await deleteRule(id);
    await onReload();
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-slate-800">Smart classification rules</h2>
      <p className="mt-1 text-xs text-slate-500">
        Deterministic rules only — no AI. Matching transactions are categorized automatically
        on the next scan.
      </p>

      <form onSubmit={add} className="mt-4 grid gap-3 sm:grid-cols-2">
        <input
          placeholder="Rule name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        <select
          value={matchType}
          onChange={(e) => setMatchType(e.target.value as 'from_address' | 'to_address')}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="from_address">Incoming from address →</option>
          <option value="to_address">Outgoing to address →</option>
        </select>
        <input
          placeholder="BCH address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono"
        />
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="">Select category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {error && <p className="sm:col-span-2 text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="sm:col-span-2 rounded-xl bg-teal-600 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Add rule'}
        </button>
      </form>

      {rules.length > 0 && (
        <ul className="mt-4 divide-y divide-slate-100">
          {rules.map((r) => {
            const cat = categories.find((c) => c.id === r.categoryId);
            return (
              <li key={r.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <p className="font-medium">{r.name}</p>
                  <p className="text-xs text-slate-500">
                    {r.matchType === 'from_address' ? 'From' : 'To'}{' '}
                    <span className="font-mono">{r.address.slice(0, 20)}…</span> →{' '}
                    {cat?.name || '—'}
                  </p>
                </div>
                <button
                  onClick={() => remove(r.id)}
                  className="text-xs text-rose-600 hover:underline"
                >
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
