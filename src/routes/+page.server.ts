import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { stock, transaction } from '$lib/server/db/schema';
import { asc } from 'drizzle-orm';
import { computePortfolioItem, computePortfolioSummary } from '$lib/utils/portfolio';

export const load: PageServerLoad = async () => {
  const stocks = await db.select().from(stock);
  const transactions = await db.select().from(transaction).orderBy(asc(transaction.date));

  const items = stocks.map((s) => {
    const txns = transactions.filter((t) => t.ticker === s.ticker);
    return computePortfolioItem(s.ticker, s.name, s.currentPrice, txns);
  }).filter((item) => item.shares > 0.0001);

  const summary = computePortfolioSummary(items);

  return { summary };
};
