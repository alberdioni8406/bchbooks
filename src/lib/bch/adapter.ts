/**
 * BCH Adapter – isolates blockchain access from the accounting engine.
 * Uses the internal /api/bch proxy (provider-agnostic interface).
 */

import type { ProviderAddressInfo, ProviderTx } from '../providers/types';
import { normalizeAddress } from '../utils/bch-address';

const API = '/api/bch';

async function apiGet(params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${API}?${qs}`);
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || `Provider error ${res.status}`);
  }
  return json;
}

export async function fetchAddressInfo(address: string): Promise<ProviderAddressInfo> {
  const addr = normalizeAddress(address);
  const { data } = await apiGet({ action: 'address', address: addr });
  // Esplora-style: chain_stats / mempool_stats
  const chain = data.chain_stats || {};
  const mem = data.mempool_stats || {};
  return {
    address: addr,
    balanceSats: (chain.funded_txo_sum || 0) - (chain.spent_txo_sum || 0) +
      ((mem.funded_txo_sum || 0) - (mem.spent_txo_sum || 0)),
    totalReceivedSats: chain.funded_txo_sum || 0,
    totalSentSats: chain.spent_txo_sum || 0,
    txCount: (chain.tx_count || 0) + (mem.tx_count || 0),
    unconfirmedBalanceSats: (mem.funded_txo_sum || 0) - (mem.spent_txo_sum || 0),
  };
}

export async function fetchAddressTransactions(address: string): Promise<ProviderTx[]> {
  const addr = normalizeAddress(address);
  const { data } = await apiGet({ action: 'txs', address: addr });
  if (!Array.isArray(data)) return [];

  return data.map((raw: Record<string, unknown>): ProviderTx => {
    const status = (raw.status || {}) as Record<string, unknown>;
    const vin = Array.isArray(raw.vin) ? raw.vin : [];
    const vout = Array.isArray(raw.vout) ? raw.vout : [];

    return {
      txid: String(raw.txid || ''),
      blockHeight: status.block_height != null ? Number(status.block_height) : null,
      blockTime: status.block_time != null ? Number(status.block_time) : null,
      confirmations: status.confirmed ? 1 : 0, // real count needs tip height; approximate
      feeSats: raw.fee != null ? Number(raw.fee) : null,
      vin: vin.map((v: Record<string, unknown>) => {
        const prev = (v.prevout || {}) as Record<string, unknown>;
        return {
          address: (prev.scriptpubkey_address as string) || null,
          valueSats: prev.value != null ? Number(prev.value) : null,
          isCoinbase: Boolean(v.is_coinbase),
        };
      }),
      vout: vout.map((o: Record<string, unknown>, i: number) => ({
        address: (o.scriptpubkey_address as string) || null,
        valueSats: Number(o.value || 0),
        n: i,
      })),
      memo: null, // memo extraction can be added when OP_RETURN parsing is available
    };
  });
}

export function satsToBch(sats: number): number {
  return sats / 1e8;
}

export function bchToSats(bch: number): number {
  return Math.round(bch * 1e8);
}
