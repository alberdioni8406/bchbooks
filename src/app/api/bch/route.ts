import { NextRequest, NextResponse } from 'next/server';

/**
 * Lightweight proxy for BCH explorer data.
 * Primary: bchexplorer.cash (Esplora-style, public)
 * Fallback messaging when unavailable.
 *
 * Never returns fabricated transaction data.
 */

const BASE = 'https://bchexplorer.cash/api';

async function fetchWithTimeout(url: string, ms = 12000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
      next: { revalidate: 30 },
    });
  } finally {
    clearTimeout(id);
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');
  const address = searchParams.get('address');
  const txid = searchParams.get('txid');

  try {
    if (action === 'address' && address) {
      const res = await fetchWithTimeout(`${BASE}/address/${encodeURIComponent(address)}`);
      if (!res.ok) {
        return NextResponse.json(
          { error: 'Provider unavailable or address not found', status: res.status },
          { status: 502 }
        );
      }
      const data = await res.json();
      return NextResponse.json({ provider: 'bchexplorer.cash', data });
    }

    if (action === 'txs' && address) {
      // First page of confirmed + mempool
      const [chainRes, mempoolRes] = await Promise.all([
        fetchWithTimeout(`${BASE}/address/${encodeURIComponent(address)}/txs/chain`),
        fetchWithTimeout(`${BASE}/address/${encodeURIComponent(address)}/txs/mempool`),
      ]);

      const chain = chainRes.ok ? await chainRes.json() : [];
      const mempool = mempoolRes.ok ? await mempoolRes.json() : [];

      // Esplora returns up to ~25 confirmed; client can request more with last_seen later
      return NextResponse.json({
        provider: 'bchexplorer.cash',
        data: [...(Array.isArray(mempool) ? mempool : []), ...(Array.isArray(chain) ? chain : [])],
      });
    }

    if (action === 'tx' && txid) {
      const res = await fetchWithTimeout(`${BASE}/tx/${encodeURIComponent(txid)}`);
      if (!res.ok) {
        return NextResponse.json({ error: 'Transaction not found', status: res.status }, { status: 404 });
      }
      const data = await res.json();
      return NextResponse.json({ provider: 'bchexplorer.cash', data });
    }

    if (action === 'price') {
      const res = await fetchWithTimeout(`${BASE}/v1/prices`);
      if (!res.ok) {
        return NextResponse.json({ error: 'Price unavailable' }, { status: 502 });
      }
      const data = await res.json();
      return NextResponse.json({ provider: 'bchexplorer.cash', data });
    }

    if (action === 'historical-price') {
      const ts = searchParams.get('timestamp');
      const currency = searchParams.get('currency') || 'USD';
      if (!ts) {
        return NextResponse.json({ error: 'timestamp required' }, { status: 400 });
      }
      const res = await fetchWithTimeout(
        `${BASE}/v1/historical-price?currency=${currency}&timestamp=${ts}`
      );
      if (!res.ok) {
        return NextResponse.json({ error: 'Historical price unavailable', available: false }, { status: 502 });
      }
      const data = await res.json();
      return NextResponse.json({ provider: 'bchexplorer.cash', data, available: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Provider request failed';
    return NextResponse.json(
      { error: message.includes('abort') ? 'Request timed out' : 'Provider unavailable', detail: message },
      { status: 502 }
    );
  }
}
