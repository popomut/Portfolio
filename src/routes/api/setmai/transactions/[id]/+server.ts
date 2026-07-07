import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { setmaiTransaction, setmaiStock } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const PUT: RequestHandler = async ({ params, request }) => {
  const body = await request.json();
  const { ticker, type, date, shares, pricePerShare, fees = 0, notes = '' } = body;

  const [updated] = await db.update(setmaiTransaction)
    .set({ ticker: ticker?.toUpperCase(), type, date, shares: Number(shares), pricePerShare: Number(pricePerShare), fees: Number(fees), notes })
    .where(eq(setmaiTransaction.id, params.id))
    .returning();

  if (!updated) return json({ error: 'Not found' }, { status: 404 });
  return json(updated);
};

export const DELETE: RequestHandler = async ({ params }) => {
  const [deleted] = await db.delete(setmaiTransaction).where(eq(setmaiTransaction.id, params.id)).returning();
  if (!deleted) return json({ error: 'Not found' }, { status: 404 });

  const remaining = await db.select().from(setmaiTransaction).where(eq(setmaiTransaction.ticker, deleted.ticker));
  if (remaining.length === 0) {
    await db.delete(setmaiStock).where(eq(setmaiStock.ticker, deleted.ticker));
  }

  return json({ ok: true });
};
