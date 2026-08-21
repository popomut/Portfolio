import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { trendTransaction, trendStock } from '$lib/server/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { splitCycles, cycleTxnIds } from '$lib/server/trend-cycles';

// POST /api/trend/cycles/delete
//   { mode: 'cycle', ticker, cycleIndex }  → delete one closed cycle
//   { mode: 'ticker-closed', ticker }      → delete all closed cycles for a ticker
//   { mode: 'all-closed' }                 → delete every closed cycle across all tickers
//
// Open cycles are NEVER touched. If a ticker has no remaining transactions
// after deletion, its trend_stock row is dropped too.
export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => ({}));
	const mode = String(body.mode ?? 'cycle');

	const affectedTickers = new Set<string>();
	let deleted = 0;

	if (mode === 'cycle') {
		const ticker = String(body.ticker ?? '').toUpperCase();
		const cycleIndex = Number(body.cycleIndex);
		if (!ticker || !cycleIndex || cycleIndex < 1) {
			return json({ error: 'ticker and cycleIndex required' }, { status: 400 });
		}
		const rows = await db.select().from(trendTransaction).where(eq(trendTransaction.ticker, ticker));
		const cycles = splitCycles(rows);
		const target = cycles[cycleIndex - 1];
		if (!target) return json({ error: 'cycle not found' }, { status: 404 });
		if (target.isOpen) return json({ error: 'cannot delete open cycle' }, { status: 400 });

		const ids = cycleTxnIds(rows, cycleIndex);
		if (ids.length > 0) {
			const res = await db.delete(trendTransaction).where(inArray(trendTransaction.id, ids)).returning();
			deleted += res.length;
			affectedTickers.add(ticker);
		}
	} else if (mode === 'ticker-closed') {
		const ticker = String(body.ticker ?? '').toUpperCase();
		if (!ticker) return json({ error: 'ticker required' }, { status: 400 });
		const rows = await db.select().from(trendTransaction).where(eq(trendTransaction.ticker, ticker));
		const cycles = splitCycles(rows);
		const idsToDelete: string[] = [];
		for (let i = 0; i < cycles.length; i++) {
			if (!cycles[i].isOpen) idsToDelete.push(...cycleTxnIds(rows, i + 1));
		}
		if (idsToDelete.length > 0) {
			const res = await db
				.delete(trendTransaction)
				.where(inArray(trendTransaction.id, idsToDelete))
				.returning();
			deleted += res.length;
			affectedTickers.add(ticker);
		}
	} else if (mode === 'all-closed') {
		const all = await db.select().from(trendTransaction);
		const byTicker = new Map<string, typeof all>();
		for (const t of all) {
			if (!byTicker.has(t.ticker)) byTicker.set(t.ticker, []);
			byTicker.get(t.ticker)!.push(t);
		}
		const idsToDelete: string[] = [];
		for (const [ticker, rows] of byTicker) {
			const cycles = splitCycles(rows);
			for (let i = 0; i < cycles.length; i++) {
				if (!cycles[i].isOpen) idsToDelete.push(...cycleTxnIds(rows, i + 1));
			}
			affectedTickers.add(ticker);
		}
		if (idsToDelete.length > 0) {
			const res = await db
				.delete(trendTransaction)
				.where(inArray(trendTransaction.id, idsToDelete))
				.returning();
			deleted += res.length;
		}
	} else {
		return json({ error: `unknown mode: ${mode}` }, { status: 400 });
	}

	// Drop trend_stock rows for tickers with zero transactions left.
	for (const ticker of affectedTickers) {
		const remaining = await db.select().from(trendTransaction).where(eq(trendTransaction.ticker, ticker));
		if (remaining.length === 0) {
			await db.delete(trendStock).where(eq(trendStock.ticker, ticker));
		}
	}

	return json({ deleted, tickers: Array.from(affectedTickers) });
};
