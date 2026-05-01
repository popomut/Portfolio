<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { Chart as ChartType } from 'chart.js';
	import type { PortfolioItem } from '$lib/utils/portfolio';

	let { items }: { items: PortfolioItem[] } = $props();

	// ── Colour palette ────────────────────────────────────────────────
	const PALETTE = [
		'#6366f1','#06b6d4','#10b981','#f59e0b','#ef4444',
		'#8b5cf6','#ec4899','#14b8a6','#f97316','#84cc16',
		'#3b82f6','#a855f7','#e11d48','#0891b2','#059669',
	];

	function color(i: number, alpha = 1) {
		const hex = PALETTE[i % PALETTE.length];
		if (alpha === 1) return hex;
		const r = parseInt(hex.slice(1, 3), 16);
		const g = parseInt(hex.slice(3, 5), 16);
		const b = parseInt(hex.slice(5, 7), 16);
		return `rgba(${r},${g},${b},${alpha})`;
	}

	let activeTab = $state<'donut' | 'bar'>('donut');

	// Canvas refs
	let donutCanvas = $state<HTMLCanvasElement | null>(null);
	let barCanvas   = $state<HTMLCanvasElement | null>(null);

	let donutChart: ChartType | null = null;
	let barChart:   ChartType | null = null;

	const totalValue = $derived(items.reduce((s, i) => s + i.marketValue, 0));
	
	// Dynamic chart height based on number of items
	// Bar chart needs ~35px per row, donut needs minimum 300px
	const chartHeight = $derived(activeTab === 'bar' 
		? Math.max(300, items.length * 35) 
		: 300);

	function fmtCcy(v: number) {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
	}

	async function buildCharts() {
		const { Chart, ArcElement, DoughnutController, BarElement, BarController,
			CategoryScale, LinearScale, Tooltip, Legend } = await import('chart.js');

		Chart.register(ArcElement, DoughnutController, BarElement, BarController,
			CategoryScale, LinearScale, Tooltip, Legend);

		const labels  = items.map((i) => i.ticker);
		const values  = items.map((i) => i.marketValue);
		const pcts    = items.map((i) => totalValue > 0 ? (i.marketValue / totalValue) * 100 : 0);
		const bgColors = items.map((_, idx) => color(idx));
		const bgFaded  = items.map((_, idx) => color(idx, 0.75));

		// Donut - only build if active tab is donut
		if (activeTab === 'donut' && donutCanvas) {
			donutChart?.destroy();
			donutChart = new Chart(donutCanvas, {
				type: 'doughnut',
				data: {
					labels,
					datasets: [{
						data: values,
						backgroundColor: bgColors,
						borderColor: '#fff',
						borderWidth: 3,
						hoverOffset: 8,
					}]
				},
				options: {
					cutout: '62%',
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						legend: { display: false },
						tooltip: {
							callbacks: {
								label: (ctx) => {
									const pct = pcts[ctx.dataIndex].toFixed(1);
									return `  ${fmtCcy(ctx.parsed)} (${pct}%)`;
								}
							}
						}
					}
				}
			}) as ChartType;
		}

		// Horizontal grouped bar — market value vs cost basis - only build if active tab is bar
		if (activeTab === 'bar' && barCanvas) {
			const costs = items.map((i) => i.costBasis);
			barChart?.destroy();
			barChart = new Chart(barCanvas, {
				type: 'bar',
				data: {
					labels,
					datasets: [
						{
							label: 'Market Value',
							data: values,
							backgroundColor: bgFaded,
							borderColor: bgColors,
							borderWidth: 2,
							borderRadius: 6,
						},
						{
							label: 'Cost Basis',
							data: costs,
							backgroundColor: 'rgba(148,163,184,0.35)',
							borderColor: 'rgba(100,116,139,0.8)',
							borderWidth: 2,
							borderRadius: 6,
						}
					]
				},
				options: {
					indexAxis: 'y',
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						legend: {
							display: true,
							position: 'top',
							labels: {
								boxWidth: 12,
								boxHeight: 12,
								borderRadius: 3,
								useBorderRadius: true,
								padding: 16,
								color: '#475569',
								font: { size: 12 }
							}
						},
						tooltip: {
							callbacks: {
								label: (ctx) => {
									const val = ctx.parsed.x;
									const isMarket = ctx.datasetIndex === 0;
									if (isMarket) {
										const pct = pcts[ctx.dataIndex].toFixed(1);
										return `  Market Value: ${fmtCcy(val)} (${pct}%)`;
									}
									const mv = values[ctx.dataIndex];
									const pnl = mv - val;
									const sign = pnl >= 0 ? '+' : '';
									return `  Cost Basis: ${fmtCcy(val)}  (P&L ${sign}${fmtCcy(pnl)})`;
								}
							}
						}
					},
					scales: {
						x: {
							grid: { color: '#f1f5f9' },
							ticks: {
								color: '#94a3b8',
								callback: (v) => fmtCcy(Number(v))
							}
						},
						y: {
							grid: { display: false },
							ticks: { color: '#475569', font: { weight: 'bold' } }
						}
					}
				}
			}) as ChartType;
		}
	}

	// Rebuild whenever items or active tab changes
	$effect(() => {
		// track dependencies
		const _ = items;
		const tab = activeTab;
		// Delay to let canvas mount and become visible
		const timer = setTimeout(buildCharts, 10);
		return () => clearTimeout(timer);
	});

	onDestroy(() => {
		donutChart?.destroy();
		barChart?.destroy();
	});
