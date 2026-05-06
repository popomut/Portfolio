export type Transaction = {
  id: string;
  ticker: string;
  type: string; // 'buy' | 'sell'
  date: string; // YYYY-MM-DD
  shares: number;
  pricePerShare: number;
  fees: number;
  notes?: string | null;
  createdAt?: string | null;
};

export type Dividend = {
  id: string;
  ticker: string;
  exDate: string;
  payDate: string;
  sharesHeld: number;
  amountPerShare: number;
  totalAmount: number;
  withholdingTax: number;
  currency: string;
  notes?: string | null;
  createdAt?: string | null;
};

export type PortfolioItem = {
  ticker: string;
  name: string;
  currentPrice: number;
  currency: string;
  shares: number;
  avgCost: number;
  costBasis: number;
  marketValue: number;
  pnl: number;
  pnlPct: number;
  irr: number | null;
  transactions: Transaction[];
  dividends: Dividend[];
  totalDividends: number;
  realizedPnl: number;
};

export type PortfolioSummary = {
  items: PortfolioItem[];
  totalMarketValue: number;
  totalCostBasis: number;
  totalPnl: number;
  totalPnlPct: number;
  totalDividends: number;
  totalRealizedPnl: number;
};

// XIRR via Newton's method
function xirr(cashflows: { date: Date; amount: number }[]): number | null {
  if (cashflows.length < 2) return null;

  const hasNeg = cashflows.some(cf => cf.amount < 0);
  const hasPos = cashflows.some(cf => cf.amount > 0);
  if (!hasNeg || !hasPos) return null;

  const t0 = cashflows[0].date.getTime();
  const times = cashflows.map(cf => (cf.date.getTime() - t0) / (365.25 * 24 * 3600 * 1000));

  function npv(rate: number): number {
    return cashflows.reduce((sum, cf, i) => sum + cf.amount / Math.pow(1 + rate, times[i]), 0);
  }

  function dnpv(rate: number): number {
    return cashflows.reduce((sum, cf, i) => sum - times[i] * cf.amount / Math.pow(1 + rate, times[i] + 1), 0);
  }

  let rate = 0.1;
  for (let i = 0; i < 100; i++) {
    const f = npv(rate);
    const df = dnpv(rate);
    if (Math.abs(df) < 1e-12) break;
    const newRate = rate - f / df;
    if (Math.abs(newRate - rate) < 1e-8) return newRate;
    rate = newRate;
    if (rate < -0.999) rate = -0.999;
  }
  if (!isFinite(rate) || Math.abs(npv(rate)) > 1) return null;
  return rate;
}

export function computePortfolioItem(
  ticker: string,
  name: string,
  currentPrice: number,
  transactions: Transaction[],
  dividends: Dividend[] = [],
  currency: string = 'USD'
): PortfolioItem {
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));

  let totalShares = 0;
  let totalCost = 0;
  let realizedPnl = 0;
  const cashflows: { date: Date; amount: number }[] = [];

  for (const tx of sorted) {
    if (tx.type === 'buy') {
      totalCost += tx.shares * tx.pricePerShare + tx.fees;
      totalShares += tx.shares;
      cashflows.push({ date: new Date(tx.date), amount: -(tx.shares * tx.pricePerShare + tx.fees) });
    } else {
      const avgCost = totalShares > 0 ? totalCost / totalShares : 0;
      const proceeds = tx.shares * tx.pricePerShare - tx.fees;
      realizedPnl += proceeds - (avgCost * tx.shares);
      totalCost -= avgCost * tx.shares;
      totalShares -= tx.shares;
      cashflows.push({ date: new Date(tx.date), amount: proceeds });
    }
  }

  const avgCost = totalShares > 0 ? totalCost / totalShares : 0;
  const costBasis = totalShares * avgCost;
  const marketValue = totalShares * currentPrice;
  const pnl = marketValue - costBasis;
  const pnlPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0;

  if (totalShares > 0) {
    cashflows.push({ date: new Date(), amount: marketValue });
  }

  for (const d of dividends) {
    cashflows.push({ date: new Date(d.payDate), amount: d.totalAmount });
  }

  const irr = xirr(cashflows);
  const totalDividends = dividends.reduce((s, d) => s + d.totalAmount, 0);

  return {
    ticker,
    name,
    currentPrice,
    currency,
    shares: totalShares,
    avgCost,
    costBasis,
    marketValue,
    pnl,
    pnlPct,
    irr,
    transactions: sorted,
    dividends,
    totalDividends,
    realizedPnl
  };
}

export function computePortfolioSummary(items: PortfolioItem[]): PortfolioSummary {
  const totalMarketValue = items.reduce((s, i) => s + i.marketValue, 0);
  const totalCostBasis = items.reduce((s, i) => s + i.costBasis, 0);
  const totalPnl = totalMarketValue - totalCostBasis;
  const totalPnlPct = totalCostBasis > 0 ? (totalPnl / totalCostBasis) * 100 : 0;
  const totalDividends = items.reduce((s, i) => s + i.totalDividends, 0);
  const totalRealizedPnl = items.reduce((s, i) => s + i.realizedPnl, 0);
  return { items, totalMarketValue, totalCostBasis, totalPnl, totalPnlPct, totalDividends, totalRealizedPnl };
}
