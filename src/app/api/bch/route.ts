import { NextRequest, NextResponse } from 'next/server';

/**
 * Lightweight proxy for BCH explorer data.
 * Primary: bchexplorer.cash (Esplora-style, public)
 * Never returns fabricated transaction data.
 */

const BASE = 'https://bchexplorer.cash/api';

async function fetchWithTimeout(url: string, ms = 15000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
      // avoid Next caching failures across deploys
      cache: 'no-store',
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
      const res = await fetchWithTimeout(
        `\( {BASE}/address/ \){encodeURIComponent(address)}`
      );
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        const isInvalid =
          res.status === 400 ||
          body.toLowerCase().includes('invalid');
        return NextResponse.json(
          {
            error: isInvalid
              ? 'Invalid Bitcoin Cash address'
              : 'Provider unavailable or address not found',
            status: res.status,
            detail: body.slice(0, 200),
          },
          { status: isInvalid ? 400 : 502 }
        );
      }
      const data = await res.json();
      return NextResponse.json({ provider: 'bchexplorer.cash', data });
    }

    if (action === 'txs' && address) {
      // Use /txs (works) — do NOT use /txs/chain (405 on this provider)
      const [txsRes, mempoolRes] = await Promise.all([
        fetchWithTimeout(
          `\( {BASE}/address/ \){encodeURIComponent(address)}/txs`
        ),
        fetchWithTimeout(
          `\( {BASE}/address/ \){encodeURIComponent(address)}/txs/mempool`
        ),
      ]);

      if (!txsRes.ok && !mempoolRes.ok) {
        const body = await txsRes.text().catch(() => '');
        const isInvalid =
          txsRes.status === 400 ||
          body.toLowerCase().includes('invalid');
        return NextResponse.json(
          {
            error: isInvalid
              ? 'Invalid Bitcoin Cash address'
              : 'Could not load transactions from provider',
            status: txsRes.status,
          },
          { status: isInvalid ? 400 : 502 }
        );
      }

      const confirmed = txsRes.ok ? await txsRes.json() : [];
      const mempool = mempoolRes.ok ? await mempoolRes.json() : [];

      // Deduplicate by txid (mempool may overlap)
      const seen = new Set<string>();
      const merged: unknown[] = [];
      for (const tx of [
        ...(Array.isArray(mempool) ? mempool : []),
        ...(Array.isArray(confirmed) ? confirmed : []),
      ]) {
        const id = (tx as { txid?: string })?.txid;
        if (!id || seen.has(id)) continue;
        seen.add(id);
        merged.push(tx);
      }

      return NextResponse.json({
        provider: 'bchexplorer.cash',
        data: merged,
      });
    }

    if (action === 'tx' && txid) {
      const res = await fetchWithTimeout(
        `\( {BASE}/tx/ \){encodeURIComponent(txid)}`
      );
      if (!res.ok) {
        return NextResponse.json(
          { error: 'Transaction not found', status: res.status },
          { status: 404 }
        );
      }
      const data = await res.json();
      return NextResponse.json({ provider: 'bchexplorer.cash', data });
    }

    if (action === 'price') {
      const res = await fetchWithTimeout(`${BASE}/v1/prices`);
      if (!res.ok) {
        return NextResponse.json(
          { error: 'Price unavailable' },
          { status: 502 }
        );
      }
      const data = await res.json();
      return NextResponse.json({ provider: 'bchexplorer.cash', data });
    }

    if (action === 'historical-price') {
      const ts = searchParams.get('timestamp');
      const currency = searchParams.get('currency') || 'USD';
      if (!ts) {
        return NextResponse.json(
          { error: 'timestamp required' },
          { status: 400 }
        );
      }
      const res = await fetchWithTimeout(
        `\( {BASE}/v1/historical-price?currency= \){currency}&timestamp=${ts}`
      );
      if (!res.ok) {
        return NextResponse.json(
          { error: 'Historical price unavailable', available: false },
          { status: 502 }
        );
      }
      const data = await res.json();
      return NextResponse.json({
        provider: 'bchexplorer.cash',
        data,
        available: true,
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Provider request failed';
    return NextResponse.json(
      {
        error: message.includes('abort')
          ? 'Request timed out'
          : 'Provider unavailable',
        detail: message,
      },
      { status: 502 }
    );
  }
}
