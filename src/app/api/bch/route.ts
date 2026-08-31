import { NextRequest, NextResponse } from 'next/server';

/**
 * BCH data proxy
 * - Chain: Haskoin Store mirror (blockchain.info)
 * - Prices: CoinPaprika
 * Never fabricates transaction or price data.
 */

const HASKOIN = 'https://api.blockchain.info/haskoin-store/bch';
const COINPAPAPRIKA = 'https://api.coinpaprika.com/v1';
const BCH_ID = 'bch-bitcoin-cash';

function stripPrefix(address: string): string {
  return address.replace(/^bitcoincash:/i, '').trim();
}

async function fetchWithTimeout(url: string, ms = 15000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
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
      const addr = stripPrefix(address);
      const res = await fetchWithTimeout(
        `\( {HASKOIN}/address/ \){encodeURIComponent(addr)}/balance`
      );
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        const isInvalid =
          res.status === 400 ||
          res.status === 404 ||
          body.includes('invalid') ||
          body.includes('not-found');
        return NextResponse.json(
          {
            error: isInvalid
              ? 'Invalid Bitcoin Cash address or no data found'
              : 'Provider unavailable',
            status: res.status,
          },
          { status: isInvalid ? 400 : 502 }
        );
      }
      const data = await res.json();
      return NextResponse.json({ provider: 'haskoin-mirror', data });
    }

    if (action === 'txs' && address) {
      const addr = stripPrefix(address);
      const limit = searchParams.get('limit') || '50';
      const res = await fetchWithTimeout(
        `\( {HASKOIN}/address/ \){encodeURIComponent(addr)}/transactions/full?limit=${limit}`
      );
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        const isInvalid =
          res.status === 400 ||
          res.status === 404 ||
          body.includes('invalid') ||
          body.includes('not-found');
        return NextResponse.json(
          {
            error: isInvalid
              ? 'Invalid Bitcoin Cash address'
              : 'Could not load transactions',
            status: res.status,
          },
          { status: isInvalid ? 400 : 502 }
        );
      }
      const data = await res.json();
      return NextResponse.json({
        provider: 'haskoin-mirror',
        data: Array.isArray(data) ? data : [],
      });
    }

    if (action === 'tx' && txid) {
      const res = await fetchWithTimeout(
        `\( {HASKOIN}/transaction/ \){encodeURIComponent(txid)}`
      );
      if (!res.ok) {
        return NextResponse.json(
          { error: 'Transaction not found', status: res.status },
          { status: 404 }
        );
      }
      const data = await res.json();
      return NextResponse.json({ provider: 'haskoin-mirror', data });
    }

    if (action === 'price') {
      const res = await fetchWithTimeout(
        `\( {COINOBAPRIKA}/tickers/ \){BCH_ID}`
      );
      if (!res.ok) {
        return NextResponse.json({ error: 'Price unavailable' }, { status: 502 });
      }
      const raw = await res.json();
      const usd = raw?.quotes?.USD?.price;
      if (typeof usd !== 'number') {
        return NextResponse.json({ error: 'Price unavailable' }, { status: 502 });
      }
      return NextResponse.json({
        provider: 'coinpaprika',
        data: {
          USD: usd,
          EUR: raw?.quotes?.EUR?.price ?? null,
          GBP: raw?.quotes?.GBP?.price ?? null,
        },
      });
    }

    if (action === 'historical-price') {
      const ts = searchParams.get('timestamp');
      const currency = (searchParams.get('currency') || 'USD').toUpperCase();
      if (!ts) {
        return NextResponse.json({ error: 'timestamp required' }, { status: 400 });
      }

      const date = new Date(Number(ts) * 1000);
      if (Number.isNaN(date.getTime())) {
        return NextResponse.json(
          { error: 'Invalid timestamp', available: false },
          { status: 400 }
        );
      }

      const yyyy = date.getUTCFullYear();
      const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(date.getUTCDate()).padStart(2, '0');
      const start = `\( {yyyy}- \){mm}-${dd}`;

      const endDate = new Date(date);
      endDate.setUTCDate(endDate.getUTCDate() + 1);
      const end = `\( {endDate.getUTCFullYear()}- \){String(
        endDate.getUTCMonth() + 1
      ).padStart(2, '0')}-${String(endDate.getUTCDate()).padStart(2, '0')}`;

      const res = await fetchWithTimeout(
        `\( {COINOBAPRIKA}/tickers/ \){BCH_ID}/historical?start=\( {start}&end= \){end}&interval=1d`
      );

      if (!res.ok) {
        return NextResponse.json(
          {
            error: 'Historical price unavailable',
            available: false,
            provider: 'coinpaprika',
          },
          { status: 200 }
        );
      }

      const rows = await res.json();
      if (!Array.isArray(rows) || rows.length === 0) {
        return NextResponse.json(
          {
            error: 'Historical price unavailable',
            available: false,
            provider: 'coinpaprika',
          },
          { status: 200 }
        );
      }

      const point = rows[0];
      const rate = typeof point.price === 'number' ? point.price : null;
      if (rate == null || rate <= 0) {
        return NextResponse.json(
          {
            error: 'Historical price unavailable',
            available: false,
            provider: 'coinpaprika',
          },
          { status: 200 }
        );
      }

      return NextResponse.json({
        provider: 'coinpaprika',
        available: true,
        data: {
          [currency]: rate,
          USD: rate,
          price: rate,
          timestamp: point.timestamp || start,
        },
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Provider request failed';
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
