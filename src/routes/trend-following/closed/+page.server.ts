import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { trendConfig, trendTransaction } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { splitCycles, type CycleTxn } from '$lib/server/trend-cycles';

const CONFIG_ID = 'config';

export type ClosedCycle = {
	ticker: string;
	cycleIndex: number;
	openedAt: string;
	closedAt: string;
	holdDays: number;
	units: number;
	buyShares: number;
	sellShares: number;
	avgCost: number;
	avgSell: number;
	realizedPnl: number;
	rMultiple: number; // realizedPnl / R
	returnPct: number; // realizedPnl / costBasisAtPeak
	firstEntryAtr: number;
	firstEntryPrice: number;
	transactions: CycleTxn[];
};

function daysBetween(a: string, b: string): number {
	const da = new Date(a).getTime();
	const db = new Date(b).getTime();
	return Math.max(0, Math.round((db - da) / (24 * 3600 * 1000)));
}

export const load: PageServerLoad = async () => {
	let [cfg] = await db.select().from(trendConfig).where(eq(trendConfig.id, CONFIG_ID));
	if (!cfg) {
		[cfg] = await db
			.insert(trendConfig)
			.values({ id: CONFIG_ID, updatedAt: new Date().toISOString() })
			.returning();
	}
	const R = cfg.equity * (cfg.riskPct / 100);

	const all = await db.select().from(trendTransaction);
	const byTicker = new Map<string, typeof all>();
	for (const t of all) {
		if (!byTicker.has(t.ticker)) byTicker.set(t.ticker, []);
		byTicker.get(t.ticker)!.push(t);
	}

	const closed: ClosedCycle[] = [];

	for (const [ticker, rows] of byTicker) {
		const cycles = splitCycles(rows);
		cycles.forEach((c, idx) => {
			if (c.isOpen) return;
			const buys = c.buys.map((b, i) => ({ ...b, unitNumber: i + 1 }));
			const sells = c.sells.map((s) => ({ ...s, unitNumber: 0 }));

			const buyShares = buys.reduce((a, t) => a + t.shares, 0);
			const sellShares = sells.reduce((a, t) => a + t.shares, 0);
			const buyCost = buys.reduce((a, t) => a + t.shares * t.pricePerShare + (t.fees ?? 0), 0);
			const sellProceeds = sells.reduce((a, t) => a + t.shares * t.pricePerShare - (t.fees ?? 0), 0);
			const avgCost = buyShares > 0 ? buyCost / buyShares : 0;
			const avgSell = sellShares > 0 ? sellProceeds / sellShares : 0;
			const realizedPnl = sellProceeds - buyCost;
			const rMultiple = R > 0 ? realizedPnl / R : 0;
			const returnPct = buyCost > 0 ? (realizedPnl / buyCost) * 100 : 0;

			closed.push({
				ticker,
				cycleIndex: idx + 1,
				openedAt: c.openedAt,
				closedAt: c.closedAt ?? c.openedAt,
				holdDays: daysBetween(c.openedAt, c.closedAt ?? c.openedAt),
				units: buys.length,
				buyShares,
				sellShares,
				avgCost,
				avgSell,
				realizedPnl,
				rMultiple,
				returnPct,
				firstEntryAtr: buys[0]?.atrAtEntry ?? 0,
				firstEntryPrice: buys[0]?.pricePerShare ?? 0,
				transactions: [...buys, ...sells].sort((a, b) =>
					a.date < b.date ? -1 : a.date > b.date ? 1 : a.createdAt < b.createdAt ? -1 : 1
				)
			});
		});
	}

	// Sort by close date desc
	closed.sort((a, b) => b.closedAt.localeCompare(a.closedAt));

	// ── Stats ────────────────────────────────────────────────
	const wins = closed.filter((c) => c.realizedPnl > 0);
	const losses = closed.filter((c) => c.realizedPnl < 0);
	const breakEven = closed.filter((c) => c.realizedPnl === 0);

	const totalPnl = closed.reduce((a, c) => a + c.realizedPnl, 0);
	const totalWinAmt = wins.reduce((a, c) => a + c.realizedPnl, 0);
	const totalLossAmt = losses.reduce((a, c) => a + c.realizedPnl, 0);

	const avgWin = wins.length > 0 ? totalWinAmt / wins.length : 0;
	const avgLoss = losses.length > 0 ? totalLossAmt / losses.length : 0;
	const winRate = closed.length > 0 ? wins.length / closed.length : 0;
	const lossRate = closed.length > 0 ? losses.length / closed.length : 0;
	// Expectancy in THB per trade: winRate*avgWin + lossRate*avgLoss
	const expectancy = winRate * avgWin + lossRate * avgLoss;
	// Expectancy in R: same but on rMultiple
	const avgR = closed.length > 0 ? closed.reduce((a, c) => a + c.rMultiple, 0) / closed.length : 0;
	const profitFactor = totalLossAmt !== 0 ? Math.abs(totalWinAmt / totalLossAmt) : (totalWinAmt > 0 ? Infinity : 0);
	const bestTrade = closed.reduce<ClosedCycle | null>((best, c) => (!best || c.realizedPnl > best.realizedPnl ? c : best), null);
	const worstTrade = closed.reduce<ClosedCycle | null>((worst, c) => (!worst || c.realizedPnl < worst.realizedPnl ? c : worst), null);
	const avgHoldDays = closed.length > 0 ? closed.reduce((a, c) => a + c.holdDays, 0) / closed.length : 0;

	// ── Equity curve (cumulative realized P/L over time) ─────
	const byCloseDate = [...closed].sort((a, b) => a.closedAt.localeCompare(b.closedAt));
	let running = 0;
	const equityCurve = byCloseDate.map((c) => {
		running += c.realizedPnl;
		return { date: c.closedAt, ticker: c.ticker, pnl: c.realizedPnl, cumulative: running };
	});

	// ── Drawdown from peak (based on equity curve) ───────────
	let peak = 0;
	let maxDD = 0;
	for (const point of equityCurve) {
		if (point.cumulative > peak) peak = point.cumulative;
		const dd = peak - point.cumulative;
		if (dd > maxDD) maxDD = dd;
	}

	// ── Per-ticker aggregates ───────────────────────────────
	const byTickerAgg = new Map<string, { ticker: string; trades: number; pnl: number; wins: number; losses: number }>();
	for (const c of closed) {
		const cur = byTickerAgg.get(c.ticker) ?? { ticker: c.ticker, trades: 0, pnl: 0, wins: 0, losses: 0 };
		cur.trades += 1;
		cur.pnl += c.realizedPnl;
		if (c.realizedPnl > 0) cur.wins += 1;
		else if (c.realizedPnl < 0) cur.losses += 1;
		byTickerAgg.set(c.ticker, cur);
	}
	const perTicker = [...byTickerAgg.values()].sort((a, b) => b.pnl - a.pnl);

	// ── R-multiple distribution buckets ─────────────────────
	// Buckets: <-2R, -2..-1, -1..0, 0..1, 1..2, 2..3, 3..5, >5R
	const buckets = [
		{ label: '< -2R', min: -Infinity, max: -2, count: 0 },
		{ label: '-2 to -1', min: -2, max: -1, count: 0 },
		{ label: '-1 to 0', min: -1, max: 0, count: 0 },
		{ label: '0 to 1', min: 0, max: 1, count: 0 },
		{ label: '1 to 2', min: 1, max: 2, count: 0 },
		{ label: '2 to 3', min: 2, max: 3, count: 0 },
		{ label: '3 to 5', min: 3, max: 5, count: 0 },
		{ label: '> 5R', min: 5, max: Infinity, count: 0 }
	];
	for (const c of closed) {
		const b = buckets.find((bk) => c.rMultiple >= bk.min && c.rMultiple < bk.max);
		if (b) b.count += 1;
	}

	return {
		config: cfg,
		riskPerTrade: R,
		closed,
		stats: {
			total: closed.length,
			wins: wins.length,
			losses: losses.length,
			breakEven: breakEven.length,
			winRate,
			totalPnl,
			avgWin,
			avgLoss,
			avgR,
			expectancy,
			profitFactor,
			avgHoldDays,
			maxDrawdown: maxDD,
			bestTrade,
			worstTrade
		},
		equityCurve,
		perTicker,
		buckets
	};
};
