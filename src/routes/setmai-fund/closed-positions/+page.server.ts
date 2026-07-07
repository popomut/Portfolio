import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { setmaiStock, setmaiTransaction, setmaiDividend } from '$lib/server/db/schema';
import { asc } from 'drizzle-orm';
import { computePortfolioItem } from '$lib/utils/portfolio';

export type ClosedPosition = {
  ticker: string;
  name: string;
  totalCostBasis: number;
  totalDividends: number;
  realizedGain: number;
  realizedGainPct: number;
  totalReturnPct: number;
  irr: number | null;
  exitDate: string;
  currency: string;
  transactions: any[];
};

export const load: PageServerLoad = async () => {
  const stocks = await db.select().from(setmaiStock);
  const transactions = await db.select().from(setmaiTransaction).orderBy(asc(setmaiTransaction.date));
  const dividends = await db.select().from(setmaiDividend).orderBy(asc(setmaiDividend.exDate));

  const closedPositions: ClosedPosition[] = [];

  for (const s of stocks) {
    const txns = transactions.filter((t) => t.ticker === s.ticker);
    const divs = dividends.filter((d) => d.ticker === s.ticker);

    if (txns.length === 0) continue;

    const item = computePortfolioItem(s.ticker, s.name, 0, txns, divs, s.currency);

    if (item.shares <= 0.0001) {
      const lastTx = txns[txns.length - 1];
      const exitDate = lastTx.date;

      let totalProceeds = 0;
      let totalBuyCost = 0;

      for (const tx of txns) {
        if (tx.type === 'buy') totalBuyCost += tx.shares * tx.pricePerShare + tx.fees;
        else totalProceeds += tx.shares * tx.pricePerShare - tx.fees;
      }

      const realizedGain = totalProceeds - totalBuyCost;
      const realizedGainPct = totalBuyCost > 0 ? (realizedGain / totalBuyCost) * 100 : 0;
      const totalReturnPct = totalBuyCost > 0 ? ((realizedGain + item.totalDividends) / totalBuyCost) * 100 : 0;

      closedPositions.push({
        ticker: s.ticker,
        name: s.name,
        totalCostBasis: totalBuyCost,
        totalDividends: item.totalDividends,
        realizedGain,
        realizedGainPct,
        totalReturnPct,
        irr: item.irr,
        exitDate,
        currency: s.currency,
        transactions: item.transactions
      });
    }
  }

  closedPositions.sort((a, b) => b.exitDate.localeCompare(a.exitDate));

  return { closedPositions };
};
