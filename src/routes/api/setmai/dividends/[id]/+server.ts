import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { setmaiDividend } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const PUT = async ({ params, request }) => {
	const body = await request.json();
	const [row] = await db.update(setmaiDividend).set({
		exDate: body.exDate,
		payDate: body.payDate,
		sharesHeld: Number(body.sharesHeld),
		amountPerShare: Number(body.amountPerShare),
		totalAmount: Number(body.totalAmount),
		withholdingTax: Number(body.withholdingTax ?? 0),
		currency: body.currency ?? 'THB',
		notes: body.notes ?? ''
	}).where(eq(setmaiDividend.id, params.id)).returning();
	return json(row);
};

export const DELETE = async ({ params }) => {
	await db.delete(setmaiDividend).where(eq(setmaiDividend.id, params.id));
	return json({ ok: true });
};
