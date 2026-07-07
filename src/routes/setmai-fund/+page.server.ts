import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { setmaiStock, setmaiTransaction, setmaiDividend } from '$lib/server/db/schema';
import { asc } from 'drizzle-orm';
import { computePortfolioItem, computePortfolioSummary, computePortfolioIRR } from '$lib/utils/portfolio';

export const load: PageServerLoad = async () => {
  const stocks = await db.select().from(setmaiStock);
  const transactions = await db.select().from(setmaiTransaction).orderBy(asc(setmaiTransaction.date));
  const dividends = await db.select().from(setmaiDividend).orderBy(asc(setmaiDividend.exDate));

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
  for (const { txns } of closedItems) {
    let totalBuyCost = 0;
    let totalProceeds = 0;
    for (const tx of txns) {
      if (tx.type === 'buy') totalBuyCost += tx.shares * tx.pricePerShare + tx.fees;
      else totalProceeds += tx.shares * tx.pricePerShare - tx.fees;
    }
    totalRealizedGains += totalProceeds - totalBuyCost;
  }

  let totalPortfolioCost = 0;
  for (const tx of transactions) {
    if (tx.type === 'buy') totalPortfolioCost += tx.shares * tx.pricePerShare + tx.fees;
  }

  const summary = computePortfolioSummary(items);
  const portfolioIRR = computePortfolioIRR(transactions, dividends, items);

  return {
    summary,
    closedDividends: Number(closedDividends || 0),
    totalRealizedGains: Number(totalRealizedGains || 0),
    totalPortfolioCost: Number(totalPortfolioCost || 0),
    portfolioIRR
  };
};
