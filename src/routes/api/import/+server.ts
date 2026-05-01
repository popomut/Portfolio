import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { transaction, stock } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';

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

  // Load existing transactions once for duplicate checking
  const existing = await db.select().from(transaction);
  const existingKeys = new Set(
    existing.map(t => `${t.ticker}|${t.date}|${t.type}|${t.shares}|${t.pricePerShare}`)
  );

  const inserted = [];
  for (const row of rows) {
    const key = `${row.ticker.toUpperCase()}|${row.date}|${row.type}|${Number(row.shares)}|${Number(row.pricePerShare)}`;
    if (existingKeys.has(key)) continue; // skip exact duplicate
    existingKeys.add(key); // guard against duplicates within the same import batch

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
