<script lang="ts">
import { invalidateAll } from '$app/navigation';
import AddTransactionModal from '$lib/components/AddTransactionModal.svelte';
import AddDividendModal from '$lib/components/AddDividendModal.svelte';
import TransactionHistoryModal from '$lib/components/TransactionHistoryModal.svelte';
import DeleteStockModal from '$lib/components/DeleteStockModal.svelte';
import SellModal from '$lib/components/SellModal.svelte';
import PortfolioChart from '$lib/components/PortfolioChart.svelte';
import type { PortfolioItem, Transaction } from '$lib/utils/portfolio';

let { data } = $props();

let showAddModal = $state(false);
let editTransaction = $state<Transaction | null>(null);
let historyTicker = $state<string | null>(null);
let historyItem = $state<PortfolioItem | null>(null);
let deleteItem = $state<PortfolioItem | null>(null);
let deleting = $state(false);
let sellItem = $state<PortfolioItem | null>(null);
let dividendItem = $state<PortfolioItem | null>(null);
let fetchingPrices = $state(false);
let stalePrices = $state<Set<string>>(new Set());
let fetchingTicker = $state<string | null>(null);

function openAdd() {
	editTransaction = null;
	showAddModal = true;
}

function openHistory(item: PortfolioItem) {
	historyItem = item;
	historyTicker = item.ticker;
}

function openSell(item: PortfolioItem) {
	sellItem = item;
}

function openDividend(item: PortfolioItem) {
	dividendItem = item;
}

function handleEdit(tx: Transaction) {
	historyTicker = null;
	historyItem = null;
	editTransaction = tx;
	showAddModal = true;
}

async function handleDeleteTransaction(id: string) {
	await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
	await invalidateAll();
}

async function confirmDeleteStock() {
	if (!deleteItem || deleting) return;
	deleting = true;
	try {
		await fetch(`/api/stocks/${deleteItem.ticker}`, { method: 'DELETE' });
		await invalidateAll();
	} finally {
		deleting = false;
		deleteItem = null;
	}
}

function fmtCurrency(v: number) {
	return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(v);
}

function fmtPct(v: number) {
	return (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
}

function fmtIrr(v: number | null) {
	if (v === null) return '—';
	return (v * 100).toFixed(1) + '%';
}

async function updatePrice(ticker: string, currentPrice: number) {
	const input = prompt(`Update price for ${ticker}:`, String(currentPrice));
	if (input === null) return;
	const price = parseFloat(input);
	if (isNaN(price)) return;
	await fetch(`/api/stocks/${ticker}`, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ currentPrice: price })
	});
	await invalidateAll();
}

async function fetchCurrentPrices() {
	fetchingPrices = true;
	stalePrices = new Set();
	
	try {
		const stocks = data.summary.items;
		
		for (const stock of stocks) {
			fetchingTicker = stock.ticker;
			
			try {
				const response = await fetch('/api/stocks/prices', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ ticker: stock.ticker })
				});

				const result = await response.json();

				if (!response.ok) {
					console.error(`Failed to fetch price for ${stock.ticker}:`, result.error);
					stalePrices.add(stock.ticker);
					continue;
				}

				if (result.errors && result.errors.length > 0) {
					result.errors.forEach((e: any) => {
						console.warn(`Could not fetch price for ${e.ticker}: ${e.error}`);
						stalePrices.add(e.ticker);
					});
				}

				if (result.results && result.results.length > 0) {
					console.log(`✓ Fetched ${result.results[0].ticker}: $${result.results[0].price}`);
				}
			} catch (err) {
				console.error(`Error fetching price for ${stock.ticker}:`, (err as Error).message);
				stalePrices.add(stock.ticker);
			}
		}
		
		// Refresh data only once at the end
		await invalidateAll();
	} finally {
		fetchingPrices = false;
		fetchingTicker = null;
	}
}
</script>

