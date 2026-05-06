<script lang="ts">
	import type { PageData } from './$types';
	import { onMount, onDestroy } from 'svelte';
	import type { Chart } from 'chart.js';

	let { data }: { data: PageData } = $props();

	let yearlyCanvas = $state<HTMLCanvasElement | null>(null);
	let stockCanvas = $state<HTMLCanvasElement | null>(null);
	let yearlyByStockCanvas = $state<HTMLCanvasElement | null>(null);
	let monthlyCanvas = $state<HTMLCanvasElement | null>(null);
	let yearlyChart: Chart | null = null;
	let stockChart: Chart | null = null;
	let yearlyByStockChart: Chart | null = null;
	let monthlyChart: Chart | null = null;
	let selectedYear = $state<string>(data.yearlyByStock.length > 0 ? data.yearlyByStock[data.yearlyByStock.length - 1].year : '');
	let compareYear1 = $state<string>(data.yearly.length > 0 ? data.yearly[data.yearly.length - 1].year : '');
	let compareYear2 = $state<string>(data.yearly.length > 1 ? data.yearly[data.yearly.length - 2].year : '');
	let activeCount = $state(0);

	function fmtCurrency(v: number): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD',
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		}).format(v);
	}

	const PALETTE = [
		'#6366f1','#06b6d4','#10b981','#f59e0b','#ef4444',
		'#8b5cf6','#ec4899','#14b8a6','#f97316','#84cc16',
		'#3b82f6','#a855f7','#e11d48','#0891b2','#059669',
	];

	async function buildCharts() {
		const { Chart, ArcElement, DoughnutController, BarElement, BarController,
			CategoryScale, LinearScale, Tooltip, Legend, LineElement, LineController, PointElement } = await import('chart.js');

		Chart.register(ArcElement, DoughnutController, BarElement, BarController,
			CategoryScale, LinearScale, Tooltip, Legend, LineElement, LineController, PointElement);

		// Yearly bar chart
		if (yearlyCanvas) {
			yearlyChart?.destroy();
			const labels = data.yearly.map(y => y.year);
			const values = data.yearly.map(y => y.amount);
			const bgColors = labels.map((_, i) => PALETTE[i % PALETTE.length]);

			yearlyChart = new Chart(yearlyCanvas, {
				type: 'bar',
				data: {
					labels,
					datasets: [{
						label: 'Dividends',
						data: values,
						backgroundColor: bgColors.map(c => c + 'cc'),
						borderColor: bgColors,
						borderWidth: 2,
						borderRadius: 6,
					}]
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						legend: { display: false },
						tooltip: {
							callbacks: {
								label: (ctx) => `  ${fmtCurrency(ctx.parsed.y)}`
							}
						}
					},
					scales: {
						x: {
							grid: { display: false },
							ticks: { color: '#475569', font: { weight: 'bold' } }
						},
						y: {
							grid: { color: '#f1f5f9' },
							ticks: {
								color: '#94a3b8',
								callback: (v) => fmtCurrency(Number(v))
							}
						}
					}
				}
			});
		}

		// Stock donut chart
		if (stockCanvas) {
			stockChart?.destroy();
			const labels = data.byStock.map(s => s.ticker);
			const values = data.byStock.map(s => s.amount);
			const bgColors = labels.map((_, i) => PALETTE[i % PALETTE.length]);
			const total = values.reduce((a, b) => a + b, 0);

			stockChart = new Chart(stockCanvas, {
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
									const pct = total > 0 ? (ctx.parsed / total) * 100 : 0;
									return `  ${fmtCurrency(ctx.parsed)} (${pct.toFixed(1)}%)`;
								}
							}
						}
					}
				}
			});
		}

		// Year by stock bar chart
		if (yearlyByStockCanvas && selectedYear) {
			yearlyByStockChart?.destroy();
			const yearData = data.yearlyByStock.find(y => y.year === selectedYear);
			
			// Only include stocks that actually paid dividends this year
			const activeTickers = data.tickers.filter(t => (yearData?.[t] ?? 0) > 0);
			
			if (activeTickers.length === 0) return;
			
			activeCount = activeTickers.length;
			const stockAmounts = activeTickers.map(t => yearData?.[t] ?? 0);
			const bgColors = activeTickers.map((_, i) => PALETTE[i % PALETTE.length] + 'cc');
			const borderColors = activeTickers.map((_, i) => PALETTE[i % PALETTE.length]);

			yearlyByStockChart = new Chart(yearlyByStockCanvas, {
				type: 'bar',
				data: {
					labels: activeTickers,
					datasets: [{
						label: `${selectedYear} Dividends`,
						data: stockAmounts,
						backgroundColor: bgColors,
						borderColor: borderColors,
						borderWidth: 2,
						borderRadius: 6,
					}]
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						legend: { display: false },
						tooltip: {
							callbacks: {
								label: (ctx) => `  ${fmtCurrency(ctx.parsed.y)}`
							}
						}
					},
					scales: {
						x: {
							grid: { display: false },
							ticks: { color: '#475569', font: { weight: 'bold', size: 12 } }
						},
						y: {
							grid: { color: '#f1f5f9' },
							ticks: {
								color: '#94a3b8',
								callback: (v) => fmtCurrency(Number(v))
							}
						}
					}
				}
			});
		}

		// Monthly line chart comparison (cumulative)
		if (monthlyCanvas && compareYear1 && data.dividends.length > 0) {
			monthlyChart?.destroy();
			const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
			const datasets: any[] = [];

			function buildChartData(year: string): { amounts: number[]; stocks: string[][] } {
				const amounts = Array(12).fill(0);
				const stocks: string[][] = Array(12).fill(null).map(() => []);
				const seen = new Array(12).fill(null).map(() => new Set<string>());
				const cumStocks: string[][] = [];

				for (const d of data.dividends) {
					const dYear = d.exDate.substring(0, 4);
					if (dYear !== year) continue;
					const month = parseInt(d.exDate.substring(5, 7), 10) - 1;
					amounts[month] += d.totalAmount;
					seen[month].add(d.ticker);
				}

				let running = new Set<string>();
				for (let i = 0; i < 12; i++) {
					for (const s of seen[i]) running.add(s);
					cumStocks.push([...running]);
				}
				return { amounts, stocks: cumStocks };
			}

			function cumulative(arr: number[]): number[] {
				let sum = 0;
				return arr.map(v => { sum += v; return sum; });
			}

			const y1Data = buildChartData(compareYear1);
			const y1Cum = cumulative(y1Data.amounts);

			if (compareYear1 && y1Cum.some(v => v > 0)) {
				datasets.push({
					label: compareYear1,
					data: y1Cum,
					borderColor: '#6366f1',
					backgroundColor: 'rgba(99, 102, 241, 0.1)',
					tension: 0.3,
					fill: false,
					pointRadius: 4,
					pointHoverRadius: 6,
					borderWidth: 2,
					_stocks: y1Data.stocks,
				});
			}

			if (compareYear2) {
				const y2Data = buildChartData(compareYear2);
				const y2Cum = cumulative(y2Data.amounts);
				if (y2Cum.some(v => v > 0)) {
					datasets.push({
						label: compareYear2,
						data: y2Cum,
						borderColor: '#06b6d4',
						backgroundColor: 'rgba(6, 182, 212, 0.1)',
						tension: 0.3,
						fill: false,
						pointRadius: 4,
						pointHoverRadius: 6,
						borderWidth: 2,
						_stocks: y2Data.stocks,
					});
				}
			}

			if (datasets.length > 0) {
				monthlyChart = new Chart(monthlyCanvas, {
					type: 'line',
					data: { labels: months, datasets },
					options: {
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
									title: (items) => items[0].label,
									label: (ctx) => {
										const total = fmtCurrency(ctx.parsed.y);
										const stocks = (ctx.dataset as any)._stocks?.[ctx.dataIndex] ?? [];
										const stockLine = stocks.length > 0 ? `\n   Stocks: ${stocks.join(', ')}` : '';
										return `${ctx.dataset.label}: ${total}${stockLine}`;
									}
								}
							}
						},
						scales: {
							x: {
								grid: { display: false },
								ticks: { color: '#475569', font: { weight: 'bold' } }
							},
							y: {
								grid: { color: '#f1f5f9' },
								ticks: {
									color: '#94a3b8',
									callback: (v) => fmtCurrency(Number(v))
								}
							}
						}
					}
				});
			}
		}
	}

	$effect(() => {
		const _ = data;
		const _yr = selectedYear;
		const _y1 = compareYear1;
		const _y2 = compareYear2;
		const timer = setTimeout(buildCharts, 50);
		return () => clearTimeout(timer);
	});

	onDestroy(() => {
		yearlyChart?.destroy();
		stockChart?.destroy();
		yearlyByStockChart?.destroy();
		monthlyChart?.destroy();
	});
