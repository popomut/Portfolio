import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { stock } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

async function fetchStockPrice(ticker: string): Promise<{ price: number | null; attempted: string[] }> {
  const attempted: string[] = [];
  
  try {
    // Try with .BK suffix first (for Thai SET stocks)
    const tickerBK = `${ticker}.BK`;
    attempted.push(tickerBK);
    try {
      console.log(`[yfinance] Trying: ${tickerBK}`);
      const quote = await yahooFinance.quote(tickerBK);
      if (quote.regularMarketPrice) {
        console.log(`[yfinance] Success: ${tickerBK} = ${quote.regularMarketPrice}`);
        return { price: quote.regularMarketPrice, attempted };
      }
    } catch (e) {
      console.log(`[yfinance] Failed: ${tickerBK}`, (e as Error).message);
    }

    // Try with the ticker as-is
    attempted.push(ticker);
    try {
      console.log(`[yfinance] Trying: ${ticker}`);
      const quote = await yahooFinance.quote(ticker);
      if (quote.regularMarketPrice) {
        console.log(`[yfinance] Success: ${ticker} = ${quote.regularMarketPrice}`);
        return { price: quote.regularMarketPrice, attempted };
      }
    } catch (e) {
      console.log(`[yfinance] Failed: ${ticker}`, (e as Error).message);
    }

    // Try other common suffixes
    const suffixes = ['.HK', '.L', '.TO', '.AX'];
    for (const suffix of suffixes) {
      const tickerWithSuffix = `${ticker}${suffix}`;
      attempted.push(tickerWithSuffix);
      try {
        console.log(`[yfinance] Trying: ${tickerWithSuffix}`);
        const quote = await yahooFinance.quote(tickerWithSuffix);
        if (quote.regularMarketPrice) {
          console.log(`[yfinance] Success: ${tickerWithSuffix} = ${quote.regularMarketPrice}`);
          return { price: quote.regularMarketPrice, attempted };
        }
      } catch (e) {
        console.log(`[yfinance] Failed: ${tickerWithSuffix}`, (e as Error).message);
      }
    }

    console.log(`[yfinance] All attempts failed for ${ticker}`);
    return { price: null, attempted };
  } catch (err) {
    console.error(`[yfinance] Unexpected error for ${ticker}:`, err);
    return { price: null, attempted };
  }
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json().catch(() => ({}));
    const singleTicker = body.ticker as string | undefined;

    // Get stocks
    const allStocks = await db.select().from(stock);

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

    // Fetch prices
    for (const s of stocks) {
      try {
        const { price, attempted } = await fetchStockPrice(s.ticker);

        if (price !== null) {
          const updated = await db.update(stock)
            .set({ currentPrice: price, updatedAt: new Date().toISOString() })
            .where(eq(stock.ticker, s.ticker))
            .returning();

          console.log(`[API] Updated ${s.ticker}: ${price} (${updated.length} rows)`);
          results.push({ ticker: s.ticker, price });
        } else {
          errors.push({ ticker: s.ticker, error: `Could not fetch (tried: ${attempted.join(', ')})` });
        }
      } catch (err) {
        errors.push({ ticker: s.ticker, error: (err as Error).message });
      }

      // Add small delay between requests to avoid rate limiting
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
