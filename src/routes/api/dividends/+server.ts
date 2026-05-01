import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { dividend } from '$lib/server/db/schema';
import { eq, asc } from 'drizzle-orm';

export const GET = async ({ url }) => {
	const ticker = url.searchParams.get('ticker');
	const rows = ticker
		? await db.select().from(dividend).where(eq(dividend.ticker, ticker)).orderBy(asc(dividend.exDate))
		: await db.select().from(dividend).orderBy(asc(dividend.exDate));
	return json(rows);
};

export const POST = async ({ request }) => {
	const body = await request.json();
	const [row] = await db.insert(dividend).values({
		ticker: body.ticker.toUpperCase(),
		exDate: body.exDate,
		payDate: body.payDate,
		sharesHeld: Number(body.sharesHeld),
		amountPerShare: Number(body.amountPerShare),
		totalAmount: Number(body.totalAmount),
		withholdingTax: Number(body.withholdingTax ?? 0),
		currency: body.currency ?? 'USD',
		notes: body.notes ?? ''
	}).returning();
	return json(row, { status: 201 });
};
