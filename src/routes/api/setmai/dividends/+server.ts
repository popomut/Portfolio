import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { setmaiDividend } from '$lib/server/db/schema';
import { eq, asc } from 'drizzle-orm';

export const GET = async ({ url }) => {
	const ticker = url.searchParams.get('ticker');
	const rows = ticker
		? await db.select().from(setmaiDividend).where(eq(setmaiDividend.ticker, ticker)).orderBy(asc(setmaiDividend.exDate))
		: await db.select().from(setmaiDividend).orderBy(asc(setmaiDividend.exDate));
	return json(rows);
};

export const POST = async ({ request }) => {
	const body = await request.json();
	const [row] = await db.insert(setmaiDividend).values({
		ticker: body.ticker.toUpperCase(),
		exDate: body.exDate,
		payDate: body.payDate,
		sharesHeld: Number(body.sharesHeld),
		amountPerShare: Number(body.amountPerShare),
		totalAmount: Number(body.totalAmount),
		withholdingTax: Number(body.withholdingTax ?? 0),
		currency: body.currency ?? 'THB',
		notes: body.notes ?? ''
	}).returning();
	return json(row, { status: 201 });
};
