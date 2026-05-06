<script lang="ts">
	import type { PageData } from './$types';

	let { data } = $props();
	const { transactions, dividends } = data;

	let mode = $state<'transactions' | 'dividends'>('transactions');
</script>

<div class="space-y-6">
	<!-- Header -->
	<div>
		<h1 class="text-3xl font-bold text-slate-900">Imported Data</h1>
		<p class="mt-2 text-slate-600">View all imported transactions and dividends</p>
	</div>

	<!-- Mode Tabs -->
	<div class="flex gap-4 border-b border-slate-200">
		<button
			onclick={() => (mode = 'transactions')}
			class="px-4 py-2 font-medium transition-colors"
			class:text-indigo-600={mode === 'transactions'}
			class:border-b-2={mode === 'transactions'}
			class:border-indigo-600={mode === 'transactions'}
			class:text-slate-600={mode !== 'transactions'}
		>
			Transactions ({transactions.length})
		</button>
		<button
			onclick={() => (mode = 'dividends')}
			class="px-4 py-2 font-medium transition-colors"
			class:text-indigo-600={mode === 'dividends'}
			class:border-b-2={mode === 'dividends'}
			class:border-indigo-600={mode === 'dividends'}
			class:text-slate-600={mode !== 'dividends'}
		>
			Dividends ({dividends.length})
		</button>
	</div>

	<!-- Transactions Table -->
	{#if mode === 'transactions'}
		<div class="overflow-x-auto rounded-lg border border-slate-200 bg-white">
			{#if transactions.length === 0}
				<div class="p-8 text-center text-slate-500">No transactions imported yet</div>
			{:else}
				<table class="w-full text-sm">
					<thead class="border-b border-slate-200 bg-slate-50">
						<tr>
							<th class="px-4 py-3 text-left font-medium text-slate-900">Date</th>
							<th class="px-4 py-3 text-left font-medium text-slate-900">Ticker</th>
							<th class="px-4 py-3 text-left font-medium text-slate-900">Type</th>
							<th class="px-4 py-3 text-right font-medium text-slate-900">Shares</th>
							<th class="px-4 py-3 text-right font-medium text-slate-900">Price/Share</th>
							<th class="px-4 py-3 text-right font-medium text-slate-900">Fees</th>
							<th class="px-4 py-3 text-left font-medium text-slate-900">Notes</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-200">
						{#each transactions as txn (txn.id)}
							<tr class="hover:bg-slate-50">
								<td class="px-4 py-3 text-slate-900">{txn.date}</td>
								<td class="px-4 py-3 font-semibold text-slate-900">{txn.ticker}</td>
								<td class="px-4 py-3">
									<span
										class="inline-block rounded-full px-2 py-1 text-xs font-medium"
										class:bg-green-100={txn.type === 'buy'}
										class:text-green-800={txn.type === 'buy'}
										class:bg-red-100={txn.type === 'sell'}
										class:text-red-800={txn.type === 'sell'}
									>
										{txn.type.charAt(0).toUpperCase() + txn.type.slice(1)}
									</span>
								</td>
								<td class="px-4 py-3 text-right text-slate-900">{txn.shares.toLocaleString()}</td>
								<td class="px-4 py-3 text-right text-slate-900">${txn.pricePerShare.toFixed(2)}</td>
								<td class="px-4 py-3 text-right text-slate-900">${txn.fees.toFixed(2)}</td>
								<td class="px-4 py-3 text-slate-600">{txn.notes || '—'}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		</div>
	{/if}

	<!-- Dividends Table -->
	{#if mode === 'dividends'}
		<div class="overflow-x-auto rounded-lg border border-slate-200 bg-white">
			{#if dividends.length === 0}
				<div class="p-8 text-center text-slate-500">No dividends imported yet</div>
			{:else}
				<table class="w-full text-sm">
					<thead class="border-b border-slate-200 bg-slate-50">
						<tr>
							<th class="px-4 py-3 text-left font-medium text-slate-900">Ex-Date</th>
							<th class="px-4 py-3 text-left font-medium text-slate-900">Ticker</th>
							<th class="px-4 py-3 text-left font-medium text-slate-900">Pay Date</th>
							<th class="px-4 py-3 text-right font-medium text-slate-900">Shares Held</th>
							<th class="px-4 py-3 text-right font-medium text-slate-900">Amount/Share</th>
							<th class="px-4 py-3 text-right font-medium text-slate-900">Total Amount</th>
							<th class="px-4 py-3 text-right font-medium text-slate-900">Tax</th>
							<th class="px-4 py-3 text-left font-medium text-slate-900">Notes</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-200">
						{#each dividends as div (div.id)}
							<tr class="hover:bg-slate-50">
								<td class="px-4 py-3 text-slate-900">{div.exDate}</td>
								<td class="px-4 py-3 font-semibold text-slate-900">{div.ticker}</td>
								<td class="px-4 py-3 text-slate-900">{div.payDate}</td>
								<td class="px-4 py-3 text-right text-slate-900">{div.sharesHeld.toLocaleString()}</td>
								<td class="px-4 py-3 text-right text-slate-900">${div.amountPerShare.toFixed(2)}</td>
								<td class="px-4 py-3 text-right font-medium text-slate-900">
									${div.totalAmount.toFixed(2)}
								</td>
								<td class="px-4 py-3 text-right text-slate-900">${div.withholdingTax.toFixed(2)}</td>
								<td class="px-4 py-3 text-slate-600">{div.notes || '—'}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		</div>
	{/if}
</div>