<div class="space-y-6">
<!-- Summary bar -->
<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-10">
<div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
<p class="text-xs font-medium text-slate-500 uppercase tracking-wide">Market Value</p>
<p class="mt-1 text-xl font-bold text-slate-800">{fmtCurrency(data.summary.totalMarketValue)}</p>
</div>
<div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
<p class="text-xs font-medium text-slate-500 uppercase tracking-wide">Cost Basis</p>
<p class="mt-1 text-xl font-bold text-slate-800">{fmtCurrency(data.summary.totalCostBasis)}</p>
</div>
<div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
<p class="text-xs font-medium text-slate-500 uppercase tracking-wide">Positions</p>
<p class="mt-1 text-xl font-bold text-slate-800">{data.summary.items.length}</p>
</div>
<div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
<p class="text-xs font-medium text-slate-500 uppercase tracking-wide">Unrealized Gains</p>
<p class="mt-1 text-xl font-bold" class:text-green-600={data.summary.totalPnl >= 0} class:text-red-600={data.summary.totalPnl < 0}>
{fmtCurrency(data.summary.totalPnl)} ({fmtPct(data.summary.totalPnlPct)})
</p>
</div>
<div class="rounded-xl border border-cyan-200 bg-cyan-50 p-4 shadow-sm">
<p class="text-xs font-medium text-cyan-700 uppercase tracking-wide">Realized Gains/Loss from Open Positions</p>
<p class="mt-1 text-xl font-bold" class:text-green-700={(data.summary.totalRealizedPnl ?? 0) >= 0} class:text-red-700={(data.summary.totalRealizedPnl ?? 0) < 0}>{fmtCurrency(data.summary.totalRealizedPnl ?? 0)}</p>
</div>
<div class="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
<p class="text-xs font-medium text-amber-700 uppercase tracking-wide">Realized Gains/Loss from Closed Positions</p>
<p class="mt-1 text-xl font-bold" class:text-green-700={(data.totalRealizedGains ?? 0) >= 0} class:text-red-700={(data.totalRealizedGains ?? 0) < 0}>{fmtCurrency(data.totalRealizedGains ?? 0)}</p>
</div>
<div class="rounded-xl border border-orange-200 bg-orange-50 p-4 shadow-sm">
<p class="text-xs font-medium text-orange-700 uppercase tracking-wide">Total Realized Gains</p>
<p class="mt-1 text-xl font-bold" class:text-green-700={((data.summary.totalRealizedPnl ?? 0) + (data.totalRealizedGains ?? 0)) >= 0} class:text-red-700={((data.summary.totalRealizedPnl ?? 0) + (data.totalRealizedGains ?? 0)) < 0}>{fmtCurrency((data.summary.totalRealizedPnl ?? 0) + (data.totalRealizedGains ?? 0))}</p>
</div>
<div class="rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
<p class="text-xs font-medium text-emerald-700 uppercase tracking-wide">Open Dividends</p>
<p class="mt-1 text-xl font-bold text-emerald-700">{fmtCurrency(data.summary.totalDividends)}</p>
</div>
<div class="rounded-xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
<p class="text-xs font-medium text-blue-700 uppercase tracking-wide">Closed Dividends</p>
<p class="mt-1 text-xl font-bold text-blue-700">{fmtCurrency(data.closedDividends ?? 0)}</p>
</div>
<div class="rounded-xl border border-violet-200 bg-violet-50 p-4 shadow-sm">
<p class="text-xs font-medium text-violet-700 uppercase tracking-wide">Total Dividends</p>
<p class="mt-1 text-xl font-bold text-violet-700">{fmtCurrency(data.summary.totalDividends + (data.closedDividends ?? 0))}</p>
</div>
</div>

