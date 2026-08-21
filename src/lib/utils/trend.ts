// Trend Following: ATR + position-sizing pure helpers (no I/O).

export type OhlcBar = {
	date: string;
	high: number;
	low: number;
	close: number;
};

// True Range = max( H-L, |H-prevClose|, |L-prevClose| )
export function trueRange(bar: OhlcBar, prevClose: number | null): number {
	const hl = bar.high - bar.low;
	if (prevClose == null) return hl;
	const hc = Math.abs(bar.high - prevClose);
	const lc = Math.abs(bar.low - prevClose);
	return Math.max(hl, hc, lc);
}

// Wilder's ATR (RMA smoothing) — the standard definition used by trend followers.
// Returns null if not enough bars for a stable value.
export function computeATR(bars: OhlcBar[], period = 20): number | null {
	if (bars.length < period + 1) return null;

	const trs: number[] = [];
	for (let i = 1; i < bars.length; i++) {
		trs.push(trueRange(bars[i], bars[i - 1].close));
	}

	// Seed with simple average of first `period` TRs, then Wilder-smooth the rest.
	let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
	for (let i = period; i < trs.length; i++) {
		atr = (atr * (period - 1) + trs[i]) / period;
	}
	return atr;
}

export type SizingInput = {
	equity: number;
	riskPct: number; // e.g. 1 for 1%
	entryPrice: number;
	atr: number;
	atrMultStop: number; // e.g. 2 → stop = entry - 2*ATR
};

export type SizingResult = {
	riskPerTrade: number;
	stopDistance: number;
	stopPrice: number;
	shares: number;
	capitalDeployed: number;
	pctOfEquity: number;
	maxLoss: number;
};

export function computeSizing(input: SizingInput): SizingResult {
	const { equity, riskPct, entryPrice, atr, atrMultStop } = input;
	const riskPerTrade = equity * (riskPct / 100);
	const stopDistance = atr * atrMultStop;
	const stopPrice = entryPrice - stopDistance;
	const shares = stopDistance > 0 ? Math.floor(riskPerTrade / stopDistance) : 0;
	const capitalDeployed = shares * entryPrice;
	const pctOfEquity = equity > 0 ? (capitalDeployed / equity) * 100 : 0;
	const maxLoss = shares * stopDistance;
	return { riskPerTrade, stopDistance, stopPrice, shares, capitalDeployed, pctOfEquity, maxLoss };
}

export type PyramidUnit = {
	unit: number;
	entryPrice: number;
	shares: number;
	stopPrice: number;
	capital: number;
	riskIfStopped: number; // negative = locked profit
	cumulativeCapital: number;
	cumulativeShares: number;
};

// Builds hypothetical pyramid ladder from a first entry, adding every `atrMultAdd * ATR`.
// Uses "strict" rule: all units share a single trailing stop; each add moves the shared stop
// up by `atrMultAdd * ATR`. Each unit is sized with the same 1R risk from `entryPrice + n*step`.
export function buildPyramidLadder(
	input: SizingInput & { atrMultAdd: number; maxUnits: number }
): PyramidUnit[] {
	const { equity, riskPct, entryPrice, atr, atrMultStop, atrMultAdd, maxUnits } = input;
	const riskPerTrade = equity * (riskPct / 100);
	const stopDist = atr * atrMultStop;
	const step = atr * atrMultAdd;

	if (stopDist <= 0 || step <= 0 || maxUnits < 1) return [];

	const units: PyramidUnit[] = [];
	for (let n = 0; n < maxUnits; n++) {
		const unitEntry = entryPrice + n * step;
		const shares = Math.floor(riskPerTrade / stopDist);
		// After adding this unit, shared stop = unitEntry - stopDist
		const sharedStop = unitEntry - stopDist;
		units.push({
			unit: n + 1,
			entryPrice: unitEntry,
			shares,
			stopPrice: sharedStop,
			capital: shares * unitEntry,
			riskIfStopped: 0, // filled below
			cumulativeCapital: 0,
			cumulativeShares: 0
		});
	}

	// After the FINAL add, all prior units use the newest shared stop.
	// For each intermediate "state after adding unit k", we recompute the shared stop
	// and each unit's P/L if stopped there.
	for (let k = 0; k < units.length; k++) {
		const sharedStop = units[k].stopPrice;
		let cumCap = 0;
		let cumSh = 0;
		for (let j = 0; j <= k; j++) {
			cumCap += units[j].capital;
			cumSh += units[j].shares;
		}
		units[k].cumulativeCapital = cumCap;
		units[k].cumulativeShares = cumSh;
		// riskIfStopped for the LATEST added unit only (what we care about display-wise):
		units[k].riskIfStopped = units[k].shares * (units[k].entryPrice - sharedStop);
	}

	return units;
}

// Given all pyramid units currently added AND their shared trailing stop,
// compute total open risk (positive = you'd lose that much; negative = locked profit).
export function totalOpenRisk(
	units: { entryPrice: number; shares: number }[],
	sharedStop: number
): number {
	return units.reduce((sum, u) => sum + u.shares * (u.entryPrice - sharedStop), 0);
}
