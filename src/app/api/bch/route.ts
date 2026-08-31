import { NextRequest, NextResponse } from 'next/server';

const HASKOIN = 'https://api.blockchain.info/haskoin-store/bch';
const COINOBAPRIKA = 'https://api.coinpaprika.com/v1';
const BCH_ID = 'bch-bitcoin-cash';

function stripPrefix(address: string): string {
  return address.replace(/^bitcoincash:/i, '').trim();
}

async function fetchWithTimeout(url: string, ms = 20000): Promise<Response> {
  var controller = new AbortController();
  var id = setTimeout(function () {
    controller.abort();
  }, ms);
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
  return NextResponse.json(data, { status: status });
}

export async function GET(req: NextRequest) {
  try {
    var searchParams = new URL(req.url).searchParams;
    var action = searchParams.get('action');
    var address = searchParams.get('address');
    var txid = searchParams.get('txid');

    if (action === 'address' && address) {
      var addr = stripPrefix(address);
      var url =
        HASKOIN + '/address/' + encodeURIComponent(addr) + '/balance';
      var res = await fetchWithTimeout(url);
      var text = await res.text();
      if (!res.ok) {
        var isInvalid =
          res.status === 400 ||
          res.status === 404 ||
          text.indexOf('invalid') !== -1 ||
          text.indexOf('not-found') !== -1;
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
        var data = JSON.parse(text);
        return json({ provider: 'haskoin-mirror', data: data });
      } catch (e) {
        return json({ error: 'Provider returned invalid data' }, 502);
      }
    }

    if (action === 'txs' && address) {
      var addr2 = stripPrefix(address);
      var limit = searchParams.get('limit') || '50';
      var offset = searchParams.get('offset') || '0';
      var url2 =
        HASKOIN +
        '/address/' +
        encodeURIComponent(addr2) +
        '/transactions/full?limit=' +
        limit +
        '&offset=' +
        offset;
      var res2 = await fetchWithTimeout(url2);
      var text2 = await res2.text();
      if (!res2.ok) {
        var isInvalid2 =
          res2.status === 400 ||
          res2.status === 404 ||
          text2.indexOf('invalid') !== -1 ||
          text2.indexOf('not-found') !== -1;
        return json(
          {
            error: isInvalid2
              ? 'Invalid Bitcoin Cash address'
              : 'Could not load transactions',
            status: res2.status,
          },
          isInvalid2 ? 400 : 502
        );
      }
      try {
        var data2 = JSON.parse(text2);
        return json({
          provider: 'haskoin-mirror',
          data: Array.isArray(data2) ? data2 : [],
          offset: Number(offset),
          limit: Number(limit),
        });
      } catch (e) {
        return json({ error: 'Provider returned invalid data' }, 502);
      }
    }

    if (action === 'tx' && txid) {
      var url3 = HASKOIN + '/transaction/' + encodeURIComponent(txid);
      var res3 = await fetchWithTimeout(url3);
      var text3 = await res3.text();
      if (!res3.ok) {
        return json(
          { error: 'Transaction not found', status: res3.status },
          404
        );
      }
      try {
        var data3 = JSON.parse(text3);
        return json({ provider: 'haskoin-mirror', data: data3 });
      } catch (e) {
        return json({ error: 'Provider returned invalid data' }, 502);
      }
    }

    if (action === 'price') {
      var url4 = COINOBAPRIKA + '/tickers/' + BCH_ID;
      var res4 = await fetchWithTimeout(url4);
      var text4 = await res4.text();
      if (!res4.ok) {
        return json({ error: 'Price unavailable', available: false }, 502);
      }
      try {
        var raw = JSON.parse(text4);
        var usd = raw && raw.quotes && raw.quotes.USD && raw.quotes.USD.price;
        if (typeof usd !== 'number') {
          return json({ error: 'Price unavailable', available: false }, 502);
        }
        return json({
          provider: 'coinpaprika',
          data: {
            USD: usd,
            EUR: raw.quotes.EUR ? raw.quotes.EUR.price : null,
            GBP: raw.quotes.GBP ? raw.quotes.GBP.price : null,
          },
        });
      } catch (e) {
        return json({ error: 'Price unavailable', available: false }, 502);
      }
    }

    if (action === 'historical-price') {
      var ts = searchParams.get('timestamp');
      var currency = (searchParams.get('currency') || 'USD').toUpperCase();
      if (!ts) {
        return json({ error: 'timestamp required', available: false }, 400);
      }

      var date = new Date(Number(ts) * 1000);
      if (Number.isNaN(date.getTime())) {
        return json({ error: 'Invalid timestamp', available: false }, 400);
      }

      var yyyy = date.getUTCFullYear();
      var mm = String(date.getUTCMonth() + 1).padStart(2, '0');
      var dd = String(date.getUTCDate()).padStart(2, '0');
      var start = yyyy + '-' + mm + '-' + dd;

      var endDate = new Date(date);
      endDate.setUTCDate(endDate.getUTCDate() + 1);
      var end =
        endDate.getUTCFullYear() +
        '-' +
        String(endDate.getUTCMonth() + 1).padStart(2, '0') +
        '-' +
        String(endDate.getUTCDate()).padStart(2, '0');

      var url5 =
        COINOBAPRIKA +
        '/tickers/' +
        BCH_ID +
        '/historical?start=' +
        start +
        '&end=' +
        end +
        '&interval=1d';
      var res5 = await fetchWithTimeout(url5);
      var text5 = await res5.text();

      if (!res5.ok) {
        return json({
          error: 'Historical price unavailable',
          available: false,
          provider: 'coinpaprika',
        });
      }

      try {
        var rows = JSON.parse(text5);
        if (!Array.isArray(rows) || rows.length === 0) {
          return json({
            error: 'Historical price unavailable',
            available: false,
            provider: 'coinpaprika',
          });
        }
        var point = rows[0];
        var rate = typeof point.price === 'number' ? point.price : null;
        if (rate == null || rate <= 0) {
          return json({
            error: 'Historical price unavailable',
            available: false,
            provider: 'coinpaprika',
          });
        }
        var dataObj: Record<string, unknown> = {
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
      } catch (e) {
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
    var message =
      err instanceof Error ? err.message : 'Provider request failed';
    return json(
      {
        error:
          message.indexOf('abort') !== -1
            ? 'Request timed out'
            : 'Provider unavailable',
        detail: message,
      },
      502
    );
  }
}
