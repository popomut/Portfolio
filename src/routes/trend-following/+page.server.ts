import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { trendConfig, trendStock, trendTransaction } from '$lib/server/db/schema';
import { asc, eq } from 'drizzle-orm';
import { splitCycles, sortTxns, type CycleTxn as SharedCycleTxn } from '$lib/server/trend-cycles';

const CONFIG_ID = 'config';

export type CycleTxn = SharedCycleTxn;

export type PyramidRoadmapItem = {
	unit: number;
	status: 'bought' | 'next' | 'planned';
	targetPrice: number;
	suggestedStop: number;
	suggestedShares: number;
	boughtAt?: string;
	boughtPrice?: number;
	boughtShares?: number;
};

export type TrendCycle = {
	ticker: string;
	cycleIndex: number; // 1-based; 1 = first cycle for this ticker
	isOpen: boolean;
	openedAt: string;
	closedAt: string | null;
	transactions: CycleTxn[]; // buys + sells in this cycle, chronological
	units: number; // buy count in this cycle
	sharesRemaining: number;
	avgCost: number; // avg cost of buys within this cycle
	costBasis: number; // sharesRemaining * avgCost
	realizedPnl: number; // (sell − avgCost) × sold − fees, within this cycle
	sharedStop: number; // max stopPrice across buys in this cycle
	firstEntryPrice: number;
	firstEntryAtr: number;
	pyramidRoadmap: PyramidRoadmapItem[];
	nextAddTrigger: number | null;
	nextAddPriceHit: boolean;
	// Fields only meaningful when isOpen:
	currentPrice: number;
	atr: number;
	atrUpdatedAt: string | null;
	marketValue: number;
	pnl: number;
	pnlPct: number;
	openRisk: number;
	riskR: number;
};

