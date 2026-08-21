<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { computeSizing, buildPyramidLadder } from '$lib/utils/trend';
	import type { TrendCycle } from './+page.server';

	let { data } = $props();

	const CURRENCY = 'THB';
	const API = '/api/trend';

	// ── Config (editable) ───────────────────────────────────────
	let equity = $state<number>(data.config.equity);
	let riskPct = $state<number>(data.config.riskPct);
	let atrPeriod = $state<number>(data.config.atrPeriod);
	let atrMultStop = $state<number>(data.config.atrMultStop);
	let atrMultAdd = $state<number>(data.config.atrMultAdd);
	let maxUnits = $state<number>(data.config.maxUnits);
	let savingConfig = $state(false);

	async function saveConfig() {
		savingConfig = true;
		try {
			await fetch(`${API}/config`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ equity, riskPct, atrPeriod, atrMultStop, atrMultAdd, maxUnits })
			});
			await invalidateAll();
		} finally {
			savingConfig = false;
		}
	}

	// ── Calculator inputs ──────────────────────────────────────
	let calcTicker = $state<string>('');
	let calcEntry = $state<number>(35);
	let calcAtr = $state<number>(1);
	let fetchingAtr = $state(false);
	let atrFetchError = $state<string | null>(null);

	async function fetchAtrForCalc() {
		if (!calcTicker.trim()) return;
		fetchingAtr = true;
		atrFetchError = null;
		try {
			const res = await fetch(`${API}/atr`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ ticker: calcTicker.toUpperCase(), period: atrPeriod, persist: true })
			});
			const body = await res.json();
			if (!res.ok) {
				atrFetchError = body.error ?? 'failed to fetch ATR';
			} else {
				calcAtr = Number(body.atr);
				if (body.latestClose) calcEntry = Number(body.latestClose);
				await invalidateAll();
			}
		} catch (err) {
			atrFetchError = (err as Error).message;
		} finally {
			fetchingAtr = false;
		}
	}

	let sizing = $derived(
		computeSizing({ equity, riskPct, entryPrice: calcEntry, atr: calcAtr, atrMultStop })
	);

	let ladder = $derived(
		buildPyramidLadder({
			equity, riskPct, entryPrice: calcEntry, atr: calcAtr, atrMultStop, atrMultAdd, maxUnits
		})
	);

	// ── Trade modal (Buy / Add-unit / Sell) ────────────────────
	type TradeMode = 'buy-new' | 'add-unit' | 'sell';
	let tradeMode = $state<TradeMode>('buy-new');
	let showTrade = $state(false);

	let tradeTicker = $state('');
	let tradeUnit = $state<number>(1);
	let tradeDate = $state(new Date().toISOString().slice(0, 10));
	let tradePrice = $state<number>(0);
	let tradeAtr = $state<number>(0);
	let tradeShares = $state<number>(0);
	let tradeStop = $state<number>(0);
	let tradeFees = $state<number>(0);
	let tradeSaving = $state(false);
	let sellMaxShares = $state<number>(0);

	// Suggested (calculated) shares based on current inputs — used to show "vs. suggested".
	let suggestedShares = $derived(
		tradeMode === 'sell'
			? sellMaxShares
			: computeSizing({ equity, riskPct, entryPrice: tradePrice, atr: tradeAtr, atrMultStop }).shares
	);
	let suggestedStop = $derived(
		tradeMode === 'sell'
			? 0
			: computeSizing({ equity, riskPct, entryPrice: tradePrice, atr: tradeAtr, atrMultStop }).stopPrice
	);

	function openBuyNew() {
		tradeMode = 'buy-new';
		tradeTicker = calcTicker.toUpperCase();
		tradeUnit = 1;
		tradePrice = calcEntry;
		tradeAtr = calcAtr;
		tradeDate = new Date().toISOString().slice(0, 10);
		const s = computeSizing({ equity, riskPct, entryPrice: tradePrice, atr: tradeAtr, atrMultStop });
		tradeShares = s.shares;
		tradeStop = s.stopPrice;
		tradeFees = 0;
		showTrade = true;
	}

	function openAddUnit(c: TrendCycle, unitNumber: number) {
		tradeMode = 'add-unit';
		tradeTicker = c.ticker;
		tradeUnit = unitNumber;
		tradeDate = new Date().toISOString().slice(0, 10);
		const road = c.pyramidRoadmap.find((r) => r.unit === unitNumber);
		tradePrice = road?.targetPrice ?? c.currentPrice;
		tradeAtr = c.firstEntryAtr || c.atr;
		const s = computeSizing({ equity, riskPct, entryPrice: tradePrice, atr: tradeAtr, atrMultStop });
		tradeShares = road?.suggestedShares ?? s.shares;
		tradeStop = road?.suggestedStop ?? s.stopPrice;
		tradeFees = 0;
		showTrade = true;
	}

	function openSell(c: TrendCycle, all = false) {
		tradeMode = 'sell';
		tradeTicker = c.ticker;
		tradeUnit = 0;
		tradeDate = new Date().toISOString().slice(0, 10);
		tradePrice = c.currentPrice;
		tradeAtr = c.atr;
		sellMaxShares = c.sharesRemaining;
		tradeShares = all ? c.sharesRemaining : Math.round(c.sharesRemaining / 2);
		tradeStop = 0;
		tradeFees = 0;
		showTrade = true;
	}

	// Recompute sized shares & stop whenever tradePrice/tradeAtr change AND user hasn't gone off-suggestion.
	// We just render "suggested" beside the input; user can accept or override.
	function useSuggestedShares() {
		tradeShares = suggestedShares;
	}
	function useSuggestedStop() {
		tradeStop = suggestedStop;
	}

	async function submitTrade() {
		if (!tradeTicker.trim() || tradeShares <= 0) return;
		tradeSaving = true;
		try {
			await fetch(`${API}/transactions`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					ticker: tradeTicker.toUpperCase(),
					type: tradeMode === 'sell' ? 'sell' : 'buy',
					unitNumber: tradeMode === 'sell' ? 0 : tradeUnit,
					date: tradeDate,
					shares: tradeShares,
					pricePerShare: tradePrice,
					stopPrice: tradeMode === 'sell' ? 0 : tradeStop,
					atrAtEntry: tradeMode === 'sell' ? 0 : tradeAtr,
					fees: tradeFees
				})
			});
			showTrade = false;
			await invalidateAll();
		} finally {
			tradeSaving = false;
		}
	}

	async function refreshAllAtr() {
		await fetch(`${API}/atr`, { method: 'PUT' });
		await invalidateAll();
	}

	async function deleteStock(ticker: string) {
		if (!confirm(`Remove ${ticker} and ALL its trend transactions?`)) return;
		await fetch(`${API}/stocks/${ticker}`, { method: 'DELETE' });
		await invalidateAll();
	}

	async function deleteTx(id: string) {
		if (!confirm('Delete this transaction?')) return;
		await fetch(`${API}/transactions/${id}`, { method: 'DELETE' });
		await invalidateAll();
	}

	// ── Expandable pyramid roadmap per cycle ───────────────────
	let expanded = $state<Record<string, boolean>>({});
	function cycleKey(c: TrendCycle) {
		return `${c.ticker}#${c.cycleIndex}`;
	}
	function toggleExpand(c: TrendCycle) {
		const k = cycleKey(c);
		expanded[k] = !expanded[k];
	}

	// ── Formatting helpers ─────────────────────────────────────
	function fmt(v: number, digits = 2) {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: CURRENCY,
			minimumFractionDigits: digits,
			maximumFractionDigits: digits
		}).format(v);
	}
	function fmt0(v: number) {
		return fmt(v, 0);
	}
	function pct(v: number) {
		return (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
	}
</script>

<div class="space-y-6">
	<!-- Page header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold text-slate-800">Trend Following</h1>
			<p class="text-sm text-slate-500">
				Risk-based position sizing with ATR stops and pyramid rules. Isolated from Portfolio / SETMAI.
			</p>
		</div>
		<a href="/trend-following/closed" class="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100">
			View Closed Positions →
		</a>
	</div>

	<!-- Config -->
	<section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
		<div class="mb-3 flex items-center justify-between">
			<h2 class="text-base font-semibold text-slate-800">Config</h2>
			<button
				onclick={saveConfig}
				disabled={savingConfig}
				class="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
			>
				{savingConfig ? 'Saving…' : 'Save Config'}
			</button>
		</div>
		<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
			<label class="flex flex-col text-xs font-medium text-slate-600">
				Equity (THB)
				<input type="number" step="1000" bind:value={equity} class="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
			</label>
			<label class="flex flex-col text-xs font-medium text-slate-600">
				Risk % / trade
				<input type="number" step="0.05" bind:value={riskPct} class="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
			</label>
			<label class="flex flex-col text-xs font-medium text-slate-600">
				ATR period
				<input type="number" step="1" bind:value={atrPeriod} class="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
			</label>
			<label class="flex flex-col text-xs font-medium text-slate-600">
				Stop × ATR
				<input type="number" step="0.1" bind:value={atrMultStop} class="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
			</label>
			<label class="flex flex-col text-xs font-medium text-slate-600">
				Add every × ATR
				<input type="number" step="0.1" bind:value={atrMultAdd} class="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
			</label>
			<label class="flex flex-col text-xs font-medium text-slate-600">
				Max units
				<input type="number" step="1" bind:value={maxUnits} class="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
			</label>
		</div>
		<p class="mt-3 text-xs text-slate-500">
			<strong>R</strong> (risk per trade) = {fmt0(equity * (riskPct / 100))} · Portfolio heat budget (typ. 6–10%): {fmt0(equity * 0.08)}
		</p>
	</section>

	<!-- Summary cards -->
	<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
		<div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
			<p class="text-xs font-medium uppercase tracking-wide text-slate-500">Market Value</p>
			<p class="mt-1 text-xl font-bold text-slate-800">{fmt(data.summary.totalMarketValue)}</p>
		</div>
		<div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
			<p class="text-xs font-medium uppercase tracking-wide text-slate-500">Cost Basis</p>
			<p class="mt-1 text-xl font-bold text-slate-800">{fmt(data.summary.totalCostBasis)}</p>
		</div>
		<div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
			<p class="text-xs font-medium uppercase tracking-wide text-slate-500">Open P/L</p>
			<p class="mt-1 text-xl font-bold" class:text-green-600={data.summary.totalPnl >= 0} class:text-red-600={data.summary.totalPnl < 0}>
				{fmt(data.summary.totalPnl)}
			</p>
		</div>
		<div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
			<p class="text-xs font-medium uppercase tracking-wide text-slate-500">Realized</p>
			<p class="mt-1 text-xl font-bold" class:text-green-600={data.summary.totalRealized >= 0} class:text-red-600={data.summary.totalRealized < 0}>
				{fmt(data.summary.totalRealized)}
			</p>
		</div>
		<div class="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
			<p class="text-xs font-medium uppercase tracking-wide text-amber-700">Portfolio Heat</p>
			<p class="mt-1 text-xl font-bold text-amber-700">
				{fmt0(data.summary.totalHeat)} ({data.summary.totalHeatPct.toFixed(1)}%)
			</p>
		</div>
		<div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
			<p class="text-xs font-medium uppercase tracking-wide text-slate-500">Open Positions</p>
			<p class="mt-1 text-xl font-bold text-slate-800">{data.summary.positionsOpen}</p>
		</div>
	</div>

	<!-- Position sizing calculator -->
	<section class="rounded-xl border border-slate-200 bg-white shadow-sm">
		<div class="border-b border-slate-100 px-4 py-3">
			<h2 class="text-base font-semibold text-slate-800">Position Sizing Calculator</h2>
			<p class="text-xs text-slate-500">Enter a ticker to auto-fetch ATR({atrPeriod}) and latest price, or edit values manually.</p>
		</div>
		<div class="grid gap-3 p-4 sm:grid-cols-4">
			<label class="flex flex-col text-xs font-medium text-slate-600">
				Ticker
				<div class="mt-1 flex gap-1">
					<input type="text" bind:value={calcTicker} placeholder="e.g. PTT"
						class="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm uppercase" />
					<button onclick={fetchAtrForCalc} disabled={fetchingAtr || !calcTicker.trim()}
						class="rounded-md bg-emerald-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
						{fetchingAtr ? '…' : 'Fetch'}
					</button>
				</div>
				{#if atrFetchError}<span class="mt-1 text-xs text-red-600">{atrFetchError}</span>{/if}
			</label>
			<label class="flex flex-col text-xs font-medium text-slate-600">
				Entry Price
				<input type="number" step="0.01" bind:value={calcEntry} class="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
			</label>
			<label class="flex flex-col text-xs font-medium text-slate-600">
				ATR({atrPeriod})
				<input type="number" step="0.01" bind:value={calcAtr} class="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
			</label>
			<div class="flex items-end">
				<button onclick={openBuyNew} disabled={!calcTicker.trim() || sizing.shares <= 0}
					class="w-full rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
					Buy Unit 1 …
				</button>
			</div>
		</div>

		<div class="overflow-x-auto border-t border-slate-100">
			<table class="min-w-full text-sm">
				<tbody class="divide-y divide-slate-100">
					<tr><td class="px-4 py-2 font-medium text-slate-600">Equity</td><td class="px-4 py-2 text-right text-slate-800">{fmt0(equity)}</td></tr>
					<tr><td class="px-4 py-2 font-medium text-slate-600">Risk per trade</td><td class="px-4 py-2 text-right text-slate-800">{riskPct}% = <strong>{fmt(sizing.riskPerTrade)}</strong></td></tr>
					<tr><td class="px-4 py-2 font-medium text-slate-600">{calcTicker || 'Entry'} price</td><td class="px-4 py-2 text-right text-slate-800">{fmt(calcEntry)}</td></tr>
					<tr><td class="px-4 py-2 font-medium text-slate-600">ATR({atrPeriod})</td><td class="px-4 py-2 text-right text-slate-800">{fmt(calcAtr)}</td></tr>
					<tr><td class="px-4 py-2 font-medium text-slate-600">Stop = {atrMultStop} × ATR</td><td class="px-4 py-2 text-right text-slate-800">{fmt(sizing.stopDistance)} below entry → stop at <strong>{fmt(sizing.stopPrice)}</strong></td></tr>
					<tr class="bg-indigo-50">
						<td class="px-4 py-2 font-semibold text-indigo-800">Shares to buy</td>
						<td class="px-4 py-2 text-right text-indigo-800">{fmt(sizing.riskPerTrade)} / {fmt(sizing.stopDistance)} = <strong>{sizing.shares.toLocaleString()} shares</strong></td>
					</tr>
					<tr><td class="px-4 py-2 font-medium text-slate-600">Capital deployed</td><td class="px-4 py-2 text-right text-slate-800">{sizing.shares.toLocaleString()} × {fmt(calcEntry)} = <strong>{fmt0(sizing.capitalDeployed)}</strong> ({sizing.pctOfEquity.toFixed(1)}% of equity)</td></tr>
					<tr><td class="px-4 py-2 font-medium text-slate-600">Max loss if stopped</td><td class="px-4 py-2 text-right"><span class="font-semibold text-red-600">–{fmt0(sizing.maxLoss)}</span> ✓</td></tr>
				</tbody>
			</table>
		</div>
	</section>

	<!-- Pyramid ladder (planning aid, ticker-agnostic) -->
	<section class="rounded-xl border border-slate-200 bg-white shadow-sm">
		<div class="border-b border-slate-100 px-4 py-3">
			<h2 class="text-base font-semibold text-slate-800">Pyramid Plan (calculator preview)</h2>
			<p class="text-xs text-slate-500">Add every +{atrMultAdd}N of favorable move. Each add raises the shared trailing stop. Max {maxUnits} units.</p>
		</div>
		<div class="overflow-x-auto">
			<table class="min-w-full text-sm">
				<thead>
					<tr class="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
						<th class="px-4 py-2 text-left font-semibold">Unit</th>
						<th class="px-4 py-2 text-right font-semibold">Entry</th>
						<th class="px-4 py-2 text-right font-semibold">Shares</th>
						<th class="px-4 py-2 text-right font-semibold">Shared Stop</th>
						<th class="px-4 py-2 text-right font-semibold">Capital (this unit)</th>
						<th class="px-4 py-2 text-right font-semibold">Cum. Capital</th>
						<th class="px-4 py-2 text-right font-semibold">Cum. Shares</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-100">
					{#each ladder as u}
						<tr>
							<td class="px-4 py-2 font-semibold text-slate-800">U{u.unit}</td>
							<td class="px-4 py-2 text-right">{fmt(u.entryPrice)}</td>
							<td class="px-4 py-2 text-right">{u.shares.toLocaleString()}</td>
							<td class="px-4 py-2 text-right text-amber-700">{fmt(u.stopPrice)}</td>
							<td class="px-4 py-2 text-right">{fmt0(u.capital)}</td>
							<td class="px-4 py-2 text-right font-medium">{fmt0(u.cumulativeCapital)}</td>
							<td class="px-4 py-2 text-right">{u.cumulativeShares.toLocaleString()}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>

	<!-- Open holdings -->
	<section class="rounded-xl border border-slate-200 bg-white shadow-sm">
		<div class="flex items-center justify-between border-b border-slate-100 px-4 py-3">
			<div>
				<h2 class="text-base font-semibold text-slate-800">Open Positions</h2>
				<p class="text-xs text-slate-500">Click a row to see the pyramid roadmap (Unit 2/3/4 triggers). Each buy-until-empty stretch is one cycle.</p>
			</div>
			<button onclick={refreshAllAtr} class="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700">
				Refresh ATR + Price
			</button>
		</div>

		{#if data.openCycles.length === 0}
			<div class="p-8 text-center text-sm text-slate-500">
				No open trend positions. Use the calculator above and click <strong>Buy Unit 1</strong>.
			</div>
		{:else}
			<div class="overflow-x-auto">
				<table class="min-w-full text-sm">
					<thead>
						<tr class="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
							<th class="w-6 px-2 py-2"></th>
							<th class="px-4 py-2 text-left font-semibold">Ticker</th>
							<th class="px-4 py-2 text-right font-semibold">Units</th>
							<th class="px-4 py-2 text-right font-semibold">Shares</th>
							<th class="px-4 py-2 text-right font-semibold">Avg Cost</th>
							<th class="px-4 py-2 text-right font-semibold">Price</th>
							<th class="px-4 py-2 text-right font-semibold">ATR(20)</th>
							<th class="px-4 py-2 text-right font-semibold">Shared Stop</th>
							<th class="px-4 py-2 text-right font-semibold">Next Add @</th>
							<th class="px-4 py-2 text-right font-semibold">Market Value</th>
							<th class="px-4 py-2 text-right font-semibold">P/L</th>
							<th class="px-4 py-2 text-right font-semibold">Risk (R)</th>
							<th class="px-4 py-2 text-center font-semibold">Actions</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-100">
						{#each data.openCycles as c (cycleKey(c))}
							{@const isOpen = expanded[cycleKey(c)]}
							{@const canAddMore = c.units < maxUnits}
							{@const nextUnit = c.units + 1}
							<tr class="cursor-pointer hover:bg-slate-50" onclick={() => toggleExpand(c)}>
								<td class="px-2 py-2 text-center text-slate-400">{isOpen ? '▼' : '▶'}</td>
								<td class="px-4 py-2 font-semibold text-slate-800">
									{c.ticker}
									{#if c.cycleIndex > 1}
										<span class="ml-1 rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700">cycle #{c.cycleIndex}</span>
									{/if}
								</td>
								<td class="px-4 py-2 text-right">{c.units} / {maxUnits}</td>
								<td class="px-4 py-2 text-right">{c.sharesRemaining.toLocaleString()}</td>
								<td class="px-4 py-2 text-right">{fmt(c.avgCost)}</td>
								<td class="px-4 py-2 text-right">{fmt(c.currentPrice)}</td>
								<td class="px-4 py-2 text-right">{c.atr > 0 ? c.atr.toFixed(3) : '—'}</td>
								<td class="px-4 py-2 text-right text-amber-700">{c.sharedStop > 0 ? fmt(c.sharedStop) : '—'}</td>
								<td class="px-4 py-2 text-right">
									{#if c.nextAddTrigger != null}
										<span class:text-green-600={c.nextAddPriceHit} class:font-semibold={c.nextAddPriceHit}>
											{fmt(c.nextAddTrigger)}{c.nextAddPriceHit ? ' ✓' : ''}
										</span>
									{:else}
										<span class="text-slate-400">full</span>
									{/if}
								</td>
								<td class="px-4 py-2 text-right">{fmt0(c.marketValue)}</td>
								<td class="px-4 py-2 text-right font-medium" class:text-green-600={c.pnl >= 0} class:text-red-600={c.pnl < 0}>
									{fmt0(c.pnl)} ({pct(c.pnlPct)})
								</td>
								<td class="px-4 py-2 text-right" class:text-red-600={c.openRisk > 0} class:text-green-600={c.openRisk <= 0}>
									{c.riskR.toFixed(2)}R
								</td>
								<td class="px-4 py-2 text-center" onclick={(e) => e.stopPropagation()}>
									<div class="flex items-center justify-center gap-2">
										{#if canAddMore}
											<button
												onclick={() => openAddUnit(c, nextUnit)}
												class="rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700"
												title="Buy Unit {nextUnit}"
											>+ U{nextUnit}</button>
										{/if}
										<button
											onclick={() => openSell(c, false)}
											class="rounded-md bg-orange-500 px-2 py-1 text-xs font-medium text-white hover:bg-orange-600"
										>Sell</button>
										<button
											onclick={() => openSell(c, true)}
											class="rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700"
										>Sell All</button>
									</div>
								</td>
							</tr>

							{#if isOpen}
								<tr class="bg-slate-50">
									<td colspan="13" class="px-4 py-3">
										<div class="grid gap-3 lg:grid-cols-2">
											<div>
												<div class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
													Pyramid Roadmap (Unit 1 anchor: entry {fmt(c.firstEntryPrice)}, ATR {c.firstEntryAtr.toFixed(3)})
												</div>
												<table class="w-full text-xs">
													<thead>
														<tr class="text-slate-500">
															<th class="pb-1 text-left">Unit</th>
															<th class="pb-1 text-right">Status</th>
															<th class="pb-1 text-right">Target Price</th>
															<th class="pb-1 text-right">Sug. Shares</th>
															<th class="pb-1 text-right">Sug. Stop</th>
															<th class="pb-1 text-center">Action</th>
														</tr>
													</thead>
													<tbody class="divide-y divide-slate-200">
														{#each c.pyramidRoadmap as r}
															<tr>
																<td class="py-1 font-semibold text-slate-700">U{r.unit}</td>
																<td class="py-1 text-right">
																	{#if r.status === 'bought'}
																		<span class="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-700">bought {r.boughtAt}</span>
																	{:else if r.status === 'next'}
																		<span class="rounded bg-amber-100 px-1.5 py-0.5 text-amber-700">next</span>
																	{:else}
																		<span class="text-slate-400">planned</span>
																	{/if}
																</td>
																<td class="py-1 text-right">
																	{#if r.status === 'bought'}
																		{fmt(r.boughtPrice ?? 0)}
																	{:else}
																		<span class:font-semibold={r.status === 'next' && c.currentPrice >= r.targetPrice}
																			  class:text-green-600={r.status === 'next' && c.currentPrice >= r.targetPrice}>
																			{fmt(r.targetPrice)}
																		</span>
																	{/if}
																</td>
																<td class="py-1 text-right">
																	{r.status === 'bought' ? (r.boughtShares ?? 0).toLocaleString() : r.suggestedShares.toLocaleString()}
																</td>
																<td class="py-1 text-right text-amber-700">{fmt(r.suggestedStop)}</td>
																<td class="py-1 text-center">
																	{#if r.status === 'next'}
																		<button
																			onclick={() => openAddUnit(c, r.unit)}
																			class="rounded bg-emerald-600 px-2 py-0.5 text-white hover:bg-emerald-700"
																		>Buy U{r.unit}</button>
																	{/if}
																</td>
															</tr>
														{/each}
													</tbody>
												</table>
												<p class="mt-2 text-xs text-slate-500">
													Exit plan: if price hits shared stop <strong class="text-amber-700">{c.sharedStop > 0 ? fmt(c.sharedStop) : '—'}</strong>,
													sell <strong>all {c.sharesRemaining.toLocaleString()} shares</strong> at once. Trail the stop up on each add.
												</p>
											</div>

											<div>
												<div class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Transactions (this cycle)</div>
												<table class="w-full text-xs">
													<thead>
														<tr class="text-slate-500">
															<th class="pb-1 text-left">Date</th>
															<th class="pb-1 text-left">Type</th>
															<th class="pb-1 text-right">Unit</th>
															<th class="pb-1 text-right">Shares</th>
															<th class="pb-1 text-right">Price</th>
															<th class="pb-1 text-right">Stop</th>
															<th class="pb-1"></th>
														</tr>
													</thead>
													<tbody class="divide-y divide-slate-200">
														{#each c.transactions as tx}
															<tr>
																<td class="py-1">{tx.date}</td>
																<td class="py-1">
																	<span class="rounded px-1.5 py-0.5"
																		class:bg-emerald-100={tx.type === 'buy'} class:text-emerald-700={tx.type === 'buy'}
																		class:bg-red-100={tx.type === 'sell'} class:text-red-700={tx.type === 'sell'}>
																		{tx.type}
																	</span>
																</td>
																<td class="py-1 text-right">{tx.unitNumber || '—'}</td>
																<td class="py-1 text-right">{tx.shares.toLocaleString()}</td>
																<td class="py-1 text-right">{fmt(tx.pricePerShare)}</td>
																<td class="py-1 text-right text-amber-700">{tx.stopPrice > 0 ? fmt(tx.stopPrice) : '—'}</td>
																<td class="py-1 text-right"><button class="text-slate-400 hover:text-red-600" onclick={() => deleteTx(tx.id)}>×</button></td>
															</tr>
														{/each}
													</tbody>
												</table>
											</div>
										</div>
									</td>
								</tr>
							{/if}
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</section>

	{#if data.closedCycles.length > 0}
		<div class="rounded-xl border border-indigo-200 bg-indigo-50 p-4 shadow-sm">
			<div class="flex items-center justify-between gap-3">
				<div class="text-sm text-indigo-900">
					You have <strong>{data.closedCycles.length}</strong> closed {data.closedCycles.length === 1 ? 'cycle' : 'cycles'}.
					Total realized: <strong>{fmt0(data.summary.totalRealizedClosed)}</strong>.
				</div>
				<a href="/trend-following/closed" class="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700">
					View stats & history →
				</a>
			</div>
		</div>
	{/if}
</div>

<!-- Trade modal (unified for Buy / Add-Unit / Sell) -->
{#if showTrade}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
		<div class="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
			<h3 class="mb-1 text-lg font-semibold text-slate-800">
				{#if tradeMode === 'buy-new'}Buy Unit 1 — new position
				{:else if tradeMode === 'add-unit'}Add Unit {tradeUnit} — {tradeTicker}
				{:else}Sell — {tradeTicker}
				{/if}
			</h3>
			{#if tradeMode !== 'sell'}
				<p class="mb-4 text-xs text-slate-500">
					Suggested shares are calculated from your risk rule. You can override to buy fewer/more.
				</p>
			{:else}
				<p class="mb-4 text-xs text-slate-500">Position: {sellMaxShares.toLocaleString()} shares. Sell any amount.</p>
			{/if}

			<div class="space-y-3">
				{#if tradeMode === 'buy-new'}
					<label class="flex flex-col text-xs font-medium text-slate-600">
						Ticker
						<input type="text" bind:value={tradeTicker} class="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm uppercase" />
					</label>
				{/if}
				<div class="grid grid-cols-2 gap-3">
					<label class="flex flex-col text-xs font-medium text-slate-600">
						Date
						<input type="date" bind:value={tradeDate} class="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
					</label>
					<label class="flex flex-col text-xs font-medium text-slate-600">
						{tradeMode === 'sell' ? 'Sell Price' : 'Fill Price'}
						<input type="number" step="0.01" bind:value={tradePrice} class="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
					</label>
				</div>

				{#if tradeMode !== 'sell'}
					<div class="grid grid-cols-2 gap-3">
						<label class="flex flex-col text-xs font-medium text-slate-600">
							ATR at entry
							<input type="number" step="0.01" bind:value={tradeAtr} class="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
						</label>
						<label class="flex flex-col text-xs font-medium text-slate-600">
							Stop Price
							<div class="mt-1 flex gap-1">
								<input type="number" step="0.01" bind:value={tradeStop}
									class="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
								<button type="button" onclick={useSuggestedStop}
									class="rounded-md border border-slate-300 px-2 text-xs text-slate-600 hover:bg-slate-100"
									title="Use suggested {fmt(suggestedStop)}">↺</button>
							</div>
						</label>
					</div>
				{/if}

				<label class="flex flex-col text-xs font-medium text-slate-600">
					Shares
					<div class="mt-1 flex gap-1">
						<input type="number" step="1" bind:value={tradeShares} min="1"
							max={tradeMode === 'sell' ? sellMaxShares : undefined}
							class="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
						{#if tradeMode !== 'sell'}
							<button type="button" onclick={useSuggestedShares}
								class="rounded-md border border-slate-300 px-2 text-xs text-slate-600 hover:bg-slate-100"
								title="Use suggested {suggestedShares.toLocaleString()}">↺</button>
						{/if}
					</div>
					<span class="mt-1 text-xs text-slate-500">
						{#if tradeMode === 'sell'}
							Max sellable: {sellMaxShares.toLocaleString()}
						{:else}
							Suggested by risk rule: <strong>{suggestedShares.toLocaleString()}</strong>
							{#if tradeShares !== suggestedShares && suggestedShares > 0}
								<span class="text-amber-600">· you'll risk {((tradeShares / suggestedShares) * 100).toFixed(0)}% of 1R</span>
							{/if}
						{/if}
					</span>
				</label>

				<label class="flex flex-col text-xs font-medium text-slate-600">
					Fees
					<input type="number" step="0.01" bind:value={tradeFees} class="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
				</label>

				<div class="rounded-md bg-slate-50 p-3 text-xs text-slate-600">
					{#if tradeMode === 'sell'}
						<div>Proceeds: <strong>{fmt0(tradeShares * tradePrice - tradeFees)}</strong></div>
						<div>Remaining: <strong>{(sellMaxShares - tradeShares).toLocaleString()} shares</strong></div>
					{:else}
						<div>Capital: <strong>{fmt0(tradeShares * tradePrice)}</strong></div>
						<div>Max loss if stopped: <strong class="text-red-600">–{fmt0(tradeShares * Math.max(0, tradePrice - tradeStop))}</strong></div>
					{/if}
				</div>
			</div>

			<div class="mt-4 flex justify-end gap-2">
				<button onclick={() => (showTrade = false)}
					class="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100">Cancel</button>
				<button onclick={submitTrade} disabled={tradeSaving || tradeShares <= 0}
					class="rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
					class:bg-indigo-600={tradeMode !== 'sell'} class:hover:bg-indigo-700={tradeMode !== 'sell'}
					class:bg-red-600={tradeMode === 'sell'} class:hover:bg-red-700={tradeMode === 'sell'}>
					{tradeSaving ? 'Saving…' : tradeMode === 'sell' ? 'Sell' : 'Buy'}
				</button>
			</div>
		</div>
	</div>
{/if}
