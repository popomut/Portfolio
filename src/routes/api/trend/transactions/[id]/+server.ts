import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { trendTransaction, trendStock } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const DELETE: RequestHandler = async ({ params }) => {
	const [deleted] = await db
		.delete(trendTransaction)
		.where(eq(trendTransaction.id, params.id))
		.returning();
	if (!deleted) return json({ error: 'Not found' }, { status: 404 });

	const remaining = await db
		.select()
		.from(trendTransaction)
		.where(eq(trendTransaction.ticker, deleted.ticker));
	if (remaining.length === 0) {
		await db.delete(trendStock).where(eq(trendStock.ticker, deleted.ticker));
	}
	return json({ ok: true });
};
