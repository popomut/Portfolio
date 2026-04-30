<script lang="ts">
	let {
		open,
		ticker,
		transactionCount,
		onconfirm,
		oncancel
	}: {
		open: boolean;
		ticker: string;
		transactionCount: number;
		onconfirm: () => void;
		oncancel: () => void;
	} = $props();

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') oncancel();
	}
</script>

{#if open}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		role="dialog"
		aria-modal="true"
		aria-labelledby="confirm-title"
		class="fixed inset-0 z-50 flex items-center justify-center p-4"
		onkeydown={handleKeydown}
	>
		<!-- Backdrop -->
		<div
			class="absolute inset-0 bg-black/50 backdrop-blur-sm"
			onclick={oncancel}
			role="presentation"
		></div>

		<!-- Dialog card -->
		<div class="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-2xl">
			<!-- Red header strip -->
			<div class="flex items-center gap-3 rounded-t-2xl bg-red-50 px-6 py-5 border-b border-red-100">
				<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
					</svg>
				</div>
				<div>
					<h2 id="confirm-title" class="text-base font-semibold text-red-800">Delete {ticker}?</h2>
					<p class="text-xs text-red-500 mt-0.5">This action cannot be undone</p>
				</div>
			</div>

			<!-- Body -->
			<div class="px-6 py-5">
				<p class="text-sm text-slate-600 leading-relaxed">
					You are about to permanently delete <span class="font-semibold text-slate-800">{ticker}</span>
					and all
					<span class="font-semibold text-slate-800">{transactionCount} transaction{transactionCount !== 1 ? 's' : ''}</span>
					associated with it.
				</p>
				<p class="mt-3 text-sm text-slate-500">
					All portfolio history, cost basis, and IRR data for this stock will be lost.
				</p>
			</div>

			<!-- Actions -->
			<div class="flex justify-end gap-3 rounded-b-2xl border-t border-slate-100 bg-slate-50 px-6 py-4">
				<button
					onclick={oncancel}
					class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
				>
					Cancel
				</button>
				<button
					onclick={onconfirm}
					class="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
					</svg>
					Delete {ticker}
				</button>
			</div>
		</div>
	</div>
{/if}
