<script lang="ts">
	import type { Transaction } from '$lib/utils/portfolio';

	let {
		open,
		ticker,
		transactions,
		totalShares,
		currentPrice,
		onclose
	}: {
		open: boolean;
		ticker: string;
		transactions: Transaction[];
		totalShares: number;
		currentPrice: number;
		onclose: (saved: boolean) => void;
	} = $props();

	// ── FIFO matching ─────────────────────────────────────────────────
	type SellEntry = {
		txnId: string;
		date: string;
		sharesApplied: number;
		pricePerShare: number;
		feesApplied: number;
		pnl: number;
	};

	type LotMatch = {
		remaining: number;
		soldShares: number;
		proceeds: number;
		soldFees: number;
		sellEntries: SellEntry[];
	};

	function computeFifo(txns: Transaction[], buyMap: Map<string, Transaction>): Map<string, LotMatch> {
		const buys = [...txns]
			.filter((t) => t.type === 'buy')
			.sort((a, b) => a.date.localeCompare(b.date));
		const sells = [...txns]
			.filter((t) => t.type === 'sell')
			.sort((a, b) => a.date.localeCompare(b.date));

		const map = new Map<string, LotMatch>();
		for (const b of buys) {
			map.set(b.id, { remaining: b.shares, soldShares: 0, proceeds: 0, soldFees: 0, sellEntries: [] });
		}

		for (const sell of sells) {
			let toApply = sell.shares;
			for (const b of buys) {
				if (toApply <= 0.00001) break;
				const m = map.get(b.id)!;
				if (m.remaining <= 0.00001) continue;

				const applied = Math.min(m.remaining, toApply);
				const sellFeeShare = sell.shares > 0 ? (applied / sell.shares) * sell.fees : 0;
				const buyFeeShare  = b.shares  > 0 ? (applied / b.shares)  * b.fees  : 0;
				const proceeds = applied * sell.pricePerShare - sellFeeShare;
				const cost     = applied * b.pricePerShare   + buyFeeShare;

				map.set(b.id, {
					remaining:   m.remaining - applied,
					soldShares:  m.soldShares + applied,
					proceeds:    m.proceeds + applied * sell.pricePerShare,
					soldFees:    m.soldFees + sellFeeShare,
					sellEntries: [...m.sellEntries, {
						txnId:        sell.id,
						date:         sell.date,
						sharesApplied: applied,
						pricePerShare: sell.pricePerShare,
						feesApplied:  sellFeeShare,
						pnl:          proceeds - cost
					}]
				});
				toApply -= applied;
			}
		}
		return map;
	}

	let buyLots = $derived(
		[...transactions]
			.filter((t) => t.type === 'buy')
			.sort((a, b) => a.date.localeCompare(b.date))
	);

	let buyMap = $derived(new Map(buyLots.map((b) => [b.id, b])));
	let fifo    = $derived(computeFifo(transactions, buyMap));

	function match(id: string): LotMatch {
		return fifo.get(id) ?? { remaining: 0, soldShares: 0, proceeds: 0, soldFees: 0, sellEntries: [] };
	}

	function isFullySold(lot: Transaction)   { return match(lot.id).remaining <= 0.00001; }
	function isPartiallySold(lot: Transaction) {
		const m = match(lot.id);
		return m.soldShares > 0.00001 && m.remaining > 0.00001;
	}

	function realisedPnl(lot: Transaction): number | null {
		const m = match(lot.id);
		if (m.soldShares <= 0.00001) return null;
		return m.sellEntries.reduce((s, e) => s + e.pnl, 0);
	}

	function rowClass(lot: Transaction): string {
		if (!isFullySold(lot)) return '';
		const pnl = realisedPnl(lot);
		if (pnl === null) return '';
		return pnl >= 0 ? 'bg-green-50' : 'bg-red-50';
	}

	// ── Sell-history popup ────────────────────────────────────────────
	let historyLot = $state<Transaction | null>(null);

	function openHistory(lot: Transaction, e: MouseEvent) {
		e.stopPropagation();
		historyLot = lot;
	}

	// ── Lot selection state ───────────────────────────────────────────
	type LotState = { checked: boolean; sharesToSell: string };
	let lotState = $state<Record<string, LotState>>({});

	let sellPrice = $state('');
	let sellDate  = $state('');
	let fees      = $state('0');
	let notes     = $state('');
	let error     = $state('');
	let loading   = $state(false);

	$effect(() => {
		if (open) {
			lotState = {};
			sellPrice = '';
			sellDate = new Date().toISOString().slice(0, 10);
			fees = '0'; notes = ''; error = ''; loading = false;
			historyLot = null;
		}
	});

	function toggleLot(lot: Transaction) {
		if (isFullySold(lot)) return;
		const id = lot.id;
		if (lotState[id]?.checked) {
			lotState = { ...lotState, [id]: { checked: false, sharesToSell: '' } };
		} else {
			lotState = { ...lotState, [id]: { checked: true, sharesToSell: String(match(id).remaining) } };
		}
	}

	function updateShares(id: string, val: string) {
		lotState = { ...lotState, [id]: { ...lotState[id], sharesToSell: val } };
	}

	function selectAll() {
		const next: Record<string, LotState> = {};
		for (const lot of buyLots) {
			if (!isFullySold(lot))
				next[lot.id] = { checked: true, sharesToSell: String(match(lot.id).remaining) };
		}
		lotState = next;
	}
	function clearAll() { lotState = {}; }

	let selectedLots = $derived(buyLots.filter((l) => lotState[l.id]?.checked));

	let totalSharesToSell = $derived(
		selectedLots.reduce((sum, l) => {
			const n = parseFloat(lotState[l.id]?.sharesToSell ?? '0');
			return sum + (isNaN(n) ? 0 : n);
		}, 0)
	);

	let estimatedCost = $derived(
		selectedLots.reduce((sum, l) => {
			const qty = parseFloat(lotState[l.id]?.sharesToSell ?? '0') || 0;
			return sum + qty * l.pricePerShare + (qty / l.shares) * l.fees;
		}, 0)
	);

	let estimatedProceeds = $derived(
		totalSharesToSell * (parseFloat(sellPrice) || 0) - (parseFloat(fees) || 0)
	);

	let estimatedPnl = $derived(estimatedProceeds - estimatedCost);

	let validationMsg = $derived((() => {
		if (selectedLots.length === 0) return 'Select at least one lot to sell';
		if (totalSharesToSell > totalShares + 0.00001)
			return `Cannot sell ${fmtShares(totalSharesToSell)} — only ${fmtShares(totalShares)} remain`;
		const badLot = selectedLots.find((l) => {
			const n = parseFloat(lotState[l.id]?.sharesToSell ?? '');
			return isNaN(n) || n <= 0 || n > match(l.id).remaining + 0.00001;
		});
		if (badLot) return `Lot ${badLot.date}: qty must be 0 < n ≤ ${fmtShares(match(badLot.id).remaining)}`;
		if (!sellPrice || parseFloat(sellPrice) <= 0) return 'Enter a sell price';
		if (!sellDate) return 'Enter a sell date';
		return '';
	})());

	let canSubmit = $derived(validationMsg === '' && !loading);

	// ── Helpers ───────────────────────────────────────────────────────
	function fmtCcy(v: number) {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(v);
	}
	function fmtShares(v: number) {
		return v.toLocaleString('en-US', { maximumFractionDigits: 4 });
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			if (historyLot) { historyLot = null; return; }
			onclose(false);
		}
	}

	async function handleSell() {
		if (!canSubmit) return;
		loading = true; error = '';
		try {
			const res = await fetch('/api/transactions', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					ticker, type: 'sell', date: sellDate,
					shares: totalSharesToSell,
					pricePerShare: parseFloat(sellPrice),
					fees: parseFloat(fees) || 0,
					notes: notes || `Sold ${fmtShares(totalSharesToSell)} sh from ${selectedLots.length} lot(s): ${selectedLots.map((l) => l.date).join(', ')}`
				})
			});
			if (res.ok) {
				onclose(true);
			} else {
				const data = await res.json();
				error = data.error ?? 'Failed to record sell transaction';
			}
		} catch {
			error = 'Network error — please try again';
		} finally {
			loading = false;
		}
	}
