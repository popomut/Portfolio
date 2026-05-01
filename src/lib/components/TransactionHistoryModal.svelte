<script lang="ts">
	import type { Transaction, Dividend } from '$lib/utils/portfolio';
	import { computePortfolioItem } from '$lib/utils/portfolio';
	import AddDividendModal from '$lib/components/AddDividendModal.svelte';

	let {
		open,
		ticker,
		stockName,
		currentPrice,
		currentShares,
		stockCurrency,
		onclose,
		onedit,
		ondelete
	}: {
		open: boolean;
		ticker: string;
		stockName: string;
		currentPrice: number;
		currentShares: number;
		stockCurrency: string;
		onclose: () => void;
		onedit: (tx: Transaction) => void;
		ondelete: (id: string) => Promise<void>;
	} = $props();

	let transactions = $state<Transaction[]>([]);
	let dividends = $state<Dividend[]>([]);
	let loading = $state(false);
	let deleteConfirm = $state<string | null>(null);
	let deleteDivConfirm = $state<string | null>(null);
	let activeTab = $state<'transactions' | 'dividends'>('transactions');

	let dividendModalOpen = $state(false);
	let editDividend = $state<Dividend | null>(null);

	$effect(() => {
		if (open && ticker) {
			fetchAll();
		}
	});

	async function fetchAll() {
		loading = true;
		try {
			const [txRes, divRes] = await Promise.all([
				fetch(`/api/transactions?ticker=${encodeURIComponent(ticker)}`),
				fetch(`/api/dividends?ticker=${encodeURIComponent(ticker)}`)
			]);
			transactions = await txRes.json();
			dividends = await divRes.json();
		} finally {
			loading = false;
		}
	}

	async function handleDelete(id: string) {
		await ondelete(id);
		transactions = transactions.filter((t) => t.id !== id);
		deleteConfirm = null;
		if (transactions.length === 0 && dividends.length === 0) onclose();
		else await fetchAll();
	}

	async function handleDeleteDividend(id: string) {
		await fetch(`/api/dividends/${id}`, { method: 'DELETE' });
		dividends = dividends.filter((d) => d.id !== id);
		deleteDivConfirm = null;
	}

	function openEditDividend(d: Dividend) {
		editDividend = d;
		dividendModalOpen = true;
	}

	function fmtCurrency(v: number) {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);
	}

	function fmtPct(v: number) {
		return (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
	}

	function fmtIrr(v: number | null) {
		if (v === null) return '—';
		return (v * 100).toFixed(1) + '%';
	}

	let summary = $derived.by(() => {
		if (transactions.length === 0) return null;
		return computePortfolioItem(ticker, stockName, currentPrice, transactions);
	});

	let totalDividends = $derived(dividends.reduce((s, d) => s + d.totalAmount, 0));

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
	}
</script>

