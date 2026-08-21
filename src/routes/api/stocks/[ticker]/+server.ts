import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { stock, transaction, dividend, sellLotMatch } from '$lib/server/db/schema';
import { eq, inArray } from 'drizzle-orm';

export const PATCH: RequestHandler = async ({ params, request }) => {
  const body = await request.json();
  const { currentPrice } = body;

  if (currentPrice == null) return json({ error: 'currentPrice required' }, { status: 400 });

  const [updated] = await db.update(stock)
    .set({ currentPrice: Number(currentPrice), updatedAt: new Date().toISOString() })
    .where(eq(stock.ticker, params.ticker.toUpperCase()))
    .returning();

  if (!updated) return json({ error: 'Not found' }, { status: 404 });
  return json(updated);
};

export const DELETE: RequestHandler = async ({ params }) => {
  const ticker = params.ticker.toUpperCase();

  // Delete all related data for this ticker
  const txnRows = await db.select({ id: transaction.id }).from(transaction).where(eq(transaction.ticker, ticker));
  const txnIds = txnRows.map((t) => t.id);
  if (txnIds.length > 0) {
    await db.delete(sellLotMatch).where(inArray(sellLotMatch.sellTxnId, txnIds));
    await db.delete(sellLotMatch).where(inArray(sellLotMatch.buyTxnId, txnIds));
  }
  await db.delete(transaction).where(eq(transaction.ticker, ticker));
  await db.delete(dividend).where(eq(dividend.ticker, ticker));

  // Delete the stock itself
  const [deleted] = await db.delete(stock).where(eq(stock.ticker, ticker)).returning();

  if (!deleted) return json({ error: 'Not found' }, { status: 404 });
  return json({ success: true });
};

