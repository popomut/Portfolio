import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { trendStock, trendTransaction } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const PATCH: RequestHandler = async ({ params, request }) => {
	const body = await request.json();
	const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
	if (body.currentPrice != null) patch.currentPrice = Number(body.currentPrice);
	if (body.atr != null) {
		patch.atr = Number(body.atr);
		patch.atrUpdatedAt = new Date().toISOString();
	}
	if (body.name != null) patch.name = String(body.name);

	const [updated] = await db
		.update(trendStock)
		.set(patch)
		.where(eq(trendStock.ticker, params.ticker.toUpperCase()))
		.returning();
	if (!updated) return json({ error: 'Not found' }, { status: 404 });
	return json(updated);
};

export const DELETE: RequestHandler = async ({ params }) => {
	const ticker = params.ticker.toUpperCase();
	await db.delete(trendTransaction).where(eq(trendTransaction.ticker, ticker));
	const [deleted] = await db.delete(trendStock).where(eq(trendStock.ticker, ticker)).returning();
	if (!deleted) return json({ error: 'Not found' }, { status: 404 });
	return json({ success: true });
};
