import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { setmaiStock, setmaiTransaction, setmaiDividend } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const PATCH: RequestHandler = async ({ params, request }) => {
  const body = await request.json();
  const { currentPrice } = body;

  if (currentPrice == null) return json({ error: 'currentPrice required' }, { status: 400 });

  const [updated] = await db.update(setmaiStock)
    .set({ currentPrice: Number(currentPrice), updatedAt: new Date().toISOString() })
    .where(eq(setmaiStock.ticker, params.ticker.toUpperCase()))
    .returning();

  if (!updated) return json({ error: 'Not found' }, { status: 404 });
  return json(updated);
};

export const DELETE: RequestHandler = async ({ params }) => {
  const ticker = params.ticker.toUpperCase();

  await db.delete(setmaiTransaction).where(eq(setmaiTransaction.ticker, ticker));
  await db.delete(setmaiDividend).where(eq(setmaiDividend.ticker, ticker));

  const [deleted] = await db.delete(setmaiStock).where(eq(setmaiStock.ticker, ticker)).returning();

  if (!deleted) return json({ error: 'Not found' }, { status: 404 });
  return json({ success: true });
};
