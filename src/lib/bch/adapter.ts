/**
 * BCH Adapter — Haskoin Store mirror via /api/bch proxy.
 * Accounting engine never calls the chain API directly.
 */

import type { ProviderAddressInfo, ProviderTx } from '../providers/types';
import { normalizeAddress } from '../utils/bch-address';

const API = '/api/bch';

async function apiGet(params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`\( {API}? \){qs}`);
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || `Provider error ${res.status}`);
  }
  return json;
}

export async function fetchAddressInfo(
  address: string
): Promise<ProviderAddressInfo> {
  const addr = normalizeAddress(address);
  const { data } = await apiGet({ action: 'address', address: addr });

  // Haskoin balance:
  // { address, confirmed, unconfirmed, utxo, txs, received }
  const confirmed = Number(data.confirmed ?? 0);
  const unconfirmed = Number(data.unconfirmed ?? 0);
  const received = Number(data.received ?? confirmed);
  const txs = Number(data.txs ?? 0);

  return {
    address: addr,
    balanceSats: confirmed + unconfirmed,
    totalReceivedSats: received,
    totalSentSats: Math.max(0, received - confirmed),
    txCount: txs,
    unconfirmedBalanceSats: unconfirmed,
  };
}

export async function fetchAddressTransactions(
  address: string
): Promise<ProviderTx[]> {
  const addr = normalizeAddress(address);
  const { data } = await apiGet({
    action: 'txs',
    address: addr,
    limit: '50',
  });
  if (!Array.isArray(data)) return [];

  return data.map((raw: Record<string, unknown>): ProviderTx => {
    const block = (raw.block || {}) as Record<string, unknown>;
    const inputs = Array.isArray(raw.inputs) ? raw.inputs : [];
    const outputs = Array.isArray(raw.outputs) ? raw.outputs : [];
    const height = block.height != null ? Number(block.height) : null;
    const time = raw.time != null ? Number(raw.time) : null;

    return {
      txid: String(raw.txid || ''),
      blockHeight: height,
      blockTime: time,
      confirmations: height != null ? 1 : 0,
      feeSats: raw.fee != null ? Number(raw.fee) : null,
      vin: inputs.map((v: Record<string, unknown>) => ({
        address: (v.address as string) || null,
        valueSats: v.value != null ? Number(v.value) : null,
        isCoinbase: Boolean(v.coinbase),
      })),
      vout: outputs.map((o: Record<string, unknown>, i: number) => ({
        address: (o.address as string) || null,
        valueSats: Number(o.value || 0),
        n: i,
      })),
      memo: null,
    };
  });
}

export function satsToBch(sats: number): number {
  return sats / 1e8;
}

export function bchToSats(bch: number): number {
  return Math.round(bch * 1e8);
}
