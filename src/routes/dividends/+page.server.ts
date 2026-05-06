import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { dividend } from '$lib/server/db/schema';
import { asc } from 'drizzle-orm';

export const load: PageServerLoad = async () => {
  const dividendsData = await db.select().from(dividend).orderBy(asc(dividend.exDate));

  // Yearly breakdown
  const yearlyMap: Record<string, number> = {};
  for (const d of dividendsData) {
    const year = d.exDate.substring(0, 4);
    yearlyMap[year] = (yearlyMap[year] ?? 0) + d.totalAmount;
  }
  const yearly = Object.entries(yearlyMap)
    .map(([year, amount]) => ({ year, amount }))
    .sort((a, b) => a.year.localeCompare(b.year));

  // Stock contribution breakdown
  const stockMap: Record<string, number> = {};
  for (const d of dividendsData) {
    stockMap[d.ticker] = (stockMap[d.ticker] ?? 0) + d.totalAmount;
  }
  const byStock = Object.entries(stockMap)
    .map(([ticker, amount]) => ({ ticker, amount }))
    .sort((a, b) => b.amount - a.amount);

  const totalDividends = dividendsData.reduce((sum, d) => sum + d.totalAmount, 0);

  // Year-by-stock breakdown
  const yearStockMap: Record<string, Record<string, number>> = {};
  for (const d of dividendsData) {
    const year = d.exDate.substring(0, 4);
    if (!yearStockMap[year]) yearStockMap[year] = {};
    yearStockMap[year][d.ticker] = (yearStockMap[year][d.ticker] ?? 0) + d.totalAmount;
  }
  const tickers = [...new Set(dividendsData.map(d => d.ticker))].sort();
  const yearlyByStock = yearly.map(({ year }) => {
    const entry: Record<string, number> & { year: string } = { year };
    for (const t of tickers) {
      entry[t] = yearStockMap[year]?.[t] ?? 0;
    }
    return entry;
  });

  return { dividends: dividendsData, yearly, byStock, totalDividends, yearlyByStock, tickers };
};
