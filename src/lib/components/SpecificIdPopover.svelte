<script lang="ts">
	import type { SpecificIdBreakdown } from '$lib/utils/specific-id-pnl';

	let {
		breakdown,
		currency,
		onclose
	}: {
		breakdown: SpecificIdBreakdown;
		currency: string;
		onclose: () => void;
	} = $props();

	function fmt(v: number): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency,
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		}).format(v);
	}

	function fmtShares(v: number): string {
		return v.toLocaleString('en-US', { maximumFractionDigits: 4 });
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
	}

	let openLots = $derived(breakdown.lotDetails.filter((l) => l.remainingShares > 0.00001));
	let closedSells = $derived(breakdown.sellDetails);
</script>

<svelte:window on:keydown={handleKeydown} />

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
	role="dialog"
	aria-modal="true"
	aria-labelledby="specific-id-title"
	class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4"
>
	<!-- Backdrop: click to close -->
	<div
		class="fixed inset-0 bg-black/50 backdrop-blur-sm"
		onclick={onclose}
		role="presentation"
	></div>

	<!-- Card -->
	<div class="relative z-10 w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
		<div class="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
			<div>
				<h4 id="specific-id-title" class="text-base font-bold text-slate-800">
					Specific-ID P&amp;L — {breakdown.ticker}
				</h4>
				<p class="text-[11px] uppercase tracking-wide text-slate-400">Lot-matched view</p>
			</div>
			<button
				onclick={onclose}
				class="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
				aria-label="Close"
			>
				<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>

		<div class="mb-4 grid grid-cols-3 gap-3 text-sm">
			<div class="rounded-lg bg-slate-50 p-3">
				<p class="text-[10px] uppercase tracking-wide text-slate-500">Realized</p>
				<p class="mt-1 font-bold" class:text-green-600={breakdown.realizedPnl >= 0} class:text-red-600={breakdown.realizedPnl < 0}>
					{fmt(breakdown.realizedPnl)}
				</p>
			</div>
			<div class="rounded-lg bg-slate-50 p-3">
				<p class="text-[10px] uppercase tracking-wide text-slate-500">Unrealized</p>
				<p class="mt-1 font-bold" class:text-green-600={breakdown.unrealizedPnl >= 0} class:text-red-600={breakdown.unrealizedPnl < 0}>
					{fmt(breakdown.unrealizedPnl)}
				</p>
			</div>
			<div class="rounded-lg bg-indigo-50 p-3">
				<p class="text-[10px] uppercase tracking-wide text-indigo-600">Total</p>
				<p class="mt-1 font-bold" class:text-green-700={breakdown.totalPnl >= 0} class:text-red-700={breakdown.totalPnl < 0}>
					{fmt(breakdown.totalPnl)}
				</p>
			</div>
		</div>

		{#if closedSells.length > 0}
			<div class="mb-4">
				<p class="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Sells (specific-lot matched)</p>
				<div class="max-h-56 overflow-y-auto rounded-lg border border-slate-100">
					<table class="w-full text-xs">
						<thead class="bg-slate-50">
							<tr>
								<th class="px-3 py-2 text-left font-medium text-slate-500">Sell date</th>
								<th class="px-3 py-2 text-right font-medium text-slate-500">Shares</th>
								<th class="px-3 py-2 text-right font-medium text-slate-500">Price</th>
								<th class="px-3 py-2 text-right font-medium text-slate-500">P&amp;L</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-slate-100">
							{#each closedSells as s (s.sellTxnId)}
								<tr>
									<td class="px-3 py-2 text-slate-700">{s.sellDate}</td>
									<td class="px-3 py-2 text-right text-slate-600">{fmtShares(s.sharesSold)}</td>
									<td class="px-3 py-2 text-right text-slate-600">{fmt(s.sellPrice)}</td>
									<td class="px-3 py-2 text-right font-semibold" class:text-green-600={s.realizedPnl >= 0} class:text-red-600={s.realizedPnl < 0}>
										{s.realizedPnl >= 0 ? '+' : ''}{fmt(s.realizedPnl)}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/if}

		{#if openLots.length > 0}
			<div>
				<p class="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Open lots</p>
				<div class="max-h-56 overflow-y-auto rounded-lg border border-slate-100">
					<table class="w-full text-xs">
						<thead class="bg-slate-50">
							<tr>
								<th class="px-3 py-2 text-left font-medium text-slate-500">Buy date</th>
								<th class="px-3 py-2 text-right font-medium text-slate-500">Rem. shares</th>
								<th class="px-3 py-2 text-right font-medium text-slate-500">Buy price</th>
								<th class="px-3 py-2 text-right font-medium text-slate-500">Unrealized</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-slate-100">
							{#each openLots as l (l.buyTxnId)}
								<tr>
									<td class="px-3 py-2 text-slate-700">{l.buyDate}</td>
									<td class="px-3 py-2 text-right text-slate-600">{fmtShares(l.remainingShares)}</td>
									<td class="px-3 py-2 text-right text-slate-600">{fmt(l.buyPrice)}</td>
									<td class="px-3 py-2 text-right font-semibold" class:text-green-600={l.unrealizedPnl >= 0} class:text-red-600={l.unrealizedPnl < 0}>
										{l.unrealizedPnl >= 0 ? '+' : ''}{fmt(l.unrealizedPnl)}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/if}

		<p class="mt-4 text-[10px] italic text-slate-400">
			Sells without a recorded lot match fall back to FIFO. Portfolio table columns keep using the original average-cost method.
		</p>
	</div>
</div>
