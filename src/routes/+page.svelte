<script lang="ts">
import { invalidateAll } from '$app/navigation';
import AddTransactionModal from '$lib/components/AddTransactionModal.svelte';
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
</script>

<div class="space-y-6">
<!-- Summary bar -->
<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
<div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
<p class="text-xs font-medium text-slate-500 uppercase tracking-wide">Market Value</p>
<p class="mt-1 text-xl font-bold text-slate-800">{fmtCurrency(data.summary.totalMarketValue)}</p>
</div>
<div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
<p class="text-xs font-medium text-slate-500 uppercase tracking-wide">Cost Basis</p>
<p class="mt-1 text-xl font-bold text-slate-800">{fmtCurrency(data.summary.totalCostBasis)}</p>
</div>
<div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
<p class="text-xs font-medium text-slate-500 uppercase tracking-wide">Total P&amp;L</p>
<p class="mt-1 text-xl font-bold" class:text-green-600={data.summary.totalPnl >= 0} class:text-red-600={data.summary.totalPnl < 0}>
{fmtCurrency(data.summary.totalPnl)} ({fmtPct(data.summary.totalPnlPct)})
</p>
</div>
<div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
<p class="text-xs font-medium text-slate-500 uppercase tracking-wide">Positions</p>
<p class="mt-1 text-xl font-bold text-slate-800">{data.summary.items.length}</p>
</div>
</div>

<!-- Chart -->
{#if data.summary.items.length > 0}
<PortfolioChart items={data.summary.items} />
{/if}

<!-- Table header -->
<div class="flex items-center justify-between">
<h2 class="text-lg font-semibold text-slate-800">Holdings</h2>
<button
onclick={openAdd}
class="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
>
<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
</svg>
Add Transaction
</button>
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
<th class="px-4 py-3 text-right font-semibold text-slate-600">IRR</th>
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
<button
class="text-slate-700 hover:text-indigo-600 hover:underline"
onclick={(e) => { e.stopPropagation(); updatePrice(item.ticker, item.currentPrice); }}
title="Click to update price"
>
{fmtCurrency(item.currentPrice)}
</button>
</td>
<td class="px-4 py-3 text-right text-slate-700">{fmtCurrency(item.marketValue)}</td>
<td class="px-4 py-3 text-right font-medium" class:text-green-600={item.pnl >= 0} class:text-red-600={item.pnl < 0}>
{fmtCurrency(item.pnl)}
</td>
<td class="px-4 py-3 text-right font-medium" class:text-green-600={item.pnlPct >= 0} class:text-red-600={item.pnlPct < 0}>
{fmtPct(item.pnlPct)}
</td>
<td class="px-4 py-3 text-right text-slate-700">{fmtIrr(item.irr)}</td>
<td class="px-4 py-3 text-right">
<div class="flex items-center justify-end gap-3">
<button
class="text-xs text-indigo-600 hover:underline"
onclick={(e) => { e.stopPropagation(); openHistory(item); }}
>
History
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
