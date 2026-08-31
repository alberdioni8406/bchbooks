/**
 * Normalize raw provider transactions into accounting records.
 * Accounting engine only sees NormalizedTransaction objects.
 */

import type {
  NormalizedTransaction,
  ClassificationRule,
  Category,
  FiatCurrency,
  TxDirection,
} from '../types';
import type { ProviderTx } from '../providers/types';
import { satsToBch } from '../bch/adapter';
import { getHistoricalValuation } from '../pricing/historical';
import { uid } from '../storage/db';

function netForAddress(tx: ProviderTx, watched: string): { direction: TxDirection; amountSats: number; counterparty: string | null } {
  const watchedLower = watched.toLowerCase().replace('bitcoincash:', '');
  const matchAddr = (a: string | null) =>
    a != null && a.toLowerCase().replace('bitcoincash:', '') === watchedLower;

  let received = 0;
  let sent = 0;
  let counterparty: string | null = null;

  for (const o of tx.vout) {
    if (matchAddr(o.address)) received += o.valueSats;
    else if (o.address && !counterparty) counterparty = o.address;
  }
  for (const i of tx.vin) {
    if (matchAddr(i.address)) sent += i.valueSats ?? 0;
    else if (i.address && !counterparty) counterparty = i.address;
  }

  const net = received - sent;
  if (net > 0) return { direction: 'incoming', amountSats: net, counterparty };
  if (net < 0) return { direction: 'outgoing', amountSats: Math.abs(net), counterparty };
  // zero net – treat as internal if any movement, else skip later
  return { direction: 'internal', amountSats: 0, counterparty };
}

export async function normalizeProviderTxs(
  providerTxs: ProviderTx[],
  watchedAddress: string,
  allWatchedAddresses: string[],
  rules: ClassificationRule[],
  categories: Category[],
  fiat: FiatCurrency
): Promise<NormalizedTransaction[]> {
  const watchedSet = new Set(
    allWatchedAddresses.map((a) => a.toLowerCase().replace('bitcoincash:', ''))
  );
  const results: NormalizedTransaction[] = [];
  const now = new Date().toISOString();

  for (const ptx of providerTxs) {
    if (!ptx.txid) continue;
    const { direction: baseDir, amountSats, counterparty } = netForAddress(ptx, watchedAddress);
    if (amountSats === 0 && baseDir !== 'internal') continue;

    // Detect internal transfer between own addresses
    let direction = baseDir;
    if (counterparty) {
      const cp = counterparty.toLowerCase().replace('bitcoincash:', '');
      if (watchedSet.has(cp)) direction = 'internal';
    }

    const amountBch = satsToBch(amountSats);
    const valuation = await getHistoricalValuation(ptx.blockTime, amountBch, fiat);

    // Apply classification rules
    let categoryId: string | null = null;
    for (const rule of rules) {
      const ruleAddr = rule.address.toLowerCase().replace('bitcoincash:', '');
      const cp = (counterparty || '').toLowerCase().replace('bitcoincash:', '');
      if (rule.matchType === 'from_address' && direction === 'incoming' && cp === ruleAddr) {
        categoryId = rule.categoryId;
        break;
      }
      if (rule.matchType === 'to_address' && direction === 'outgoing' && cp === ruleAddr) {
        categoryId = rule.categoryId;
        break;
      }
    }

    // Default categorization when no rule
    if (!categoryId) {
      if (direction === 'internal') {
        const internal = categories.find((c) => c.name === 'Internal transfer');
        categoryId = internal?.id ?? null;
      } else if (direction === 'incoming') {
        // leave uncategorized (null) so user can assign
        categoryId = null;
      } else {
        categoryId = null;
      }
    }

    results.push({
      id: `${watchedAddress}:${ptx.txid}`,
      address: watchedAddress,
      txid: ptx.txid,
      date: ptx.blockTime
        ? new Date(ptx.blockTime * 1000).toISOString()
        : now,
      blockHeight: ptx.blockHeight,
      confirmations: ptx.confirmations,
      direction,
      amountBch,
      amountSats,
      feeBch: ptx.feeSats != null ? satsToBch(ptx.feeSats) : null,
      memo: ptx.memo ?? null,
      categoryId,
      notes: null,
      status: ptx.blockHeight != null ? 'confirmed' : 'unconfirmed',
      valuation,
      counterparty,
      createdAt: now,
      updatedAt: now,
    });
  }

  return results;
}
