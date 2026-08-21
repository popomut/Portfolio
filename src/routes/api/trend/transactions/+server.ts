import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { trendStock, trendTransaction } from '$lib/server/db/schema';
import { eq, asc } from 'drizzle-orm';

export const GET: RequestHandler = async ({ url }) => {
	const ticker = url.searchParams.get('ticker');
	const rows = ticker
		? await db
				.select()
				.from(trendTransaction)
				.where(eq(trendTransaction.ticker, ticker.toUpperCase()))
				.orderBy(asc(trendTransaction.date))
		: await db.select().from(trendTransaction).orderBy(asc(trendTransaction.date));
	return json(rows);
};

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const {
		ticker,
		type,
		date,
		shares,
		pricePerShare,
		stopPrice = 0,
		atrAtEntry = 0,
		unitNumber = 1,
		fees = 0,
		notes = ''
	} = body;

	if (!ticker || !type || !date || shares == null || pricePerShare == null) {
		return json({ error: 'Missing required fields' }, { status: 400 });
	}

	const tickerUp = String(ticker).toUpperCase();

	// Auto-assign next unit number based on the CURRENT OPEN CYCLE.
	// A cycle ends when running balance hits zero (Sell All). The next
	// buy after that starts a fresh cycle at Unit 1.
	let unit = Number(unitNumber);
	if (type === 'buy' && (!body.unitNumber || Number(body.unitNumber) < 1)) {
		const all = await db
			.select()
			.from(trendTransaction)
			.where(eq(trendTransaction.ticker, tickerUp))
			.orderBy(asc(trendTransaction.date));

		let balance = 0;
		let unitsInCurrentCycle = 0;
		const sorted = [...all].sort((a, b) => {
			if (a.date !== b.date) return a.date < b.date ? -1 : 1;
			const ca = a.createdAt ?? '';
			const cb = b.createdAt ?? '';
			return ca < cb ? -1 : ca > cb ? 1 : 0;
		});
		for (const t of sorted) {
			if (t.type === 'buy') {
				if (balance <= 0.0001) unitsInCurrentCycle = 0; // new cycle
				unitsInCurrentCycle += 1;
				balance += t.shares;
			} else if (t.type === 'sell') {
				balance -= t.shares;
				if (balance <= 0.0001) {
					balance = 0;
					unitsInCurrentCycle = 0;
				}
			}
		}
		unit = unitsInCurrentCycle + 1;
	}

	const [tx] = await db
		.insert(trendTransaction)
		.values({
			ticker: tickerUp,
			type,
			unitNumber: unit,
			date,
			shares: Number(shares),
			pricePerShare: Number(pricePerShare),
			stopPrice: Number(stopPrice),
			atrAtEntry: Number(atrAtEntry),
			fees: Number(fees),
			notes: notes || ''
		})
		.returning();

	await db
		.insert(trendStock)
		.values({
			ticker: tickerUp,
			name: '',
			currentPrice: Number(pricePerShare),
			currency: 'THB',
			atr: Number(atrAtEntry) || 0,
			atrUpdatedAt: Number(atrAtEntry) > 0 ? new Date().toISOString() : null,
			updatedAt: new Date().toISOString()
		})
		.onConflictDoUpdate({
			target: trendStock.ticker,
			set: { updatedAt: new Date().toISOString() }
		});

	return json(tx, { status: 201 });
};