{#if open}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4"
		role="dialog"
		aria-modal="true"
		onkeydown={handleKeydown}
	>
		<div class="absolute inset-0 bg-black/50" onclick={onclose}></div>
		<div class="relative z-10 flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl">
			<!-- Header -->
			<div class="flex items-center justify-between border-b border-slate-200 px-6 py-4">
				<div>
					<h2 class="text-lg font-semibold text-slate-800">{ticker}</h2>
					{#if stockName}
						<p class="text-sm text-slate-500">{stockName}</p>
					{/if}
				</div>
				<button onclick={onclose} class="rounded-md p-1 text-slate-400 hover:text-slate-600">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<!-- Tab bar -->
			<div class="flex border-b border-slate-200 px-6">
				<button
					onclick={() => activeTab = 'transactions'}
					class="mr-1 border-b-2 px-4 py-3 text-sm font-medium transition-colors"
					class:border-indigo-600={activeTab === 'transactions'}
					class:text-indigo-600={activeTab === 'transactions'}
					class:border-transparent={activeTab !== 'transactions'}
					class:text-slate-500={activeTab !== 'transactions'}
					class:hover:text-slate-700={activeTab !== 'transactions'}
				>
					Transactions ({transactions.length})
				</button>
				<button
					onclick={() => activeTab = 'dividends'}
					class="border-b-2 px-4 py-3 text-sm font-medium transition-colors"
					class:border-emerald-600={activeTab === 'dividends'}
					class:text-emerald-600={activeTab === 'dividends'}
					class:border-transparent={activeTab !== 'dividends'}
					class:text-slate-500={activeTab !== 'dividends'}
					class:hover:text-slate-700={activeTab !== 'dividends'}
				>
					Dividends ({dividends.length})
				</button>
			</div>

			<!-- Body -->
			<div class="flex-1 overflow-auto">
				{#if loading}
					<div class="p-8 text-center text-slate-500">Loading…</div>
				{:else if activeTab === 'transactions'}
					{#if transactions.length === 0}
						<div class="p-8 text-center text-slate-500">No transactions found.</div>
					{:else}
						<table class="min-w-full text-sm">
							<thead class="sticky top-0 z-10">
								<tr class="border-b border-slate-200 bg-slate-50 shadow-sm">
									<th class="px-4 py-3 text-left font-semibold text-slate-600">Date</th>
									<th class="px-4 py-3 text-left font-semibold text-slate-600">Type</th>
									<th class="px-4 py-3 text-right font-semibold text-slate-600">Shares</th>
									<th class="px-4 py-3 text-right font-semibold text-slate-600">Price</th>
									<th class="px-4 py-3 text-right font-semibold text-slate-600">Fees</th>
									<th class="px-4 py-3 text-right font-semibold text-slate-600">Total</th>
									<th class="px-4 py-3 text-left font-semibold text-slate-600">Notes</th>
									<th class="px-4 py-3 text-right font-semibold text-slate-600">Actions</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-slate-100">
								{#each transactions as tx (tx.id)}
									<tr class="hover:bg-slate-50">
										<td class="px-4 py-3 text-slate-700">{tx.date}</td>
										<td class="px-4 py-3">
											<span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
												class:bg-green-100={tx.type === 'buy'}
												class:text-green-800={tx.type === 'buy'}
												class:bg-red-100={tx.type === 'sell'}
												class:text-red-800={tx.type === 'sell'}
											>
												{tx.type.toUpperCase()}
											</span>
										</td>
										<td class="px-4 py-3 text-right text-slate-700">{tx.shares.toFixed(4)}</td>
										<td class="px-4 py-3 text-right text-slate-700">{fmtCurrency(tx.pricePerShare)}</td>
										<td class="px-4 py-3 text-right text-slate-700">{fmtCurrency(tx.fees)}</td>
										<td class="px-4 py-3 text-right text-slate-700">
											{#if tx.type === 'buy'}
												{fmtCurrency(tx.shares * tx.pricePerShare + tx.fees)}
											{:else}
												{fmtCurrency(tx.shares * tx.pricePerShare - tx.fees)}
											{/if}
										</td>
										<td class="px-4 py-3 text-slate-500 text-xs max-w-32">
											{#if tx.notes}
												<div class="group relative inline-block max-w-full">
													<span class="block truncate cursor-default">{tx.notes}</span>
													<div class="pointer-events-none absolute bottom-full left-0 z-50 mb-2 hidden w-max max-w-xs rounded-lg bg-slate-800 px-3 py-2 text-xs text-white shadow-lg group-hover:block">
														{tx.notes}
														<div class="absolute left-3 top-full h-0 w-0 border-x-4 border-x-transparent border-t-4 border-t-slate-800"></div>
													</div>
												</div>
											{:else}
												<span class="text-slate-300">—</span>
											{/if}
										</td>
										<td class="px-4 py-3 text-right">
											<div class="flex items-center justify-end gap-2">
												<button
													onclick={() => onedit(tx)}
													class="text-xs text-indigo-600 hover:underline"
												>Edit</button>
												{#if deleteConfirm === tx.id}
													<button onclick={() => handleDelete(tx.id)} class="text-xs text-red-600 font-semibold hover:underline">Confirm</button>
													<button onclick={() => (deleteConfirm = null)} class="text-xs text-slate-500 hover:underline">Cancel</button>
												{:else}
													<button onclick={() => (deleteConfirm = tx.id)} class="text-xs text-red-600 hover:underline">Delete</button>
												{/if}
											</div>
										</td>
									</tr>
								{/each}
							</tbody>
							{#if summary}
								{@const s = summary}
								<tfoot>
									<tr class="border-t-2 border-slate-300 bg-slate-50 font-semibold">
										<td class="px-4 py-3 text-slate-700" colspan="2">Summary</td>
										<td class="px-4 py-3 text-right text-slate-700">{s.shares.toFixed(4)}</td>
										<td class="px-4 py-3 text-right text-slate-500 text-xs">Avg: {fmtCurrency(s.avgCost)}</td>
										<td class="px-4 py-3"></td>
										<td class="px-4 py-3 text-right">
											<div class="text-slate-700">{fmtCurrency(s.marketValue)}</div>
											<div class="text-xs" class:text-green-600={s.pnl >= 0} class:text-red-600={s.pnl < 0}>
												{fmtCurrency(s.pnl)} ({fmtPct(s.pnlPct)})
											</div>
										</td>
										<td class="px-4 py-3 text-slate-500 text-xs">IRR: {fmtIrr(s.irr)}</td>
										<td></td>
									</tr>
								</tfoot>
							{/if}
						</table>
					{/if}
				{:else}
					<!-- Dividends tab -->
					{#if dividends.length === 0}
						<div class="p-8 text-center text-slate-500">No dividends recorded yet.</div>
					{:else}
						<table class="min-w-full text-sm">
							<thead class="sticky top-0 z-10">
								<tr class="border-b border-slate-200 bg-slate-50 shadow-sm">
									<th class="px-4 py-3 text-left font-semibold text-slate-600">Ex-Date</th>
									<th class="px-4 py-3 text-left font-semibold text-slate-600">Pay Date</th>
									<th class="px-4 py-3 text-right font-semibold text-slate-600">Shares Held</th>
									<th class="px-4 py-3 text-right font-semibold text-slate-600">Amt/Share</th>
									<th class="px-4 py-3 text-right font-semibold text-slate-600">Withholding</th>
									<th class="px-4 py-3 text-right font-semibold text-slate-600">Net Total</th>
									<th class="px-4 py-3 text-left font-semibold text-slate-600">Currency</th>
									<th class="px-4 py-3 text-left font-semibold text-slate-600">Notes</th>
									<th class="px-4 py-3 text-right font-semibold text-slate-600">Actions</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-slate-100">
								{#each dividends as d (d.id)}
									<tr class="hover:bg-slate-50">
										<td class="px-4 py-3 text-slate-700">{d.exDate}</td>
										<td class="px-4 py-3 text-slate-700">{d.payDate}</td>
										<td class="px-4 py-3 text-right text-slate-700">{d.sharesHeld.toFixed(4)}</td>
										<td class="px-4 py-3 text-right text-slate-700">{d.amountPerShare.toFixed(4)}</td>
										<td class="px-4 py-3 text-right text-slate-700">{d.withholdingTax > 0 ? fmtCurrency(d.withholdingTax) : '—'}</td>
										<td class="px-4 py-3 text-right font-medium text-emerald-700">{fmtCurrency(d.totalAmount)}</td>
										<td class="px-4 py-3 text-slate-500 text-xs">{d.currency}</td>
										<td class="px-4 py-3 text-slate-500 text-xs max-w-24">
											{#if d.notes}
												<span class="block truncate">{d.notes}</span>
											{:else}
												<span class="text-slate-300">—</span>
											{/if}
										</td>
										<td class="px-4 py-3 text-right">
											<div class="flex items-center justify-end gap-2">
												<button
													onclick={() => openEditDividend(d)}
													class="text-xs text-emerald-600 hover:underline"
												>Edit</button>
												{#if deleteDivConfirm === d.id}
													<button onclick={() => handleDeleteDividend(d.id)} class="text-xs text-red-600 font-semibold hover:underline">Confirm</button>
													<button onclick={() => (deleteDivConfirm = null)} class="text-xs text-slate-500 hover:underline">Cancel</button>
												{:else}
													<button onclick={() => (deleteDivConfirm = d.id)} class="text-xs text-red-600 hover:underline">Delete</button>
												{/if}
											</div>
										</td>
									</tr>
								{/each}
							</tbody>
							<tfoot>
								<tr class="border-t-2 border-slate-300 bg-emerald-50 font-semibold">
									<td class="px-4 py-3 text-slate-700" colspan="5">Total Dividends Received</td>
									<td class="px-4 py-3 text-right text-emerald-700">{fmtCurrency(totalDividends)}</td>
									<td colspan="3"></td>
								</tr>
							</tfoot>
						</table>
					{/if}
				{/if}
			</div>
		</div>
	</div>

	<!-- Edit Dividend Modal (z-60 to be above this modal) -->
	{#if dividendModalOpen}
		<AddDividendModal
			open={dividendModalOpen}
			{ticker}
			currency={stockCurrency}
			{currentShares}
			{editDividend}
			onclose={async (saved) => {
				dividendModalOpen = false;
				editDividend = null;
				if (saved) await fetchAll();
			}}
		/>
	{/if}
{/if}