</script>

{#if open}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		role="dialog"
		aria-modal="true"
		aria-labelledby="sell-modal-title"
		class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 py-8"
		onkeydown={handleKeydown}
	>
		<!-- Backdrop -->
		<div class="fixed inset-0 bg-black/50 backdrop-blur-sm" onclick={() => onclose(false)} role="presentation"></div>

		<!-- Main card -->
		<div class="relative z-10 w-full max-w-3xl rounded-2xl bg-white shadow-2xl">

			<!-- Header -->
			<div class="flex items-center justify-between rounded-t-2xl border-b border-slate-200 bg-slate-50 px-6 py-4">
				<div class="flex items-center gap-3">
					<div class="flex h-9 w-9 items-center justify-center rounded-full bg-red-100">
						<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
						</svg>
					</div>
					<div>
						<h2 id="sell-modal-title" class="text-base font-bold text-slate-800">Sell {ticker}</h2>
						<p class="text-xs text-slate-500">{fmtShares(totalShares)} shares available · current price {fmtCcy(currentPrice)}</p>
					</div>
				</div>
				<button onclick={() => onclose(false)} class="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<div class="space-y-5 p-6">

				<!-- Legend -->
				{#if buyLots.some((l) => isFullySold(l) || isPartiallySold(l))}
					<div class="flex flex-wrap gap-4 text-xs text-slate-500">
						<span class="flex items-center gap-1.5"><span class="inline-block h-3 w-3 rounded-sm bg-green-100 ring-1 ring-green-300"></span>Sold at a profit</span>
						<span class="flex items-center gap-1.5"><span class="inline-block h-3 w-3 rounded-sm bg-red-100 ring-1 ring-red-300"></span>Sold at a loss</span>
						<span class="flex items-center gap-1.5"><span class="inline-block h-3 w-3 rounded-sm bg-white ring-1 ring-slate-300"></span>Not yet sold</span>
					</div>
				{/if}

				<!-- ① Lot table -->
				<div>
					<div class="mb-2 flex items-center justify-between">
						<h3 class="text-sm font-semibold text-slate-700">
							① Select lots to sell
							{#if selectedLots.length > 0}
								<span class="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">{selectedLots.length} selected</span>
							{/if}
						</h3>
						<div class="flex gap-3 text-xs">
							<button onclick={selectAll} class="text-indigo-600 hover:underline">Select all</button>
							<button onclick={clearAll} class="text-slate-400 hover:underline">Clear</button>
						</div>
					</div>

					{#if buyLots.length === 0}
						<p class="text-sm italic text-slate-500">No buy transactions found for {ticker}.</p>
					{:else}
						<div class="overflow-hidden rounded-xl border border-slate-200">
							<table class="min-w-full text-sm">
								<thead class="border-b border-slate-200 bg-slate-100">
									<tr>
										<th class="w-8 px-3 py-2"></th>
										<th class="px-3 py-2 text-left text-xs font-semibold text-slate-500">Buy Date</th>
										<th class="px-3 py-2 text-right text-xs font-semibold text-slate-500">Lot Shares</th>
										<th class="px-3 py-2 text-right text-xs font-semibold text-slate-500">Remaining</th>
										<th class="px-3 py-2 text-right text-xs font-semibold text-slate-500">Buy Price</th>
										<th class="px-3 py-2 text-right text-xs font-semibold text-slate-500">Realised P&amp;L</th>
										<th class="px-3 py-2 text-right text-xs font-semibold text-slate-500">Shares to Sell</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-slate-100">
									{#each buyLots as lot (lot.id)}
										{@const m = match(lot.id)}
										{@const fullySold = isFullySold(lot)}
										{@const partiallySold = isPartiallySold(lot)}
										{@const checked = lotState[lot.id]?.checked ?? false}
										{@const pnl = realisedPnl(lot)}
										<tr
											class="{rowClass(lot)} transition-colors {fullySold ? 'cursor-not-allowed' : 'cursor-pointer hover:brightness-95'}"
											onclick={() => toggleLot(lot)}
										>
											<!-- Checkbox -->
											<td class="px-3 py-2.5 text-center">
												<input
													type="checkbox"
													checked={checked}
													disabled={fullySold}
													onchange={() => toggleLot(lot)}
													onclick={(e) => e.stopPropagation()}
													class="h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500 disabled:cursor-not-allowed disabled:opacity-40"
												/>
											</td>

											<!-- Buy Date + badges -->
											<td class="px-3 py-2.5">
												<div class="flex flex-wrap items-center gap-2">
													<span class="font-medium text-slate-700">{lot.date}</span>
													{#if fullySold}
														<span class="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">Fully Sold</span>
													{:else if partiallySold}
														<span class="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">Partial</span>
													{/if}
												</div>
												{#if lot.notes}
													<p class="mt-0.5 text-xs text-slate-400">{lot.notes}</p>
												{/if}
											</td>

											<!-- Lot Shares -->
											<td class="px-3 py-2.5 text-right text-slate-600">{fmtShares(lot.shares)}</td>

											<!-- Remaining -->
											<td class="px-3 py-2.5 text-right">
												{#if fullySold}
													<span class="text-slate-400">—</span>
												{:else}
													<span class="font-medium" class:text-yellow-700={partiallySold} class:text-slate-700={!partiallySold}>
														{fmtShares(m.remaining)}
													</span>
												{/if}
											</td>

											<!-- Buy Price -->
											<td class="px-3 py-2.5 text-right text-slate-600">{fmtCcy(lot.pricePerShare)}</td>

											<!-- Realised P&L + sell-history link -->
											<td class="px-3 py-2.5 text-right" onclick={(e) => e.stopPropagation()}>
												{#if pnl !== null}
													<span class="font-semibold" class:text-green-600={pnl >= 0} class:text-red-600={pnl < 0}>
														{pnl >= 0 ? '+' : ''}{fmtCcy(pnl)}
													</span>
													<!-- Sell-history link -->
													<button
														onclick={(e) => openHistory(lot, e)}
														class="mt-0.5 block w-full text-right text-xs text-indigo-500 hover:text-indigo-700 hover:underline"
														title="View sell transactions for this lot"
													>
														{m.sellEntries.length} sell{m.sellEntries.length !== 1 ? 's' : ''} →
													</button>
												{:else}
													<span class="text-slate-300">—</span>
												{/if}
											</td>

											<!-- Shares to Sell input -->
											<td class="px-3 py-2.5 text-right" onclick={(e) => e.stopPropagation()}>
												{#if checked}
													<input
														type="number"
														min="0.0001"
														max={m.remaining}
														step="0.0001"
														value={lotState[lot.id]?.sharesToSell ?? ''}
														oninput={(e) => updateShares(lot.id, (e.currentTarget as HTMLInputElement).value)}
														onclick={(e) => e.stopPropagation()}
														class="w-28 rounded-lg border border-red-300 bg-white px-2 py-1 text-right text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-300"
													/>
												{:else}
													<span class="text-xs text-slate-300">—</span>
												{/if}
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/if}
				</div>

				<!-- ② Sell details -->
				<div>
					<h3 class="mb-3 text-sm font-semibold text-slate-700">② Sell details</h3>
					<div class="grid grid-cols-2 gap-4">
						<div>
							<label class="mb-1 block text-xs font-medium text-slate-600" for="sell-price">
								Sell Price per Share <span class="text-red-500">*</span>
							</label>
							<div class="relative">
								<span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
								<input id="sell-price" type="number" min="0" step="0.01" bind:value={sellPrice} placeholder="0.00"
									class="w-full rounded-lg border border-slate-300 py-2 pl-7 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-300" />
							</div>
						</div>
						<div>
							<label class="mb-1 block text-xs font-medium text-slate-600" for="sell-date">
								Sell Date <span class="text-red-500">*</span>
							</label>
							<input id="sell-date" type="date" bind:value={sellDate}
								class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-300" />
						</div>
						<div>
							<label class="mb-1 block text-xs font-medium text-slate-600" for="sell-fees">Fees / Commission</label>
							<div class="relative">
								<span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
								<input id="sell-fees" type="number" min="0" step="0.01" bind:value={fees} placeholder="0.00"
									class="w-full rounded-lg border border-slate-300 py-2 pl-7 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-300" />
							</div>
						</div>
						<div>
							<label class="mb-1 block text-xs font-medium text-slate-600" for="sell-notes">Notes</label>
							<input id="sell-notes" type="text" bind:value={notes} placeholder="Optional"
								class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-300" />
						</div>
					</div>
				</div>

				<!-- Summary -->
				{#if totalSharesToSell > 0}
					<div class="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">
						<h3 class="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Transaction Summary</h3>
						<div class="grid grid-cols-4 gap-4 text-sm">
							<div>
								<p class="text-xs text-slate-500">Shares Selling</p>
								<p class="mt-0.5 font-semibold text-slate-800">{fmtShares(totalSharesToSell)}</p>
							</div>
							<div>
								<p class="text-xs text-slate-500">Cost Basis</p>
								<p class="mt-0.5 font-semibold text-slate-800">{fmtCcy(estimatedCost)}</p>
							</div>
							<div>
								<p class="text-xs text-slate-500">Est. Proceeds</p>
								<p class="mt-0.5 font-semibold text-slate-800">{parseFloat(sellPrice) > 0 ? fmtCcy(estimatedProceeds) : '—'}</p>
							</div>
							<div>
								<p class="text-xs text-slate-500">Est. Gain / Loss</p>
								{#if parseFloat(sellPrice) > 0}
									<p class="mt-0.5 font-bold" class:text-green-600={estimatedPnl >= 0} class:text-red-600={estimatedPnl < 0}>
										{estimatedPnl >= 0 ? '+' : ''}{fmtCcy(estimatedPnl)}
									</p>
								{:else}
									<p class="mt-0.5 font-semibold text-slate-400">—</p>
								{/if}
							</div>
						</div>
					</div>
				{/if}

				{#if error}
					<p class="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>
				{/if}
				{#if !canSubmit && validationMsg}
					<p class="text-xs text-amber-600">⚠ {validationMsg}</p>
				{/if}
			</div>

			<!-- Footer -->
			<div class="flex items-center justify-between rounded-b-2xl border-t border-slate-100 bg-slate-50 px-6 py-4">
				<p class="text-xs text-slate-400">
					{selectedLots.length} lot{selectedLots.length !== 1 ? 's' : ''} selected · {fmtShares(totalSharesToSell)} shares
				</p>
				<div class="flex gap-3">
					<button onclick={() => onclose(false)} class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100">
						Cancel
					</button>
					<button
						onclick={handleSell}
						disabled={!canSubmit}
						class="flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{#if loading}
							<svg class="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
							</svg>
							Selling…
						{:else}
							<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
							</svg>
							Sell {totalSharesToSell > 0 ? fmtShares(totalSharesToSell) + ' shares' : ''}
						{/if}
					</button>
				</div>
			</div>
		</div>
	</div>

	<!-- ── Sell-history popup (z-60, above main modal) ─────────────── -->
	{#if historyLot}
		{@const hm = match(historyLot.id)}
		{@const totalPnl = hm.sellEntries.reduce((s, e) => s + e.pnl, 0)}
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby="sell-history-title"
			class="fixed inset-0 z-60 flex items-center justify-center p-6"
			onkeydown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); historyLot = null; } }}
		>
			<!-- Darker overlay on top of the main modal backdrop -->
			<div class="absolute inset-0 bg-black/40" onclick={() => (historyLot = null)} role="presentation"></div>

			<div class="relative z-10 w-full max-w-lg rounded-2xl bg-white shadow-2xl">
				<!-- Header -->
				<div class="flex items-center justify-between rounded-t-2xl border-b border-slate-200 bg-indigo-50 px-5 py-4">
					<div>
						<h3 id="sell-history-title" class="text-sm font-bold text-slate-800">
							Sell history — buy lot {historyLot.date}
						</h3>
						<p class="text-xs text-slate-500">
							{fmtShares(historyLot.shares)} shares bought @ {fmtCcy(historyLot.pricePerShare)} ·
							{fmtShares(hm.soldShares)} sold via {hm.sellEntries.length} transaction{hm.sellEntries.length !== 1 ? 's' : ''}
						</p>
					</div>
					<button onclick={() => (historyLot = null)} class="rounded-lg p-1.5 text-slate-400 hover:bg-indigo-100 hover:text-slate-600">
						<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>

				<!-- Table -->
				<div class="overflow-hidden">
					<table class="min-w-full text-sm">
						<thead class="border-b border-slate-200 bg-slate-50">
							<tr>
								<th class="px-4 py-2 text-left text-xs font-semibold text-slate-500">Sell Date</th>
								<th class="px-4 py-2 text-right text-xs font-semibold text-slate-500">Shares Sold</th>
								<th class="px-4 py-2 text-right text-xs font-semibold text-slate-500">Sell Price</th>
								<th class="px-4 py-2 text-right text-xs font-semibold text-slate-500">Proceeds</th>
								<th class="px-4 py-2 text-right text-xs font-semibold text-slate-500">P&amp;L</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-slate-100">
							{#each hm.sellEntries as entry (entry.txnId + entry.date)}
								{@const proceeds = entry.sharesApplied * entry.pricePerShare - entry.feesApplied}
								<tr class="hover:bg-slate-50">
									<td class="px-4 py-2.5 font-medium text-slate-700">{entry.date}</td>
									<td class="px-4 py-2.5 text-right text-slate-600">{fmtShares(entry.sharesApplied)}</td>
									<td class="px-4 py-2.5 text-right text-slate-600">{fmtCcy(entry.pricePerShare)}</td>
									<td class="px-4 py-2.5 text-right text-slate-600">{fmtCcy(proceeds)}</td>
									<td class="px-4 py-2.5 text-right font-semibold" class:text-green-600={entry.pnl >= 0} class:text-red-600={entry.pnl < 0}>
										{entry.pnl >= 0 ? '+' : ''}{fmtCcy(entry.pnl)}
									</td>
								</tr>
							{/each}
						</tbody>
						<!-- Totals row -->
						<tfoot class="border-t-2 border-slate-300 bg-slate-50">
							<tr>
								<td class="px-4 py-2.5 text-xs font-bold text-slate-600 uppercase tracking-wide">Total</td>
								<td class="px-4 py-2.5 text-right font-bold text-slate-800">{fmtShares(hm.soldShares)}</td>
								<td class="px-4 py-2.5"></td>
								<td class="px-4 py-2.5 text-right font-bold text-slate-800">{fmtCcy(hm.proceeds - hm.soldFees)}</td>
								<td class="px-4 py-2.5 text-right font-bold text-lg" class:text-green-600={totalPnl >= 0} class:text-red-600={totalPnl < 0}>
									{totalPnl >= 0 ? '+' : ''}{fmtCcy(totalPnl)}
								</td>
							</tr>
						</tfoot>
					</table>
				</div>

				<div class="rounded-b-2xl border-t border-slate-100 bg-slate-50 px-5 py-3 text-right">
					<button onclick={() => (historyLot = null)} class="rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100">
						Close
					</button>
				</div>
			</div>
		</div>
	{/if}
{/if}
