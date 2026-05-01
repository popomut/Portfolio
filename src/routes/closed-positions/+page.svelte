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
</script>

<div class="min-h-screen bg-slate-50 p-6">
	<div class="max-w-6xl mx-auto">
		<h1 class="text-3xl font-bold text-slate-900 mb-2">Closed Positions</h1>
		<p class="text-slate-600 mb-6">Historical positions that have been fully exited</p>

		{#if data.closedPositions.length === 0}
			<div class="bg-white rounded-lg border border-slate-200 p-8 text-center">
				<p class="text-slate-500">No closed positions yet</p>
			</div>
		{:else}
			<div class="overflow-x-auto bg-white rounded-lg border border-slate-200 shadow-sm">
				<table class="w-full divide-y divide-slate-200">
					<thead class="bg-slate-50">
						<tr>
							<th class="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
								Ticker
							</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
								Cost Basis
							</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
								Dividends
							</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
								Realized Gain/Loss
							</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
								Return %
							</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
								Exit Date
							</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-200">
						{#each data.closedPositions as position (position.ticker)}
							<tr class="hover:bg-slate-50 transition-colors">
								<td class="px-6 py-4 whitespace-nowrap">
									<div class="flex items-center">
										<div>
											<div class="text-sm font-semibold text-slate-900">{position.ticker}</div>
											<div class="text-xs text-slate-500">{position.name}</div>
										</div>
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
									<span
										class={position.realizedGain >= 0
											? 'text-green-700'
											: 'text-red-700'}
									>
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
								<td class="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
									{formatDate(position.exitDate)}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<!-- Summary Section -->
			<div class="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
				<div class="bg-white rounded-lg border border-slate-200 p-6">
					<p class="text-sm text-slate-600 font-medium mb-2">Total Closed Positions</p>
					<p class="text-2xl font-bold text-slate-900">{data.closedPositions.length}</p>
				</div>
				<div class="bg-white rounded-lg border border-slate-200 p-6">
					<p class="text-sm text-slate-600 font-medium mb-2">Total Cost Basis</p>
					<p class="text-2xl font-bold text-slate-900">
						{formatCurrency(
							data.closedPositions.reduce((sum, p) => sum + p.totalCostBasis, 0),
							data.closedPositions[0]?.currency || 'USD'
						)}
					</p>
				</div>
				<div class="bg-white rounded-lg border border-slate-200 p-6">
					<p class="text-sm text-slate-600 font-medium mb-2">Total Dividends</p>
					<p class="text-2xl font-bold text-blue-700">
						{formatCurrency(
							data.closedPositions.reduce((sum, p) => sum + p.totalDividends, 0),
							data.closedPositions[0]?.currency || 'USD'
						)}
					</p>
				</div>
				{#if data.closedPositions.length > 0}
					{@const totalGains = data.closedPositions.reduce((sum, p) => sum + p.realizedGain, 0)}
					<div class="bg-white rounded-lg border border-slate-200 p-6">
						<p class="text-sm text-slate-600 font-medium mb-2">Total Realized Gains</p>
						<p class="text-2xl font-bold {totalGains >= 0 ? 'text-green-700' : 'text-red-700'}">
							{formatCurrency(
								totalGains,
								data.closedPositions[0]?.currency || 'USD'
							)}
						</p>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>
