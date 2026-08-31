import { NextRequest, NextResponse } from 'next/server';

const HASKOIN = 'https://api.blockchain.info/haskoin-store/bch';
const COINOBAPRIKA = 'https://api.coinpaprika.com/v1';
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

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');
    const address = searchParams.get('address');
    const txid = searchParams.get('txid');

    if (action === 'address' && address) {
      const addr = stripPrefix(address);
      const url =
        HASKOIN +
        '/address/' +
        encodeURIComponent(addr) +
        '/balance';
      const res = await fetchWithTimeout(url);
      const text = await res.text();
      if (!res.ok) {
        const isInvalid =
          res.status === 400 ||
          res.status === 404 ||
          text.includes('invalid') ||
          text.includes('not-found');
        return json(
          {
            error: isInvalid
              ? 'Invalid Bitcoin Cash address or no data found'
              : 'Provider unavailable',
            status: res.status,
          },
          isInvalid ? 400 : 502
        );
      }
      try {
        const data = JSON.parse(text);
        return json({ provider: 'haskoin-mirror', data });
      } catch {
        return json({ error: 'Provider returned invalid data' }, 502);
      }
    }

    if (action === 'txs' && address) {
      const addr = stripPrefix(address);
      const limit = searchParams.get('limit') || '50';
      const url =
        HASKOIN +
        '/address/' +
        encodeURIComponent(addr) +
        '/transactions/full?limit=' +
        limit;
      const res = await fetchWithTimeout(url);
      const text = await res.text();
      if (!res.ok) {
        const isInvalid =
          res.status === 400 ||
          res.status === 404 ||
          text.includes('invalid') ||
          text.includes('not-found');
        return json(
          {
            error: isInvalid
              ? 'Invalid Bitcoin Cash address'
              : 'Could not load transactions',
            status: res.status,
          },
          isInvalid ? 400 : 502
        );
      }
      try {
        const data = JSON.parse(text);
        return json({
          provider: 'haskoin-mirror',
          data: Array.isArray(data) ? data : [],
        });
      } catch {
        return json({ error: 'Provider returned invalid data' }, 502);
      }
    }

    if (action === 'tx' && txid) {
      const url = HASKOIN + '/transaction/' + encodeURIComponent(txid);
      const res = await fetchWithTimeout(url);
      const text = await res.text();
      if (!res.ok) {
        return json({ error: 'Transaction not found', status: res.status }, 404);
      }
      try {
        const data = JSON.parse(text);
        return json({ provider: 'haskoin-mirror', data });
      } catch {
        return json({ error: 'Provider returned invalid data' }, 502);
      }
    }

    if (action === 'price') {
      const url = COINOBAPRIKA + '/tickers/' + BCH_ID;
      const res = await fetchWithTimeout(url);
      const text = await res.text();
      if (!res.ok) {
        return json({ error: 'Price unavailable', available: false }, 502);
      }
      try {
        const raw = JSON.parse(text);
        const usd = raw?.quotes?.USD?.price;
        if (typeof usd !== 'number') {
          return json({ error: 'Price unavailable', available: false }, 502);
        }
        return json({
          provider: 'coinpaprika',
          data: {
            USD: usd,
            EUR: raw?.quotes?.EUR?.price ?? null,
            GBP: raw?.quotes?.GBP?.price ?? null,
          },
        });
      } catch {
        return json({ error: 'Price unavailable', available: false }, 502);
      }
    }

    if (action === 'historical-price') {
      const ts = searchParams.get('timestamp');
      const currency = (searchParams.get('currency') || 'USD').toUpperCase();
      if (!ts) {
        return json({ error: 'timestamp required', available: false }, 400);
      }

      const date = new Date(Number(ts) * 1000);
      if (Number.isNaN(date.getTime())) {
        return json({ error: 'Invalid timestamp', available: false }, 400);
      }

      const yyyy = date.getUTCFullYear();
      const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(date.getUTCDate()).padStart(2, '0');
      const start = yyyy + '-' + mm + '-' + dd;

      const endDate = new Date(date);
      endDate.setUTCDate(endDate.getUTCDate() + 1);
      const end =
        endDate.getUTCFullYear() +
        '-' +
        String(endDate.getUTCMonth() + 1).padStart(2, '0') +
        '-' +
        String(endDate.getUTCDate()).padStart(2, '0');

      const url =
        COINOBAPRIKA +
        '/tickers/' +
        BCH_ID +
        '/historical?start=' +
        start +
        '&end=' +
        end +
        '&interval=1d';
      const res = await fetchWithTimeout(url);
      const text = await res.text();

      if (!res.ok) {
        return json({
          error: 'Historical price unavailable',
          available: false,
          provider: 'coinpaprika',
        });
      }

      try {
        const rows = JSON.parse(text);
        if (!Array.isArray(rows) || rows.length === 0) {
          return json({
            error: 'Historical price unavailable',
            available: false,
            provider: 'coinpaprika',
          });
        }
        const point = rows[0];
        const rate = typeof point.price === 'number' ? point.price : null;
        if (rate == null || rate <= 0) {
          return json({
            error: 'Historical price unavailable',
            available: false,
            provider: 'coinpaprika',
          });
        }
        const dataObj: Record<string, unknown> = {
          USD: rate,
          price: rate,
          timestamp: point.timestamp || start,
        };
        dataObj[currency] = rate;
        return json({
          provider: 'coinpaprika',
          available: true,
          data: dataObj,
        });
      } catch {
        return json({
          error: 'Historical price unavailable',
          available: false,
          provider: 'coinpaprika',
        });
      }
    }

    return json(
      {
        error:
          'Unknown action. Use action=address|txs|tx|price|historical-price',
      },
      400
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Provider request failed';
    return json(
      {
        error: message.includes('abort')
          ? 'Request timed out'
          : 'Provider unavailable',
        detail: message,
      },
      502
    );
  }
}
