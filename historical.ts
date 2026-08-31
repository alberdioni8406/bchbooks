/**
 * Historical BCH valuation.
 * Never invents a price. Marks unavailable when provider cannot supply data.
 */

import type { FiatCurrency, HistoricalValuation } from '../types';

const cache = new Map<string, HistoricalValuation>();

export async function getHistoricalValuation(
  timestampUnix: number | null,
  amountBch: number,
  fiat: FiatCurrency = 'USD'
): Promise<HistoricalValuation> {
  if (timestampUnix == null || !Number.isFinite(timestampUnix) || amountBch === 0) {
    return {
      fiatAmount: null,
      fiatCurrency: fiat,
      exchangeRate: null,
      rateTimestamp: null,
      provider: null,
      available: false,
    };
  }

  const dayKey = `${Math.floor(timestampUnix / 86400)}-${fiat}`;
  if (cache.has(dayKey)) {
    const cached = cache.get(dayKey)!;
    if (!cached.available || cached.exchangeRate == null) {
      return { ...cached, fiatAmount: null };
    }
    return {
      ...cached,
      fiatAmount: amountBch * cached.exchangeRate,
    };
  }

  try {
    const qs = new URLSearchParams({
      action: 'historical-price',
      timestamp: String(timestampUnix),
      currency: fiat,
    });
    const res = await fetch(`/api/bch?${qs}`);
    const json = await res.json();

    if (!res.ok || !json.available || json.data == null) {
      const unavailable: HistoricalValuation = {
        fiatAmount: null,
        fiatCurrency: fiat,
        exchangeRate: null,
        rateTimestamp: null,
        provider: json.provider || null,
        available: false,
      };
      cache.set(dayKey, unavailable);
      return unavailable;
    }

    // bchexplorer historical-price response shape may vary; handle common cases
    let rate: number | null = null;
    const d = json.data;
    if (typeof d === 'number') rate = d;
    else if (d && typeof d[fiat] === 'number') rate = d[fiat];
    else if (d && typeof d.price === 'number') rate = d.price;
    else if (d && typeof d.USD === 'number') rate = d.USD;

    if (rate == null || !Number.isFinite(rate) || rate <= 0) {
      const unavailable: HistoricalValuation = {
        fiatAmount: null,
        fiatCurrency: fiat,
        exchangeRate: null,
        rateTimestamp: null,
        provider: json.provider || 'bchexplorer.cash',
        available: false,
      };
      cache.set(dayKey, unavailable);
      return unavailable;
    }

    const valuation: HistoricalValuation = {
      fiatAmount: amountBch * rate,
      fiatCurrency: fiat,
      exchangeRate: rate,
      rateTimestamp: new Date(timestampUnix * 1000).toISOString(),
      provider: json.provider || 'bchexplorer.cash',
      available: true,
    };
    cache.set(dayKey, { ...valuation, fiatAmount: null }); // store rate only
    return valuation;
  } catch {
    return {
      fiatAmount: null,
      fiatCurrency: fiat,
      exchangeRate: null,
      rateTimestamp: null,
      provider: null,
      available: false,
    };
  }
}

/** Live price (for display only – never overwrite historical records) */
export async function getLivePrice(fiat: FiatCurrency = 'USD'): Promise<number | null> {
  try {
    const res = await fetch('/api/bch?action=price');
    const json = await res.json();
    if (!res.ok) return null;
    const d = json.data;
    if (d && typeof d[fiat] === 'number') return d[fiat];
    if (d && typeof d.USD === 'number') return d.USD;
    return null;
  } catch {
    return null;
  }
}
