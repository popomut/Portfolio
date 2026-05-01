import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { dividend } from '$lib/server/db/schema';

export const POST: RequestHandler = async ({ request }) => {
  const rows: Array<{
    ticker: string;
    exDate: string;
    payDate: string;
    sharesHeld: number;
    amountPerShare: number;
    totalAmount: number;
    withholdingTax?: number;
    currency?: string;
    notes?: string;
  }> = await request.json();

  if (!Array.isArray(rows) || rows.length === 0) {
    return json({ error: 'No data provided' }, { status: 400 });
  }

  // Load existing dividends for duplicate checking
  const existing = await db.select().from(dividend);
  const existingKeys = new Set(
    existing.map(d => `${d.ticker}|${d.exDate}|${d.totalAmount}`)
  );

  const inserted = [];
  for (const row of rows) {
    const key = `${row.ticker.toUpperCase()}|${row.exDate}|${Number(row.totalAmount)}`;
    if (existingKeys.has(key)) continue; // skip exact duplicate
    existingKeys.add(key);

    const [d] = await db.insert(dividend).values({
      ticker:         row.ticker.toUpperCase(),
      exDate:         row.exDate,
      payDate:        row.payDate,
      sharesHeld:     Number(row.sharesHeld),
      amountPerShare: Number(row.amountPerShare),
      totalAmount:    Number(row.totalAmount),
      withholdingTax: Number(row.withholdingTax ?? 0),
      currency:       row.currency ?? 'USD',
      notes:          row.notes ?? ''
    }).returning();
    inserted.push(d);
  }

  return json({ imported: inserted.length }, { status: 201 });
};