</script>

<div class="max-w-6xl mx-auto space-y-6">
	<div>
		<h1 class="text-3xl font-bold text-slate-900 mb-2">Dividends Detail</h1>
		<p class="text-slate-600">Breakdown of all dividend income</p>
	</div>

	<!-- Summary cards -->
	<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
		<div class="rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
			<p class="text-xs font-medium text-emerald-700 uppercase tracking-wide">Total Dividends</p>
			<p class="mt-1 text-xl font-bold text-emerald-700">{fmtCurrency(data.totalDividends)}</p>
		</div>
		<div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
			<p class="text-xs font-medium text-slate-500 uppercase tracking-wide">Stocks</p>
			<p class="mt-1 text-xl font-bold text-slate-800">{data.byStock.length}</p>
		</div>
		<div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
			<p class="text-xs font-medium text-slate-500 uppercase tracking-wide">Years</p>
			<p class="mt-1 text-xl font-bold text-slate-800">{data.yearly.length}</p>
		</div>
		<div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
			<p class="text-xs font-medium text-slate-500 uppercase tracking-wide">Payments</p>
			<p class="mt-1 text-xl font-bold text-slate-800">{data.dividends.length}</p>
		</div>
	</div>

	<!-- Yearly chart -->
	{#if data.yearly.length > 0}
		<div class="rounded-xl border border-slate-200 bg-white shadow-sm">
			<div class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
				<h2 class="text-base font-semibold text-slate-800">Dividends by Year</h2>
			</div>
			<div class="p-5">
				<div class="relative" style="height:320px">
					<canvas bind:this={yearlyCanvas} class="absolute inset-0 h-full w-full"></canvas>
				</div>
			</div>
		</div>
	{/if}

	<!-- Year by stock bar chart -->
	{#if data.yearlyByStock.length > 0 && data.tickers.length > 0}
		<div class="rounded-xl border border-slate-200 bg-white shadow-sm">
			<div class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
				<h2 class="text-base font-semibold text-slate-800">Dividends per Stock by Year</h2>
				<select
					bind:value={selectedYear}
					class="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
				>
					{#each data.yearlyByStock as item}
						<option value={item.year}>{item.year}</option>
					{/each}
				</select>
			</div>
			<div class="p-5">
				<div class="relative" style="height:{Math.max(300, activeCount * 45)}px">
					<canvas bind:this={yearlyByStockCanvas} class="absolute inset-0 h-full w-full"></canvas>
				</div>
			</div>
		</div>
	{/if}

	<!-- Monthly dividend comparison line chart -->
	{#if data.yearly.length > 0}
		<div class="rounded-xl border border-slate-200 bg-white shadow-sm">
			<div class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
				<h2 class="text-base font-semibold text-slate-800">Monthly Dividend Comparison</h2>
				<div class="flex items-center gap-3">
					<select
						bind:value={compareYear1}
						class="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
					>
						{#each data.yearly as item}
							<option value={item.year}>{item.year}</option>
						{/each}
					</select>
					<span class="text-sm text-slate-400">vs</span>
					<select
						bind:value={compareYear2}
						class="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
					>
						{#each data.yearly as item}
							<option value={item.year}>{item.year}</option>
						{/each}
					</select>
				</div>
			</div>
			<div class="p-5">
				<div class="relative" style="height:320px">
					<canvas bind:this={monthlyCanvas} class="absolute inset-0 h-full w-full"></canvas>
				</div>
			</div>
		</div>
	{/if}

	<!-- Stock breakdown chart + table -->
	{#if data.byStock.length > 0}
		<div class="rounded-xl border border-slate-200 bg-white shadow-sm">
			<div class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
				<h2 class="text-base font-semibold text-slate-800">Dividends by Stock</h2>
			</div>
			<div class="p-5">
				<div class="flex flex-col gap-6 lg:flex-row lg:items-start">
					<div class="relative flex-1" style="height:320px">
						<canvas bind:this={stockCanvas} class="absolute inset-0 h-full w-full"></canvas>
						<div class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
							<p class="text-xs text-slate-400">Total</p>
							<p class="text-lg font-bold text-slate-800">{fmtCurrency(data.totalDividends)}</p>
						</div>
					</div>
					<div class="w-full lg:w-72">
						<table class="w-full text-sm">
							<thead>
								<tr class="border-b border-slate-100">
									<th class="pb-2 text-left text-xs font-semibold text-slate-400">Stock</th>
									<th class="pb-2 text-right text-xs font-semibold text-slate-400">Dividends</th>
									<th class="pb-2 text-right text-xs font-semibold text-slate-400">%</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-slate-50">
								{#each data.byStock as item, idx}
									{@const pct = data.totalDividends > 0 ? (item.amount / data.totalDividends) * 100 : 0}
									<tr>
										<td class="py-1.5">
											<div class="flex items-center gap-2">
												<span class="h-2.5 w-2.5 flex-shrink-0 rounded-full" style="background:{PALETTE[idx % PALETTE.length]}"></span>
												<span class="font-semibold text-slate-700">{item.ticker}</span>
											</div>
										</td>
										<td class="py-1.5 text-right text-emerald-600 font-medium">{fmtCurrency(item.amount)}</td>
										<td class="py-1.5 text-right">
											<div class="flex items-center justify-end gap-1.5">
												<div class="h-1.5 w-12 overflow-hidden rounded-full bg-slate-100">
													<div class="h-full rounded-full" style="width:{pct}%;background:{PALETTE[idx % PALETTE.length]}"></div>
												</div>
												<span class="w-10 text-right text-xs text-slate-500">{pct.toFixed(1)}%</span>
											</div>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			</div>
		</div>
	{/if}

	<!-- All dividend payments table -->
	{#if data.dividends.length > 0}
		<div class="rounded-xl border border-slate-200 bg-white shadow-sm">
			<div class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
				<h2 class="text-base font-semibold text-slate-800">All Dividend Payments</h2>
			</div>
			<div class="overflow-x-auto">
				<table class="min-w-full text-sm">
					<thead>
						<tr class="border-b border-slate-200 bg-slate-50">
							<th class="px-4 py-3 text-left font-semibold text-slate-600">Ticker</th>
							<th class="px-4 py-3 text-left font-semibold text-slate-600">Ex-Date</th>
							<th class="px-4 py-3 text-left font-semibold text-slate-600">Pay Date</th>
							<th class="px-4 py-3 text-right font-semibold text-slate-600">Shares Held</th>
							<th class="px-4 py-3 text-right font-semibold text-slate-600">Amount/Share</th>
							<th class="px-4 py-3 text-right font-semibold text-slate-600">Total</th>
							<th class="px-4 py-3 text-right font-semibold text-slate-600">Tax</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-100">
						{#each data.dividends as d}
							<tr class="hover:bg-slate-50 transition-colors">
								<td class="px-4 py-3 font-semibold text-slate-800">{d.ticker}</td>
								<td class="px-4 py-3 text-slate-600">{d.exDate}</td>
								<td class="px-4 py-3 text-slate-600">{d.payDate}</td>
								<td class="px-4 py-3 text-right text-slate-600">{d.sharesHeld.toFixed(4)}</td>
								<td class="px-4 py-3 text-right text-slate-600">{fmtCurrency(d.amountPerShare)}</td>
								<td class="px-4 py-3 text-right font-medium text-emerald-600">{fmtCurrency(d.totalAmount)}</td>
								<td class="px-4 py-3 text-right text-slate-500">{fmtCurrency(d.withholdingTax)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}

	{#if data.dividends.length === 0}
		<div class="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
			<p class="text-slate-500">No dividend records yet.</p>
		</div>
	{/if}
</div>
