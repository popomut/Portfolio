import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { setmaiStock } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

async function fetchStockPrice(ticker: string): Promise<{ price: number | null; attempted: string[] }> {
  const attempted: string[] = [];

  try {
    // SET stocks — try .BK first, fall back to raw ticker.
    const tickerBK = `${ticker}.BK`;
    attempted.push(tickerBK);
    try {
      const quote = await yahooFinance.quote(tickerBK);
      if (quote.regularMarketPrice) {
        return { price: quote.regularMarketPrice, attempted };
      }
    } catch (e) {
      console.log(`[setmai yfinance] Failed: ${tickerBK}`, (e as Error).message);
    }

    attempted.push(ticker);
    try {
      const quote = await yahooFinance.quote(ticker);
      if (quote.regularMarketPrice) {
        return { price: quote.regularMarketPrice, attempted };
      }
    } catch (e) {
      console.log(`[setmai yfinance] Failed: ${ticker}`, (e as Error).message);
    }

    return { price: null, attempted };
  } catch (err) {
    console.error(`[setmai yfinance] Unexpected error for ${ticker}:`, err);
    return { price: null, attempted };
  }
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json().catch(() => ({}));
    const singleTicker = body.ticker as string | undefined;

    const allStocks = await db.select().from(setmaiStock);

    if (allStocks.length === 0) {
      return json({ success: true, updated: 0, errors: [] });
    }

    const stocks = singleTicker
      ? allStocks.filter(s => s.ticker.toUpperCase() === singleTicker.toUpperCase())
      : allStocks;

    if (stocks.length === 0) {
      return json({ success: true, updated: 0, errors: [] });
    }

    const results = [];
    const errors: { ticker: string; error: string }[] = [];

    for (const s of stocks) {
      try {
        const { price, attempted } = await fetchStockPrice(s.ticker);

        if (price !== null) {
          await db.update(setmaiStock)
            .set({ currentPrice: price, updatedAt: new Date().toISOString() })
            .where(eq(setmaiStock.ticker, s.ticker));

          results.push({ ticker: s.ticker, price });
        } else {
          errors.push({ ticker: s.ticker, error: `Could not fetch (tried: ${attempted.join(', ')})` });
        }
      } catch (err) {
        errors.push({ ticker: s.ticker, error: (err as Error).message });
      }

      await new Promise(resolve => setTimeout(resolve, 200));
    }

    return json({
      success: true,
      updated: results.length,
      results,
      errors
    });
  } catch (err) {
    return json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
};
