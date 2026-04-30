import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { transaction, stock } from '$lib/server/db/schema';

export const POST: RequestHandler = async ({ request }) => {
  const rows: Array<{
    ticker: string;
    type: string;
    date: string;
    shares: number;
    pricePerShare: number;
    fees?: number;
    notes?: string;
    currency?: string;
  }> = await request.json();

  if (!Array.isArray(rows) || rows.length === 0) {
    return json({ error: 'No data provided' }, { status: 400 });
  }

  const inserted = [];
  for (const row of rows) {
    const [tx] = await db.insert(transaction).values({
      ticker: row.ticker.toUpperCase(),
      type: row.type,
      date: row.date,
      shares: Number(row.shares),
      pricePerShare: Number(row.pricePerShare),
      fees: Number(row.fees ?? 0),
      notes: row.notes ?? ''
    }).returning();
    inserted.push(tx);

    await db.insert(stock).values({
      ticker: row.ticker.toUpperCase(),
      name: '',
      currentPrice: Number(row.pricePerShare),
      currency: row.currency ?? 'USD',
      updatedAt: new Date().toISOString()
    }).onConflictDoUpdate({
      target: stock.ticker,
      set: {
        currentPrice: Number(row.pricePerShare),
        updatedAt: new Date().toISOString()
      }
    });
  }

  return json({ imported: inserted.length }, { status: 201 });
};