</script>

<div class="rounded-xl border border-slate-200 bg-white shadow-sm">
	<!-- Card header -->
	<div class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
		<h2 class="text-base font-semibold text-slate-800">Portfolio Allocation</h2>
		<!-- Tab toggle -->
		<div class="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-medium">
			<button
				onclick={() => (activeTab = 'donut')}
				class="rounded-md px-3 py-1 transition-colors"
				class:bg-white={activeTab === 'donut'}
				class:text-indigo-600={activeTab === 'donut'}
				class:shadow-sm={activeTab === 'donut'}
				class:text-slate-500={activeTab !== 'donut'}
			>
				Donut
			</button>
			<button
				onclick={() => (activeTab = 'bar')}
				class="rounded-md px-3 py-1 transition-colors"
				class:bg-white={activeTab === 'bar'}
				class:text-indigo-600={activeTab === 'bar'}
				class:shadow-sm={activeTab === 'bar'}
				class:text-slate-500={activeTab !== 'bar'}
			>
				Bar
			</button>
		</div>
	</div>

	<div class="p-5">
		{#if items.length === 0}
			<p class="py-8 text-center text-sm text-slate-400">No holdings to chart.</p>
		{:else}
			<div class="flex flex-col gap-6 lg:flex-row lg:items-start">

				<!-- Chart area -->
				<div class="relative flex-1" style="height:{chartHeight}px">
					<!-- Donut canvas -->
					<canvas
						bind:this={donutCanvas}
						class="absolute inset-0 h-full w-full"
						style="display:{activeTab === 'donut' ? 'block' : 'none'}"
					></canvas>
					<!-- Bar canvas -->
					<canvas
						bind:this={barCanvas}
						class="absolute inset-0 h-full w-full"
						style="display:{activeTab === 'bar' ? 'block' : 'none'}"
					></canvas>

					<!-- Donut centre label -->
					{#if activeTab === 'donut'}
						<div class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
							<p class="text-xs text-slate-400">Total</p>
							<p class="text-lg font-bold text-slate-800">{fmtCcy(totalValue)}</p>
						</div>
					{/if}
				</div>

				<!-- Legend / table -->
				<div class="w-full lg:w-72">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-slate-100">
								<th class="pb-2 text-left text-xs font-semibold text-slate-400">Stock</th>
								<th class="pb-2 text-right text-xs font-semibold text-slate-400">Mkt Value</th>
								{#if activeTab === 'bar'}
									<th class="pb-2 text-right text-xs font-semibold text-slate-400">Cost</th>
									<th class="pb-2 text-right text-xs font-semibold text-slate-400">P&amp;L</th>
								{:else}
									<th class="pb-2 text-right text-xs font-semibold text-slate-400">%</th>
								{/if}
							</tr>
						</thead>
						<tbody class="divide-y divide-slate-50">
							{#each items as item, idx}
								{@const pct = totalValue > 0 ? (item.marketValue / totalValue) * 100 : 0}
								{@const pnl = item.marketValue - item.costBasis}
								<tr class="group">
									<td class="py-1.5">
										<div class="flex items-center gap-2">
											<span class="h-2.5 w-2.5 flex-shrink-0 rounded-full" style="background:{PALETTE[idx % PALETTE.length]}"></span>
											<span class="font-semibold text-slate-700">{item.ticker}</span>
										</div>
									</td>
									<td class="py-1.5 text-right text-slate-600">{fmtCcy(item.marketValue)}</td>
									{#if activeTab === 'bar'}
										<td class="py-1.5 text-right text-slate-500">{fmtCcy(item.costBasis)}</td>
										<td class="py-1.5 text-right font-semibold" class:text-green-600={pnl >= 0} class:text-red-600={pnl < 0}>
											{pnl >= 0 ? '+' : ''}{fmtCcy(pnl)}
										</td>
									{:else}
										<td class="py-1.5 text-right">
											<div class="flex items-center justify-end gap-1.5">
												<div class="h-1.5 w-12 overflow-hidden rounded-full bg-slate-100">
													<div class="h-full rounded-full" style="width:{pct}%;background:{PALETTE[idx % PALETTE.length]}"></div>
												</div>
												<span class="w-10 text-right text-xs text-slate-500">{pct.toFixed(1)}%</span>
											</div>
										</td>
									{/if}
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

			</div>
		{/if}
	</div>
</div>
