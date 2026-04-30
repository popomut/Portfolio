import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { transaction, stock } from '$lib/server/db/schema';
import { eq, asc } from 'drizzle-orm';

export const GET: RequestHandler = async ({ url }) => {
  const ticker = url.searchParams.get('ticker');
  let rows;
  if (ticker) {
    rows = await db.select().from(transaction).where(eq(transaction.ticker, ticker)).orderBy(asc(transaction.date));
  } else {
    rows = await db.select().from(transaction).orderBy(asc(transaction.date));
  }
  return json(rows);
};

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();
  const { ticker, type, date, shares, pricePerShare, fees = 0, notes = '' } = body;

  if (!ticker || !type || !date || shares == null || pricePerShare == null) {
    return json({ error: 'Missing required fields' }, { status: 400 });
  }

  const [tx] = await db.insert(transaction).values({
    ticker: ticker.toUpperCase(),
    type,
    date,
    shares: Number(shares),
    pricePerShare: Number(pricePerShare),
    fees: Number(fees),
    notes: notes || ''
  }).returning();

  // Upsert stock
  await db.insert(stock).values({
    ticker: ticker.toUpperCase(),
    name: '',
    currentPrice: Number(pricePerShare),
    currency: 'USD',
    updatedAt: new Date().toISOString()
  }).onConflictDoUpdate({
    target: stock.ticker,
    set: {
      currentPrice: Number(pricePerShare),
      updatedAt: new Date().toISOString()
    }
  });

  return json(tx, { status: 201 });
};
