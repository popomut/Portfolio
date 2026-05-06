import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { stock, transaction, dividend } from '$lib/server/db/schema';
import { asc } from 'drizzle-orm';
import { computePortfolioItem, computePortfolioSummary } from '$lib/utils/portfolio';

export const load: PageServerLoad = async () => {
  const stocks = await db.select().from(stock);
  const transactions = await db.select().from(transaction).orderBy(asc(transaction.date));
  const dividends = await db.select().from(dividend).orderBy(asc(dividend.exDate));

  const items = stocks.map((s) => {
    const txns = transactions.filter((t) => t.ticker === s.ticker);
    const divs = dividends.filter((d) => d.ticker === s.ticker);
    return computePortfolioItem(s.ticker, s.name, s.currentPrice, txns, divs, s.currency);
  }).filter((item) => item.shares > 0.0001);

  const closedItems = stocks.map((s) => {
    const txns = transactions.filter((t) => t.ticker === s.ticker);
    const divs = dividends.filter((d) => d.ticker === s.ticker);
    const item = computePortfolioItem(s.ticker, s.name, s.currentPrice, txns, divs, s.currency);
    return { item, txns };
  }).filter(({ item, txns }) => item.shares <= 0.0001 && txns.length > 0);

  const closedDividends = closedItems.reduce((sum, { item }) => sum + (item.totalDividends ?? 0), 0);
  
  let totalRealizedGains = 0;
  for (const { item, txns } of closedItems) {
    let totalBuyCost = 0;
    let totalProceeds = 0;

    for (const tx of txns) {
      if (tx.type === 'buy') {
        totalBuyCost += tx.shares * tx.pricePerShare + tx.fees;
      } else {
        totalProceeds += tx.shares * tx.pricePerShare - tx.fees;
      }
    }

    const realizedGain = totalProceeds - totalBuyCost;
    totalRealizedGains += realizedGain;
  }

  let totalPortfolioCost = 0;
  for (const tx of transactions) {
    if (tx.type === 'buy') {
      totalPortfolioCost += tx.shares * tx.pricePerShare + tx.fees;
    }
  }

  const summary = computePortfolioSummary(items);

  return { 
    summary, 
    closedDividends: Number(closedDividends || 0),
    totalRealizedGains: Number(totalRealizedGains || 0),
    totalPortfolioCost: Number(totalPortfolioCost || 0)
  };
};
