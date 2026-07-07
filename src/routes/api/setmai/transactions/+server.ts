import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { setmaiTransaction, setmaiStock } from '$lib/server/db/schema';
import { eq, asc } from 'drizzle-orm';

export const GET: RequestHandler = async ({ url }) => {
  const ticker = url.searchParams.get('ticker');
  const rows = ticker
    ? await db.select().from(setmaiTransaction).where(eq(setmaiTransaction.ticker, ticker)).orderBy(asc(setmaiTransaction.date))
    : await db.select().from(setmaiTransaction).orderBy(asc(setmaiTransaction.date));
  return json(rows);
};

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();
  const { ticker, type, date, shares, pricePerShare, fees = 0, notes = '' } = body;

  if (!ticker || !type || !date || shares == null || pricePerShare == null) {
    return json({ error: 'Missing required fields' }, { status: 400 });
  }

  const [tx] = await db.insert(setmaiTransaction).values({
    ticker: ticker.toUpperCase(),
    type,
    date,
    shares: Number(shares),
    pricePerShare: Number(pricePerShare),
    fees: Number(fees),
    notes: notes || ''
  }).returning();

  await db.insert(setmaiStock).values({
    ticker: ticker.toUpperCase(),
    name: '',
    currentPrice: Number(pricePerShare),
    currency: 'THB',
    updatedAt: new Date().toISOString()
  }).onConflictDoUpdate({
    target: setmaiStock.ticker,
    set: {
      currentPrice: Number(pricePerShare),
      updatedAt: new Date().toISOString()
    }
  });

  return json(tx, { status: 201 });
};