export const load: PageServerLoad = async () => {
	let [cfg] = await db.select().from(trendConfig).where(eq(trendConfig.id, CONFIG_ID));
	if (!cfg) {
		[cfg] = await db
			.insert(trendConfig)
			.values({ id: CONFIG_ID, updatedAt: new Date().toISOString() })
			.returning();
	}

	const stocks = await db.select().from(trendStock);
	const transactions = await db.select().from(trendTransaction).orderBy(asc(trendTransaction.date));

	const R = cfg.equity * (cfg.riskPct / 100);

	const openCycles: TrendCycle[] = [];
	const closedCycles: TrendCycle[] = [];

	const stockByTicker = new Map(stocks.map((s) => [s.ticker, s]));
	const allTickers = new Set<string>([
		...stocks.map((s) => s.ticker),
		...transactions.map((t) => t.ticker)
	]);

	for (const ticker of allTickers) {
		const stock = stockByTicker.get(ticker);
		const tickerTxns = transactions.filter((t) => t.ticker === ticker);
		const rawCycles = splitCycles(tickerTxns);

		rawCycles.forEach((c, idx) => {
			// Re-index units within cycle by order of buy.
			const buys = c.buys.map((b, i) => ({ ...b, unitNumber: i + 1 }));
			const sells = c.sells.map((s) => ({ ...s, unitNumber: 0 }));
			const allTx = sortTxns([...buys, ...sells]);

			const totalBuyShares = buys.reduce((a, t) => a + t.shares, 0);
			const totalSellShares = sells.reduce((a, t) => a + t.shares, 0);
			const sharesRemaining = totalBuyShares - totalSellShares;

			const totalBuyCost = buys.reduce((a, t) => a + t.shares * t.pricePerShare, 0);
			const avgCost = totalBuyShares > 0 ? totalBuyCost / totalBuyShares : 0;

			const realizedPnl =
				sells.reduce((a, t) => a + (t.pricePerShare - avgCost) * t.shares, 0);

			const sharedStop = buys.reduce((max, t) => Math.max(max, t.stopPrice || 0), 0);

			const firstBuy = buys[0];
			const firstEntryPrice = firstBuy?.pricePerShare ?? 0;
			const firstEntryAtr = firstBuy?.atrAtEntry ?? 0;
			const stepSize = firstEntryAtr * cfg.atrMultAdd;
			const stopDist = firstEntryAtr * cfg.atrMultStop;
			const perUnitShares = stopDist > 0 ? Math.floor(R / stopDist) : 0;

			const pyramidRoadmap: PyramidRoadmapItem[] = [];
			if (firstBuy && stepSize > 0) {
				for (let n = 0; n < cfg.maxUnits; n++) {
					const unitNo = n + 1;
					const targetPrice = firstEntryPrice + n * stepSize;
					const suggestedStop = targetPrice - stopDist;
					const bought = buys.find((b) => b.unitNumber === unitNo);
					pyramidRoadmap.push({
						unit: unitNo,
						status: bought ? 'bought' : unitNo === buys.length + 1 ? 'next' : 'planned',
						targetPrice,
						suggestedStop,
						suggestedShares: perUnitShares,
						boughtAt: bought?.date,
						boughtPrice: bought?.pricePerShare,
						boughtShares: bought?.shares
					});
				}
			}

			const currentPrice = stock?.currentPrice ?? 0;
			const atr = stock?.atr ?? 0;
			const marketValue = sharesRemaining * currentPrice;
			const costBasis = sharesRemaining * avgCost;
			const pnl = marketValue - costBasis;
			const pnlPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
			const openRisk = c.isOpen
				? buys.reduce((a, t) => a + t.shares * (t.pricePerShare - sharedStop), 0)
				: 0;
			const nextItem = pyramidRoadmap.find((r) => r.status === 'next');
			const nextAddTrigger = nextItem?.targetPrice ?? null;
			const nextAddPriceHit = c.isOpen && nextAddTrigger != null && currentPrice >= nextAddTrigger;

			const cycle: TrendCycle = {
				ticker,
				cycleIndex: idx + 1,
				isOpen: c.isOpen,
				openedAt: c.openedAt,
				closedAt: c.closedAt,
				transactions: allTx,
				units: buys.length,
				sharesRemaining,
				avgCost,
				costBasis,
				realizedPnl,
				sharedStop,
				firstEntryPrice,
				firstEntryAtr,
				pyramidRoadmap,
				nextAddTrigger,
				nextAddPriceHit,
				currentPrice,
				atr,
				atrUpdatedAt: stock?.atrUpdatedAt ?? null,
				marketValue,
				pnl,
				pnlPct,
				openRisk,
				riskR: R > 0 ? openRisk / R : 0
			};

			if (c.isOpen) openCycles.push(cycle);
			else closedCycles.push(cycle);
		});
	}

	const totalHeat = openCycles.reduce((a, c) => a + Math.max(0, c.openRisk), 0);
	const totalMarketValue = openCycles.reduce((a, c) => a + c.marketValue, 0);
	const totalCostBasis = openCycles.reduce((a, c) => a + c.costBasis, 0);
	const totalPnl = totalMarketValue - totalCostBasis;
	const totalRealizedOpen = openCycles.reduce((a, c) => a + c.realizedPnl, 0);
	const totalRealizedClosed = closedCycles.reduce((a, c) => a + c.realizedPnl, 0);

	// Sort closed by close date desc (most recent first)
	closedCycles.sort((a, b) => (b.closedAt ?? '').localeCompare(a.closedAt ?? ''));

	return {
		config: cfg,
		riskPerTrade: R,
		openCycles,
		closedCycles,
		summary: {
			totalMarketValue,
			totalCostBasis,
			totalPnl,
			totalRealizedOpen,
			totalRealizedClosed,
			totalRealized: totalRealizedOpen + totalRealizedClosed,
			totalHeat,
			totalHeatPct: cfg.equity > 0 ? (totalHeat / cfg.equity) * 100 : 0,
			positionsOpen: openCycles.length,
			positionsClosed: closedCycles.length
		}
	};
};
