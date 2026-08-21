import type { Transaction } from './portfolio';

export type LotMatch = {
	sellTxnId: string;
	buyTxnId: string;
	sharesApplied: number;
};

export type SpecificIdBreakdown = {
	ticker: string;
	realizedPnl: number;
	unrealizedPnl: number;
	totalPnl: number;
	remainingCostBasis: number;
	marketValue: number;
	lotDetails: LotDetail[];
	sellDetails: SellDetail[];
};

export type LotDetail = {
	buyTxnId: string;
	buyDate: string;
	buyPrice: number;
	originalShares: number;
	remainingShares: number;
	buyFeePerShare: number;
	remainingCost: number;
	currentValue: number;
	unrealizedPnl: number;
};

export type SellDetail = {
	sellTxnId: string;
	sellDate: string;
	sellPrice: number;
	sharesSold: number;
	proceeds: number;
	costBasis: number;
	realizedPnl: number;
	matchedLots: Array<{
		buyTxnId: string;
		buyDate: string;
		buyPrice: number;
		sharesApplied: number;
		lotRealizedPnl: number;
	}>;
};

/**
 * Compute specific-ID realized/unrealized P&L for a single ticker.
 *
 * For each sell:
 *   - if lotMatches exist -> match against selected buy lots
 *   - otherwise -> fall back to FIFO
 *
 * The remaining (unmatched) shares on each buy lot form the unrealized side.
 */
export function computeSpecificIdPnl(
	ticker: string,
	currentPrice: number,
	transactions: Transaction[],
	lotMatches: LotMatch[]
): SpecificIdBreakdown {
	const buys = transactions
		.filter((t) => t.type === 'buy')
		.sort((a, b) => a.date.localeCompare(b.date));
	const sells = transactions
		.filter((t) => t.type === 'sell')
		.sort((a, b) => a.date.localeCompare(b.date));

	type LotState = {
		buy: Transaction;
		remaining: number;
		feePerShare: number;
	};
	const lots = new Map<string, LotState>();
	for (const b of buys) {
		lots.set(b.id, {
			buy: b,
			remaining: b.shares,
			feePerShare: b.shares > 0 ? b.fees / b.shares : 0
		});
	}

	const matchesBySell = new Map<string, LotMatch[]>();
	for (const m of lotMatches) {
		const arr = matchesBySell.get(m.sellTxnId) ?? [];
		arr.push(m);
		matchesBySell.set(m.sellTxnId, arr);
	}

	const sellDetails: SellDetail[] = [];

	for (const sell of sells) {
		const sellFeePerShare = sell.shares > 0 ? sell.fees / sell.shares : 0;
		const providedMatches = matchesBySell.get(sell.id);

		type Consume = { buyTxnId: string; sharesApplied: number };
		const consumes: Consume[] = [];

		if (providedMatches && providedMatches.length > 0) {
			for (const m of providedMatches) {
				consumes.push({ buyTxnId: m.buyTxnId, sharesApplied: m.sharesApplied });
			}
		} else {
			// FIFO fallback for legacy sells with no persisted match.
			let toApply = sell.shares;
			for (const b of buys) {
				if (toApply <= 0.00001) break;
				const st = lots.get(b.id);
				if (!st || st.remaining <= 0.00001) continue;
				const applied = Math.min(st.remaining, toApply);
				consumes.push({ buyTxnId: b.id, sharesApplied: applied });
				toApply -= applied;
			}
		}

		const matchedLots: SellDetail['matchedLots'] = [];
		let sellRealized = 0;
		let sellCost = 0;
		let sellProceeds = 0;

		for (const c of consumes) {
			const st = lots.get(c.buyTxnId);
			if (!st) continue;
			const applied = Math.min(c.sharesApplied, st.remaining);
			if (applied <= 0) continue;

			const buyCostPerShare = st.buy.pricePerShare + st.feePerShare;
			const cost = applied * buyCostPerShare;
			const proceeds = applied * sell.pricePerShare - applied * sellFeePerShare;
			const lotPnl = proceeds - cost;

			sellRealized += lotPnl;
			sellCost += cost;
			sellProceeds += proceeds;

			matchedLots.push({
				buyTxnId: st.buy.id,
				buyDate: st.buy.date,
				buyPrice: st.buy.pricePerShare,
				sharesApplied: applied,
				lotRealizedPnl: lotPnl
			});

			st.remaining -= applied;
		}

		sellDetails.push({
			sellTxnId: sell.id,
			sellDate: sell.date,
			sellPrice: sell.pricePerShare,
			sharesSold: sell.shares,
			proceeds: sellProceeds,
			costBasis: sellCost,
			realizedPnl: sellRealized,
			matchedLots
		});
	}

	const lotDetails: LotDetail[] = [];
	let realizedPnl = 0;
	for (const s of sellDetails) realizedPnl += s.realizedPnl;

	let remainingCostBasis = 0;
	let marketValue = 0;

	for (const b of buys) {
		const st = lots.get(b.id);
		if (!st) continue;
		const buyCostPerShare = st.buy.pricePerShare + st.feePerShare;
		const remainingCost = st.remaining * buyCostPerShare;
		const currentValue = st.remaining * currentPrice;
		const unrealizedPnl = currentValue - remainingCost;

		remainingCostBasis += remainingCost;
		marketValue += currentValue;

		lotDetails.push({
			buyTxnId: b.id,
			buyDate: b.date,
			buyPrice: b.pricePerShare,
			originalShares: b.shares,
			remainingShares: st.remaining,
			buyFeePerShare: st.feePerShare,
			remainingCost,
			currentValue,
			unrealizedPnl
		});
	}

	const unrealizedPnl = marketValue - remainingCostBasis;

	return {
		ticker,
		realizedPnl,
		unrealizedPnl,
		totalPnl: realizedPnl + unrealizedPnl,
		remainingCostBasis,
		marketValue,
		lotDetails,
		sellDetails
	};
}
