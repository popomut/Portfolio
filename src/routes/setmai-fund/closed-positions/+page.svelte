<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function formatCurrency(value: number, currency: string): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: currency,
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		}).format(value);
	}

	function formatPercent(value: number): string {
		return (value >= 0 ? '+' : '') + value.toFixed(2) + '%';
	}

	function formatDate(dateStr: string): string {
		const [year, month, day] = dateStr.split('-');
		return `${day}/${month}/${year}`;
	}

	function fmtIrr(v: number | null): string {
		if (v === null) return '—';
		return (v * 100).toFixed(1) + '%';
	}

	const defaultCurrency = $derived(data.closedPositions[0]?.currency || 'THB');
	const totalCostBasis = $derived(data.closedPositions.reduce((sum, p) => sum + p.totalCostBasis, 0));
	const totalDividendsSum = $derived(data.closedPositions.reduce((sum, p) => sum + p.totalDividends, 0));
	const totalRealizedGains = $derived(data.closedPositions.reduce((sum, p) => sum + p.realizedGain, 0));
</script>

<div class="min-h-screen bg-slate-50 p-6">
	<div class="max-w-6xl mx-auto">
		<div class="mb-6 flex items-center justify-between">
			<div>
				<h1 class="text-3xl font-bold text-slate-900">SETMAI Closed Positions</h1>
				<p class="mt-1 text-slate-600">SETMAI Fund positions that have been fully exited</p>
			</div>
			<a
				href="/setmai-fund"
				class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
			>
				← Back to Fund
			</a>
		</div>

		{#if data.closedPositions.length === 0}
			<div class="bg-white rounded-lg border border-slate-200 p-8 text-center">
				<p class="text-slate-500">No closed SETMAI positions yet.</p>
				<p class="mt-1 text-xs text-slate-400">Once you fully sell out of a SETMAI ticker, it will appear here.</p>
			</div>
		{:else}
			<!-- Summary Section -->
			<div class="mb-8 grid grid-cols-1 md:grid-cols-4 gap-4">
				<div class="bg-white rounded-lg border border-slate-200 p-6">
					<p class="text-sm text-slate-600 font-medium mb-2">Closed Positions</p>
					<p class="text-2xl font-bold text-slate-900">{data.closedPositions.length}</p>
				</div>
				<div class="bg-white rounded-lg border border-slate-200 p-6">
					<p class="text-sm text-slate-600 font-medium mb-2">Total Cost Basis</p>
					<p class="text-2xl font-bold text-slate-900">{formatCurrency(totalCostBasis, defaultCurrency)}</p>
				</div>
				<div class="bg-white rounded-lg border border-slate-200 p-6">
					<p class="text-sm text-slate-600 font-medium mb-2">Total Dividends</p>
					<p class="text-2xl font-bold text-blue-700">{formatCurrency(totalDividendsSum, defaultCurrency)}</p>
				</div>
				<div class="bg-white rounded-lg border border-slate-200 p-6">
					<p class="text-sm text-slate-600 font-medium mb-2">Total Realized Gains</p>
					<p class="text-2xl font-bold {totalRealizedGains >= 0 ? 'text-green-700' : 'text-red-700'}">
						{formatCurrency(totalRealizedGains, defaultCurrency)}
					</p>
				</div>
			</div>

			<div class="overflow-x-auto bg-white rounded-lg border border-slate-200 shadow-sm">
				<table class="w-full divide-y divide-slate-200">
					<thead class="bg-slate-50">
						<tr>
							<th class="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">Ticker</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">Cost Basis</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">Dividends</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">Realized Gain/Loss</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">Return %</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">Return % (incl. Div)</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">IRR (annualised)</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">Exit Date</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-200">
						{#each data.closedPositions as position (position.ticker)}
							<tr class="hover:bg-slate-50 transition-colors">
								<td class="px-6 py-4 whitespace-nowrap">
									<div>
										<div class="text-sm font-semibold text-slate-900">{position.ticker}</div>
										<div class="text-xs text-slate-500">{position.name}</div>
									</div>
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
									{formatCurrency(position.totalCostBasis, position.currency)}
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm">
									<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
										{formatCurrency(position.totalDividends, position.currency)}
									</span>
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm font-semibold">
									<span class={position.realizedGain >= 0 ? 'text-green-700' : 'text-red-700'}>
										{formatCurrency(position.realizedGain, position.currency)}
									</span>
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm font-semibold">
									<span
										class={position.realizedGainPct >= 0
											? 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800'
											: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800'}
									>
										{formatPercent(position.realizedGainPct)}
									</span>
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm font-semibold">
									<span
										class={position.totalReturnPct >= 0
											? 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700'
											: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700'}
									>
										{formatPercent(position.totalReturnPct)}
									</span>
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm font-semibold">
									{#if position.irr !== null}
										<span
											class={position.irr >= 0
												? 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800'
												: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800'}
										>
											{fmtIrr(position.irr)}
										</span>
									{:else}
										<span class="text-slate-400">—</span>
									{/if}
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
									{formatDate(position.exitDate)}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>
</div>
