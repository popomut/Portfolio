<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import TrendClosedCharts from '$lib/components/TrendClosedCharts.svelte';
	import type { ClosedCycle } from './+page.server';

	let { data } = $props();

	const CURRENCY = 'THB';
	const API = '/api/trend';

	// ── Filters ────────────────────────────────────────────
	let filterTicker = $state<string>('');
	let filterOutcome = $state<'all' | 'wins' | 'losses'>('all');
	let sortBy = $state<'closedAt' | 'realizedPnl' | 'rMultiple' | 'holdDays'>('closedAt');
	let sortAsc = $state(false);

	let visible = $derived.by(() => {
		let list = [...data.closed];
		if (filterTicker.trim()) {
			const q = filterTicker.trim().toUpperCase();
			list = list.filter((c) => c.ticker.includes(q));
		}
		if (filterOutcome === 'wins') list = list.filter((c) => c.realizedPnl > 0);
		if (filterOutcome === 'losses') list = list.filter((c) => c.realizedPnl < 0);

		list.sort((a, b) => {
			let av: number | string = a[sortBy] as any;
			let bv: number | string = b[sortBy] as any;
			if (typeof av === 'string' && typeof bv === 'string') {
				return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
			}
			return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
		});
		return list;
	});

	function toggleSort(col: typeof sortBy) {
		if (sortBy === col) sortAsc = !sortAsc;
		else {
			sortBy = col;
			sortAsc = false;
		}
	}

	// ── Expand a cycle to see transactions ─────────────────
	let expanded = $state<Record<string, boolean>>({});
	function keyFor(c: ClosedCycle) {
		return `${c.ticker}#${c.cycleIndex}`;
	}

	// ── Delete actions ─────────────────────────────────────
	let deleting = $state(false);

	async function deleteCycle(c: ClosedCycle) {
		if (!confirm(`Delete ${c.ticker} cycle #${c.cycleIndex} (${c.transactions.length} transactions)?`)) return;
		deleting = true;
		try {
			await fetch(`${API}/cycles`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ mode: 'cycle', ticker: c.ticker, cycleIndex: c.cycleIndex })
			});
			await invalidateAll();
		} finally {
			deleting = false;
		}
	}

	async function deleteAllForTicker(ticker: string) {
		const count = data.closed.filter((c) => c.ticker === ticker).length;
		if (!confirm(`Delete ALL ${count} closed cycle(s) for ${ticker}? Open positions stay untouched.`)) return;
		deleting = true;
		try {
			await fetch(`${API}/cycles`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ mode: 'ticker-closed', ticker })
			});
			await invalidateAll();
		} finally {
			deleting = false;
		}
	}

	async function deleteAllClosed() {
		if (!confirm(`Delete ALL ${data.closed.length} closed cycles across every ticker? This cannot be undone. Open positions stay untouched.`)) return;
		if (!confirm('Really delete everything?')) return;
		deleting = true;
		try {
			await fetch(`${API}/cycles`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ mode: 'all-closed' })
			});
			await invalidateAll();
		} finally {
			deleting = false;
		}
	}

	// ── Formatting helpers ─────────────────────────────────
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
	function fmtR(v: number) {
		return (v >= 0 ? '+' : '') + v.toFixed(2) + 'R';
	}
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold text-slate-800">Trend Following · Closed Positions</h1>
			<p class="text-sm text-slate-500">
				Performance stats for completed trade cycles. Data is isolated from Portfolio and SETMAI.
			</p>
		</div>
		<a href="/trend-following" class="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100">
			← Back to Open Positions
		</a>
	</div>

	{#if data.closed.length === 0}
		<div class="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
			<p class="text-slate-500">No closed cycles yet. Once you Sell All on an open position, it will show up here.</p>
		</div>
	{:else}
		<!-- Stat tiles -->
		<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
			<div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
				<p class="text-xs font-medium uppercase tracking-wide text-slate-500">Total Trades</p>
				<p class="mt-1 text-xl font-bold text-slate-800">{data.stats.total}</p>
				<p class="text-xs text-slate-500">{data.stats.wins}W · {data.stats.losses}L · {data.stats.breakEven}BE</p>
			</div>
			<div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
				<p class="text-xs font-medium uppercase tracking-wide text-slate-500">Win Rate</p>
				<p class="mt-1 text-xl font-bold text-slate-800">{(data.stats.winRate * 100).toFixed(1)}%</p>
			</div>
			<div class="rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
				<p class="text-xs font-medium uppercase tracking-wide text-emerald-700">Total Realized</p>
				<p class="mt-1 text-xl font-bold" class:text-emerald-700={data.stats.totalPnl >= 0} class:text-red-700={data.stats.totalPnl < 0}>
					{fmt0(data.stats.totalPnl)}
				</p>
			</div>
			<div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
				<p class="text-xs font-medium uppercase tracking-wide text-slate-500">Avg R-Multiple</p>
				<p class="mt-1 text-xl font-bold" class:text-emerald-600={data.stats.avgR >= 0} class:text-red-600={data.stats.avgR < 0}>
					{fmtR(data.stats.avgR)}
				</p>
				<p class="text-xs text-slate-500">expectancy per trade</p>
			</div>
			<div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
				<p class="text-xs font-medium uppercase tracking-wide text-slate-500">Profit Factor</p>
				<p class="mt-1 text-xl font-bold text-slate-800">
					{Number.isFinite(data.stats.profitFactor) ? data.stats.profitFactor.toFixed(2) : '∞'}
				</p>
				<p class="text-xs text-slate-500">wins / |losses|</p>
			</div>
			<div class="rounded-xl border border-red-200 bg-red-50 p-4 shadow-sm">
				<p class="text-xs font-medium uppercase tracking-wide text-red-700">Max Drawdown</p>
				<p class="mt-1 text-xl font-bold text-red-700">–{fmt0(data.stats.maxDrawdown)}</p>
				<p class="text-xs text-red-500">peak-to-trough on equity curve</p>
			</div>
		</div>

		<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
			<div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
				<p class="text-xs font-medium uppercase tracking-wide text-slate-500">Avg Win</p>
				<p class="mt-1 text-lg font-semibold text-emerald-600">{fmt0(data.stats.avgWin)}</p>
			</div>
			<div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
				<p class="text-xs font-medium uppercase tracking-wide text-slate-500">Avg Loss</p>
				<p class="mt-1 text-lg font-semibold text-red-600">{fmt0(data.stats.avgLoss)}</p>
			</div>
			<div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
				<p class="text-xs font-medium uppercase tracking-wide text-slate-500">Avg Hold</p>
				<p class="mt-1 text-lg font-semibold text-slate-800">{data.stats.avgHoldDays.toFixed(1)} days</p>
			</div>
			<div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
				<p class="text-xs font-medium uppercase tracking-wide text-slate-500">Best / Worst</p>
				<p class="mt-1 text-sm font-semibold text-emerald-600">
					+{fmt0(data.stats.bestTrade?.realizedPnl ?? 0)} <span class="text-xs text-slate-500">({data.stats.bestTrade?.ticker ?? '—'})</span>
				</p>
				<p class="text-sm font-semibold text-red-600">
					{fmt0(data.stats.worstTrade?.realizedPnl ?? 0)} <span class="text-xs text-slate-500">({data.stats.worstTrade?.ticker ?? '—'})</span>
				</p>
			</div>
		</div>

		<!-- Charts -->
		<TrendClosedCharts
			equityCurve={data.equityCurve}
			buckets={data.buckets}
			perTicker={data.perTicker}
		/>

		<!-- Filters + bulk-delete -->
		<div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
			<div class="flex flex-wrap items-center gap-3">
				<label class="flex items-center gap-2 text-xs font-medium text-slate-600">
					Ticker
					<input type="text" bind:value={filterTicker} placeholder="e.g. PTT"
						class="w-32 rounded-md border border-slate-300 px-2 py-1 text-sm uppercase" />
				</label>
				<div class="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-medium">
					{#each ['all', 'wins', 'losses'] as opt}
						<button onclick={() => (filterOutcome = opt as any)}
							class="rounded-md px-3 py-1 transition-colors"
							class:bg-white={filterOutcome === opt}
							class:text-indigo-600={filterOutcome === opt}
							class:shadow-sm={filterOutcome === opt}
							class:text-slate-500={filterOutcome !== opt}>
							{opt}
						</button>
					{/each}
				</div>
				<span class="text-xs text-slate-500">Showing {visible.length} of {data.closed.length}</span>
				<div class="ml-auto flex gap-2">
					<button onclick={deleteAllClosed} disabled={deleting}
						class="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50">
						Delete ALL closed cycles
					</button>
				</div>
			</div>
		</div>

		<!-- Cycle table -->
		<section class="rounded-xl border border-slate-200 bg-white shadow-sm">
			<div class="overflow-x-auto">
				<table class="min-w-full text-sm">
					<thead>
						<tr class="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
							<th class="w-6 px-2 py-2"></th>
							<th class="px-4 py-2 text-left font-semibold">Ticker</th>
							<th class="px-4 py-2 text-right font-semibold">Cycle</th>
							<th class="cursor-pointer px-4 py-2 text-right font-semibold hover:bg-slate-100" onclick={() => toggleSort('closedAt')}>
								Closed {sortBy === 'closedAt' ? (sortAsc ? '↑' : '↓') : ''}
							</th>
							<th class="cursor-pointer px-4 py-2 text-right font-semibold hover:bg-slate-100" onclick={() => toggleSort('holdDays')}>
								Held {sortBy === 'holdDays' ? (sortAsc ? '↑' : '↓') : ''}
							</th>
							<th class="px-4 py-2 text-right font-semibold">Units</th>
							<th class="px-4 py-2 text-right font-semibold">Avg Cost → Avg Sell</th>
							<th class="cursor-pointer px-4 py-2 text-right font-semibold hover:bg-slate-100" onclick={() => toggleSort('realizedPnl')}>
								P/L {sortBy === 'realizedPnl' ? (sortAsc ? '↑' : '↓') : ''}
							</th>
							<th class="px-4 py-2 text-right font-semibold">Return %</th>
							<th class="cursor-pointer px-4 py-2 text-right font-semibold hover:bg-slate-100" onclick={() => toggleSort('rMultiple')}>
								R Multiple {sortBy === 'rMultiple' ? (sortAsc ? '↑' : '↓') : ''}
							</th>
							<th class="px-4 py-2 text-center font-semibold">Actions</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-100">
						{#each visible as c (keyFor(c))}
							{@const isOpen = expanded[keyFor(c)]}
							<tr class="cursor-pointer hover:bg-slate-50" onclick={() => (expanded[keyFor(c)] = !expanded[keyFor(c)])}>
								<td class="px-2 py-2 text-center text-slate-400">{isOpen ? '▼' : '▶'}</td>
								<td class="px-4 py-2 font-semibold text-slate-800">{c.ticker}</td>
								<td class="px-4 py-2 text-right">#{c.cycleIndex}</td>
								<td class="px-4 py-2 text-right text-slate-600">{c.closedAt}</td>
								<td class="px-4 py-2 text-right">{c.holdDays}d</td>
								<td class="px-4 py-2 text-right">{c.units}</td>
								<td class="px-4 py-2 text-right text-slate-600">{fmt(c.avgCost)} → {fmt(c.avgSell)}</td>
								<td class="px-4 py-2 text-right font-semibold" class:text-emerald-600={c.realizedPnl >= 0} class:text-red-600={c.realizedPnl < 0}>
									{fmt0(c.realizedPnl)}
								</td>
								<td class="px-4 py-2 text-right" class:text-emerald-600={c.returnPct >= 0} class:text-red-600={c.returnPct < 0}>
									{pct(c.returnPct)}
								</td>
								<td class="px-4 py-2 text-right font-medium" class:text-emerald-600={c.rMultiple >= 0} class:text-red-600={c.rMultiple < 0}>
									{fmtR(c.rMultiple)}
								</td>
								<td class="px-4 py-2 text-center" onclick={(e) => e.stopPropagation()}>
									<div class="flex justify-center gap-2">
										<button onclick={() => deleteCycle(c)} disabled={deleting}
											class="text-xs text-red-600 hover:underline disabled:opacity-50">Delete cycle</button>
										<button onclick={() => deleteAllForTicker(c.ticker)} disabled={deleting}
											class="text-xs text-slate-400 hover:text-red-500 hover:underline disabled:opacity-50"
											title="Delete all closed cycles for {c.ticker}">All {c.ticker}</button>
									</div>
								</td>
							</tr>

							{#if isOpen}
								<tr class="bg-slate-50">
									<td colspan="11" class="px-4 py-3">
										<div class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Transactions</div>
										<table class="w-full text-xs">
											<thead>
												<tr class="text-slate-500">
													<th class="pb-1 text-left">Date</th>
													<th class="pb-1 text-left">Type</th>
													<th class="pb-1 text-right">Unit</th>
													<th class="pb-1 text-right">Shares</th>
													<th class="pb-1 text-right">Price</th>
													<th class="pb-1 text-right">Stop</th>
													<th class="pb-1 text-right">ATR@entry</th>
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
														<td class="py-1 text-right">{tx.atrAtEntry > 0 ? tx.atrAtEntry.toFixed(3) : '—'}</td>
													</tr>
												{/each}
											</tbody>
										</table>
									</td>
								</tr>
							{/if}
						{/each}
					</tbody>
				</table>
			</div>
		</section>
	{/if}
</div>