<!-- Chart -->
{#if data.summary.items.length > 0}
<PortfolioChart items={data.summary.items} />
{/if}

<!-- Table header -->
<div class="flex items-center justify-between">
<h2 class="text-lg font-semibold text-slate-800">Holdings</h2>
<div class="flex gap-2">
	<button
	onclick={openAdd}
	class="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
	>
	<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
		<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
	</svg>
	Add Transaction
	</button>
	<button
	onclick={fetchCurrentPrices}
	disabled={fetchingPrices}
	class="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
	title="Fetch current prices from Yahoo Finance"
	>
	<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
		<path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
	</svg>
	{#if fetchingPrices}
		Fetching...
	{:else}
		Fetch Prices
	{/if}
	</button>
</div>
</div>

<!-- Stock table -->
{#if data.summary.items.length === 0}
<div class="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
<p class="text-slate-500">No holdings yet. Add a transaction to get started.</p>
</div>
{:else}
<div class="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
<table class="min-w-full text-sm">
<thead>
<tr class="border-b border-slate-200 bg-slate-50">
<th class="px-4 py-3 text-left font-semibold text-slate-600">Ticker</th>
<th class="px-4 py-3 text-right font-semibold text-slate-600">Shares</th>
<th class="px-4 py-3 text-right font-semibold text-slate-600">Avg Cost</th>
<th class="px-4 py-3 text-right font-semibold text-slate-600">Current Price</th>
<th class="px-4 py-3 text-right font-semibold text-slate-600">Market Value</th>
<th class="px-4 py-3 text-right font-semibold text-slate-600">P&amp;L $</th>
<th class="px-4 py-3 text-right font-semibold text-slate-600">P&amp;L %</th>
<th class="px-4 py-3 text-right font-semibold text-slate-600">Realized P/L</th>
<th class="px-4 py-3 text-right font-semibold text-slate-600">IRR</th>
<th class="px-4 py-3 text-right font-semibold text-slate-600">Dividends</th>
<th class="px-4 py-3 text-right font-semibold text-slate-600">Actions</th>
</tr>
</thead>
<tbody class="divide-y divide-slate-100">
{#each data.summary.items as item (item.ticker)}
<tr
class="cursor-pointer hover:bg-slate-50 transition-colors"
onclick={() => openHistory(item)}
>
<td class="px-4 py-3">
<div class="font-bold text-slate-800">{item.ticker}</div>
{#if item.name}
<div class="text-xs text-slate-400">{item.name}</div>
{/if}
</td>
<td class="px-4 py-3 text-right text-slate-700">{item.shares.toFixed(4)}</td>
<td class="px-4 py-3 text-right text-slate-700">{fmtCurrency(item.avgCost)}</td>
<td class="px-4 py-3 text-right">
<div class="flex items-center justify-end gap-2">
	<button
		class="text-slate-700 hover:text-indigo-600 hover:underline"
		onclick={(e) => { e.stopPropagation(); updatePrice(item.ticker, item.currentPrice); }}
		title="Click to update price"
	>
		{fmtCurrency(item.currentPrice)}
	</button>
	{#if stalePrices.has(item.ticker)}
		<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-label="Price could not be fetched">
			<path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
		</svg>
	{/if}
</div>
</td>
<td class="px-4 py-3 text-right text-slate-700">{fmtCurrency(item.marketValue)}</td>
<td class="px-4 py-3 text-right font-medium" class:text-green-600={item.pnl >= 0} class:text-red-600={item.pnl < 0}>
{fmtCurrency(item.pnl)}
</td>
<td class="px-4 py-3 text-right font-medium" class:text-green-600={item.pnlPct >= 0} class:text-red-600={item.pnlPct < 0}>
{fmtPct(item.pnlPct)}
</td>
<td class="px-4 py-3 text-right font-medium" class:text-green-600={item.realizedPnl >= 0} class:text-red-600={item.realizedPnl < 0}>
{item.realizedPnl !== 0 ? fmtCurrency(item.realizedPnl) : '—'}
</td>
<td class="px-4 py-3 text-right text-slate-700">{fmtIrr(item.irr)}</td>
<td class="px-4 py-3 text-right font-medium">
{#if item.totalDividends > 0}
<span class="text-emerald-600">{fmtCurrency(item.totalDividends)}</span>
{:else}
<span class="text-slate-300">—</span>
{/if}
</td>
<td class="px-4 py-3 text-right">
<div class="flex items-center justify-end gap-3">
<button
class="text-xs text-indigo-600 hover:underline"
onclick={(e) => { e.stopPropagation(); openHistory(item); }}
>
History
</button>
<button
class="text-xs font-medium text-emerald-600 hover:underline"
onclick={(e) => { e.stopPropagation(); openDividend(item); }}
title="Add dividend for {item.ticker}"
>
Dividend
</button>
<button
class="text-xs font-medium text-red-600 hover:underline"
onclick={(e) => { e.stopPropagation(); openSell(item); }}
title="Sell shares of {item.ticker}"
>
Sell
</button>
<button
class="text-xs text-slate-400 hover:text-red-500 hover:underline"
onclick={(e) => { e.stopPropagation(); deleteItem = item; }}
title="Delete {item.ticker} and all its transactions"
>
Delete
</button>
</div>
</td>
</tr>
{/each}
</tbody>
</table>
</div>
{/if}
</div>

<!-- Add/Edit Transaction Modal -->
<AddTransactionModal
open={showAddModal}
{editTransaction}
onclose={async (saved) => {
showAddModal = false;
editTransaction = null;
if (saved) await invalidateAll();
}}
/>

<!-- Transaction History Modal -->
{#if historyItem}
<TransactionHistoryModal
open={historyTicker !== null}
ticker={historyItem.ticker}
stockName={historyItem.name}
currentPrice={historyItem.currentPrice}
currentShares={historyItem.shares}
stockCurrency={historyItem.currency}
onclose={() => { historyTicker = null; historyItem = null; }}
onedit={(tx) => handleEdit(tx)}
ondelete={async (id) => { await handleDeleteTransaction(id); }}
/>
{/if}

<!-- Delete Stock Confirmation Modal -->
<DeleteStockModal
open={deleteItem !== null}
ticker={deleteItem?.ticker ?? ''}
transactionCount={deleteItem?.transactions?.length ?? 0}
onconfirm={confirmDeleteStock}
oncancel={() => deleteItem = null}
/>

<!-- Sell Modal -->
{#if sellItem}
<SellModal
	open={sellItem !== null}
	ticker={sellItem.ticker}
	transactions={sellItem.transactions}
	totalShares={sellItem.shares}
	currentPrice={sellItem.currentPrice}
	onclose={async (saved) => {
		sellItem = null;
		if (saved) await invalidateAll();
	}}
/>
{/if}

<!-- Add Dividend Modal -->
{#if dividendItem}
<AddDividendModal
	open={dividendItem !== null}
	ticker={dividendItem.ticker}
	currency={dividendItem.currency}
	currentShares={dividendItem.shares}
	editDividend={null}
	onclose={async (saved) => {
		dividendItem = null;
		if (saved) await invalidateAll();
	}}
/>
{/if}

<!-- Fetching Prices Progress Modal -->
{#if fetchingPrices && fetchingTicker}
<div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
	<div class="rounded-xl bg-white p-6 shadow-2xl max-w-md">
		<div class="flex items-center gap-3 mb-4">
			<div class="relative h-5 w-5">
				<div class="absolute inset-0 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-600"></div>
			</div>
			<h3 class="font-semibold text-slate-800">Fetching Prices</h3>
		</div>
		<div class="space-y-2">
			<p class="text-sm text-slate-600">
				Currently fetching: <span class="font-mono font-semibold text-emerald-600">{fetchingTicker}</span>
			</p>
			<div class="rounded-lg bg-slate-50 p-3 text-xs font-mono text-slate-600 max-h-24 overflow-y-auto">
				<div>Attempting .BK suffix first...</div>
			</div>
		</div>
	</div>
</div>
{/if}
