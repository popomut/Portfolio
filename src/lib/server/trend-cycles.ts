// Cycle-splitting helpers for Trend Following.
// A cycle is a stretch of transactions where balance goes 0 → >0 → back to 0.

export type RawTxn = {
	id: string;
	type: string;
	unitNumber: number;
	date: string;
	createdAt: string | null;
	shares: number;
	pricePerShare: number;
	stopPrice: number;
	atrAtEntry: number;
	fees?: number;
};

export type CycleTxn = Required<Omit<RawTxn, 'createdAt'>> & { createdAt: string };

export type RawCycle = {
	buys: CycleTxn[];
	sells: CycleTxn[];
	openedAt: string;
	closedAt: string | null;
	isOpen: boolean;
};

// Deterministic sort: date first, then createdAt (insertion order).
// This is what lets buy → sell → re-buy on the same day split correctly.
export function sortTxns(txns: RawTxn[]): CycleTxn[] {
	return [...txns]
		.map((t) => ({
			id: t.id,
			type: t.type,
			unitNumber: t.unitNumber,
			date: t.date,
			createdAt: t.createdAt ?? '',
			shares: t.shares,
			pricePerShare: t.pricePerShare,
			stopPrice: t.stopPrice,
			atrAtEntry: t.atrAtEntry,
			fees: t.fees ?? 0
		}))
		.sort((a, b) => {
			if (a.date !== b.date) return a.date < b.date ? -1 : 1;
			return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
		});
}

export function splitCycles(txns: RawTxn[]): RawCycle[] {
	const sorted = sortTxns(txns);
	const cycles: RawCycle[] = [];
	let balance = 0;
	let current: RawCycle | null = null;

	for (const t of sorted) {
		if (t.type === 'buy') {
			if (!current) {
				current = { buys: [], sells: [], openedAt: t.date, closedAt: null, isOpen: true };
				cycles.push(current);
			}
			current.buys.push(t);
			balance += t.shares;
		} else if (t.type === 'sell') {
			if (!current) continue;
			current.sells.push(t);
			balance -= t.shares;
			if (balance <= 0.0001) {
				current.closedAt = t.date;
				current.isOpen = false;
				current = null;
				balance = 0;
			}
		}
	}
	return cycles;
}

// Return the transaction IDs that belong to a specific cycle (1-based).
export function cycleTxnIds(txns: RawTxn[], cycleIndex: number): string[] {
	const cycles = splitCycles(txns);
	const target = cycles[cycleIndex - 1];
	if (!target) return [];
	return [...target.buys, ...target.sells].map((t) => t.id);
}
