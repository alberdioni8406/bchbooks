/**
 * BCH Adapter — Haskoin Store mirror via /api/bch proxy.
 * Loads full address history by paginating limit + offset.
 */

import type { ProviderAddressInfo, ProviderTx } from '../providers/types';
import { normalizeAddress } from '../utils/bch-address';

var API = '/api/bch';
var PAGE_SIZE = 50;
var MAX_TXS = 10000;

async function apiGet(params: Record<string, string>) {
  var qs = new URLSearchParams(params).toString();
  var url = API + '?' + qs;
  var res = await fetch(url);
  var text = await res.text();

  if (text.trimStart().charAt(0) === '<') {
    throw new Error(
      'API route returned HTML instead of JSON. Check that src/app/api/bch/route.ts is deployed. URL was: ' +
        url
    );
  }

  var json: Record<string, unknown>;
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch (e) {
    throw new Error('Provider returned invalid JSON');
  }

  if (!res.ok) {
    throw new Error(
      (typeof json.error === 'string' && json.error) ||
        'Provider error ' + String(res.status)
    );
  }

  return json;
}

function mapTx(raw: Record<string, unknown>): ProviderTx {
  var block = (raw.block || {}) as Record<string, unknown>;
  var inputs = Array.isArray(raw.inputs) ? raw.inputs : [];
  var outputs = Array.isArray(raw.outputs) ? raw.outputs : [];
  var height = block.height != null ? Number(block.height) : null;
  var time = raw.time != null ? Number(raw.time) : null;

  return {
    txid: String(raw.txid || ''),
    blockHeight: height,
    blockTime: time,
    confirmations: height != null ? 1 : 0,
    feeSats: raw.fee != null ? Number(raw.fee) : null,
    vin: inputs.map(function (v: Record<string, unknown>) {
      return {
        address: (v.address as string) || null,
        valueSats: v.value != null ? Number(v.value) : null,
        isCoinbase: Boolean(v.coinbase),
      };
    }),
    vout: outputs.map(function (o: Record<string, unknown>, i: number) {
      return {
        address: (o.address as string) || null,
        valueSats: Number(o.value || 0),
        n: i,
      };
    }),
    memo: null,
  };
}

export async function fetchAddressInfo(
  address: string
): Promise<ProviderAddressInfo> {
  var addr = normalizeAddress(address);
  var result = (await apiGet({
    action: 'address',
    address: addr,
  })) as { data: Record<string, unknown> };
  var data = result.data;

  var confirmed = Number(data.confirmed ?? 0);
  var unconfirmed = Number(data.unconfirmed ?? 0);
  var received = Number(data.received ?? confirmed);
  var txs = Number(data.txs ?? 0);

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
  var addr = normalizeAddress(address);
  var all: ProviderTx[] = [];
  var offset = 0;
  var seen: Record<string, boolean> = {};

  while (all.length < MAX_TXS) {
    var result = (await apiGet({
      action: 'txs',
      address: addr,
      limit: String(PAGE_SIZE),
      offset: String(offset),
    })) as { data: unknown };

    var data = result.data;
    if (!Array.isArray(data) || data.length === 0) {
      break;
    }

    for (var i = 0; i < data.length; i++) {
      var raw = data[i] as Record<string, unknown>;
      var mapped = mapTx(raw);
      if (!mapped.txid || seen[mapped.txid]) continue;
      seen[mapped.txid] = true;
      all.push(mapped);
    }

    if (data.length < PAGE_SIZE) {
      break;
    }
    offset = offset + PAGE_SIZE;
  }

  return all;
}

export function satsToBch(sats: number): number {
  return sats / 1e8;
}

export function bchToSats(bch: number): number {
  return Math.round(bch * 1e8);
}
