<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { Chart as ChartType } from 'chart.js';

	type EquityPoint = { date: string; ticker: string; pnl: number; cumulative: number };
	type Bucket = { label: string; count: number };
	type PerTicker = { ticker: string; trades: number; pnl: number };

	let {
		equityCurve,
		buckets,
		perTicker
	}: {
		equityCurve: EquityPoint[];
		buckets: Bucket[];
		perTicker: PerTicker[];
	} = $props();

	let equityCanvas = $state<HTMLCanvasElement | null>(null);
	let bucketCanvas = $state<HTMLCanvasElement | null>(null);
	let tickerCanvas = $state<HTMLCanvasElement | null>(null);

	let equityChart: ChartType | null = null;
	let bucketChart: ChartType | null = null;
	let tickerChart: ChartType | null = null;

	async function buildAll() {
		const {
			Chart,
			LineElement,
			LineController,
			PointElement,
			BarElement,
			BarController,
			CategoryScale,
			LinearScale,
			Filler,
			Tooltip,
			Legend
		} = await import('chart.js');

		Chart.register(
			LineElement,
			LineController,
			PointElement,
			BarElement,
			BarController,
			CategoryScale,
			LinearScale,
			Filler,
			Tooltip,
			Legend
		);

		// ── Equity curve (cumulative realized P/L) ─────
		if (equityCanvas) {
			equityChart?.destroy();
			equityChart = new Chart(equityCanvas, {
				type: 'line',
				data: {
					labels: equityCurve.map((p) => p.date),
					datasets: [
						{
							label: 'Cumulative realized P/L',
							data: equityCurve.map((p) => p.cumulative),
							borderColor: '#6366f1',
							backgroundColor: 'rgba(99,102,241,0.15)',
							fill: true,
							tension: 0.15,
							pointRadius: 3,
							pointBackgroundColor: '#6366f1'
						}
					]
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						legend: { display: false },
						tooltip: {
							callbacks: {
								label: (ctx) => {
									const p = equityCurve[ctx.dataIndex];
									return [
										`${p.ticker}`,
										`Trade P/L: ${p.pnl >= 0 ? '+' : ''}${p.pnl.toFixed(0)}`,
										`Cumulative: ${p.cumulative.toFixed(0)}`
									];
								}
							}
						}
					},
					scales: {
						y: {
							beginAtZero: false,
							ticks: { callback: (v) => Number(v).toLocaleString() }
						}
					}
				}
			});
		}

		// ── R-multiple distribution ─────────────────────
		if (bucketCanvas) {
			bucketChart?.destroy();
			const colors = buckets.map((b) =>
				b.label.startsWith('<') || b.label.startsWith('-') ? '#ef4444' : '#10b981'
			);
			bucketChart = new Chart(bucketCanvas, {
				type: 'bar',
				data: {
					labels: buckets.map((b) => b.label),
					datasets: [
						{
							label: 'Trade count',
							data: buckets.map((b) => b.count),
							backgroundColor: colors,
							borderRadius: 4
						}
					]
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					plugins: { legend: { display: false } },
					scales: {
						y: {
							beginAtZero: true,
							ticks: { stepSize: 1, precision: 0 }
						}
					}
				}
			});
		}

		// ── Per-ticker P/L bar ───────────────────────────
		if (tickerCanvas) {
			tickerChart?.destroy();
			tickerChart = new Chart(tickerCanvas, {
				type: 'bar',
				data: {
					labels: perTicker.map((t) => t.ticker),
					datasets: [
						{
							label: 'Realized P/L',
							data: perTicker.map((t) => t.pnl),
							backgroundColor: perTicker.map((t) => (t.pnl >= 0 ? '#10b981' : '#ef4444')),
							borderRadius: 4
						}
					]
				},
				options: {
					indexAxis: 'y',
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						legend: { display: false },
						tooltip: {
							callbacks: {
								label: (ctx) => {
									const t = perTicker[ctx.dataIndex];
									return `${t.trades} trades · ${t.pnl >= 0 ? '+' : ''}${t.pnl.toFixed(0)}`;
								}
							}
						}
					},
					scales: {
						x: { ticks: { callback: (v) => Number(v).toLocaleString() } }
					}
				}
			});
		}
	}

	onMount(() => {
		buildAll();
	});

	$effect(() => {
		// Rebuild whenever props change (after delete / invalidate).
		void equityCurve;
		void buckets;
		void perTicker;
		buildAll();
	});

	onDestroy(() => {
		equityChart?.destroy();
		bucketChart?.destroy();
		tickerChart?.destroy();
	});
</script>

<div class="space-y-4">
	<div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
		<h3 class="mb-2 text-sm font-semibold text-slate-700">Equity Curve (cumulative realized P/L)</h3>
		<div class="relative" style="height: 260px;">
			<canvas bind:this={equityCanvas}></canvas>
		</div>
	</div>

	<div class="grid gap-4 lg:grid-cols-2">
		<div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
			<h3 class="mb-2 text-sm font-semibold text-slate-700">R-Multiple Distribution</h3>
			<div class="relative" style="height: 240px;">
				<canvas bind:this={bucketCanvas}></canvas>
			</div>
			<p class="mt-2 text-xs text-slate-500">
				Trend followers expect a distribution skewed right — lots of small −1R stops offset by a few big multi-R winners.
			</p>
		</div>

		<div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
			<h3 class="mb-2 text-sm font-semibold text-slate-700">P/L by Ticker</h3>
			<div class="relative" style="height: {Math.max(240, perTicker.length * 32)}px;">
				<canvas bind:this={tickerCanvas}></canvas>
			</div>
		</div>
	</div>
</div>
