import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { trendStock } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import YahooFinance from 'yahoo-finance2';
import { computeATR, type OhlcBar } from '$lib/utils/trend';

const yahooFinance = new YahooFinance();

async function fetchOhlc(ticker: string): Promise<{ symbol: string; bars: OhlcBar[] } | null> {
	// Try SET first (.BK), then raw.
	const candidates = [`${ticker}.BK`, ticker];
	const period2 = new Date();
	const period1 = new Date(period2);
	period1.setDate(period1.getDate() - 180); // ~6 months of daily bars → enough for ATR(20)

	for (const symbol of candidates) {
		try {
			const rows = await yahooFinance.historical(symbol, {
				period1,
				period2,
				interval: '1d'
			});
			if (Array.isArray(rows) && rows.length > 0) {
				const bars: OhlcBar[] = rows
					.filter((r) => r.high != null && r.low != null && r.close != null)
					.map((r) => ({
						date: (r.date instanceof Date ? r.date : new Date(r.date)).toISOString().slice(0, 10),
						high: Number(r.high),
						low: Number(r.low),
						close: Number(r.close)
					}));
				if (bars.length > 0) return { symbol, bars };
			}
		} catch (e) {
			console.log(`[trend yfinance] historical failed for ${symbol}:`, (e as Error).message);
		}
	}
	return null;
}

export const POST: RequestHandler = async ({ request, url }) => {
	const body = await request.json().catch(() => ({}));
	const ticker = String(body.ticker ?? url.searchParams.get('ticker') ?? '').toUpperCase();
	const period = Number(body.period ?? url.searchParams.get('period') ?? 20);
	const persist = body.persist !== false;

	if (!ticker) return json({ error: 'ticker required' }, { status: 400 });

	const result = await fetchOhlc(ticker);
	if (!result) return json({ error: 'no OHLC data found', ticker }, { status: 404 });

	const atr = computeATR(result.bars, period);
	if (atr == null) return json({ error: 'not enough bars for ATR', ticker, bars: result.bars.length }, { status: 400 });

	const latest = result.bars[result.bars.length - 1];

	if (persist) {
		await db
			.insert(trendStock)
			.values({
				ticker,
				name: '',
				currentPrice: latest.close,
				currency: 'THB',
				atr,
				atrUpdatedAt: new Date().toISOString(),
				updatedAt: new Date().toISOString()
			})
			.onConflictDoUpdate({
				target: trendStock.ticker,
				set: {
					currentPrice: latest.close,
					atr,
					atrUpdatedAt: new Date().toISOString(),
					updatedAt: new Date().toISOString()
				}
			});
	}

	return json({
		ticker,
		symbol: result.symbol,
		bars: result.bars.length,
		latestDate: latest.date,
		latestClose: latest.close,
		period,
		atr
	});
};

// Refresh ATR + price for ALL existing trend stocks.
export const PUT: RequestHandler = async () => {
	const stocks = await db.select().from(trendStock);
	const results: Array<{ ticker: string; ok: boolean; atr?: number; price?: number; error?: string }> = [];
	for (const s of stocks) {
		try {
			const fetched = await fetchOhlc(s.ticker);
			if (!fetched) {
				results.push({ ticker: s.ticker, ok: false, error: 'no OHLC' });
				continue;
			}
			const atr = computeATR(fetched.bars, 20);
			const latest = fetched.bars[fetched.bars.length - 1];
			if (atr == null) {
				results.push({ ticker: s.ticker, ok: false, error: 'not enough bars' });
				continue;
			}
			await db
				.update(trendStock)
				.set({
					currentPrice: latest.close,
					atr,
					atrUpdatedAt: new Date().toISOString(),
					updatedAt: new Date().toISOString()
				})
				.where(eq(trendStock.ticker, s.ticker));
			results.push({ ticker: s.ticker, ok: true, atr, price: latest.close });
		} catch (err) {
			results.push({ ticker: s.ticker, ok: false, error: (err as Error).message });
		}
		await new Promise((r) => setTimeout(r, 200));
	}
	return json({ updated: results.filter((r) => r.ok).length, results });
};
