<script lang="ts">
	import type { Dividend } from '$lib/utils/portfolio';

	const CURRENCIES = ['USD','EUR','GBP','JPY','AUD','CAD','HKD','SGD','THB','CNY','INR','KRW','MYR','IDR','VND','CHF','NZD'];

	let {
		open,
		ticker,
		currency,
		currentShares,
		editDividend = null,
		onclose
	}: {
		open: boolean;
		ticker: string;
		currency: string;
		currentShares: number;
		editDividend: Dividend | null;
		onclose: (saved: boolean) => void;
	} = $props();

	const today = () => new Date().toISOString().slice(0, 10);

	let exDate = $state(today());
	let payDate = $state(today());
	let sharesHeld = $state('');
	let amountPerShare = $state('');
	let withholdingTax = $state('0');
	let totalAmount = $state('');
	let totalAmountManual = $state(false);
	let selectedCurrency = $state('USD');
	let notes = $state('');
	let error = $state('');
	let loading = $state(false);

	$effect(() => {
		if (open) {
			if (editDividend) {
				exDate = editDividend.exDate;
				payDate = editDividend.payDate;
				sharesHeld = String(editDividend.sharesHeld);
				amountPerShare = String(editDividend.amountPerShare);
				withholdingTax = String(editDividend.withholdingTax);
				totalAmount = String(editDividend.totalAmount);
				selectedCurrency = editDividend.currency;
				notes = editDividend.notes ?? '';
			} else {
				exDate = today();
				payDate = today();
				sharesHeld = currentShares > 0 ? String(currentShares) : '';
				amountPerShare = '';
				withholdingTax = '0';
				totalAmount = '';
				selectedCurrency = currency || 'USD';
				notes = '';
			}
			totalAmountManual = false;
			error = '';
		}
	});

	$effect(() => {
		if (!totalAmountManual) {
			const s = Number(sharesHeld);
			const a = Number(amountPerShare);
			const w = Number(withholdingTax) || 0;
			if (!isNaN(s) && !isNaN(a) && s > 0 && a > 0) {
				totalAmount = (s * a - w).toFixed(4);
			}
		}
	});

	function handleTotalAmountInput() {
		totalAmountManual = true;
	}

	function recalculate() {
		totalAmountManual = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose(false);
	}

	async function handleSubmit() {
		error = '';
		if (!exDate) { error = 'Ex-Date is required'; return; }
		if (!payDate) { error = 'Pay Date is required'; return; }
		if (!sharesHeld || isNaN(Number(sharesHeld)) || Number(sharesHeld) <= 0) { error = 'Shares Held must be a positive number'; return; }
		if (!amountPerShare || isNaN(Number(amountPerShare)) || Number(amountPerShare) < 0) { error = 'Amount per Share must be a non-negative number'; return; }
		if (!totalAmount || isNaN(Number(totalAmount))) { error = 'Total Amount is required'; return; }

		loading = true;
		try {
			const body = {
				ticker,
				exDate,
				payDate,
				sharesHeld: Number(sharesHeld),
				amountPerShare: Number(amountPerShare),
				totalAmount: Number(totalAmount),
				withholdingTax: Number(withholdingTax) || 0,
				currency: selectedCurrency,
				notes
			};

			let res;
			if (editDividend) {
				res = await fetch(`/api/dividends/${editDividend.id}`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(body)
				});
			} else {
				res = await fetch('/api/dividends', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(body)
				});
			}

			if (!res.ok) {
				const data = await res.json();
				error = data.error ?? 'Failed to save dividend';
				return;
			}

			onclose(true);
		} catch {
			error = 'Network error';
		} finally {
			loading = false;
		}
	}
</script>

{#if open}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4"
		role="dialog"
		aria-modal="true"
		onkeydown={handleKeydown}
	>
		<div class="absolute inset-0 bg-black/50" onclick={() => onclose(false)}></div>
		<div class="relative z-10 w-full max-w-lg rounded-2xl bg-white shadow-2xl">
			<!-- Header -->
			<div class="flex items-center justify-between rounded-t-2xl bg-emerald-50 border-b border-emerald-200 px-6 py-4">
				<div>
					<h2 class="text-lg font-semibold text-emerald-900">
						{editDividend ? 'Edit Dividend' : 'Add Dividend'}
					</h2>
					<p class="text-sm text-emerald-700">{ticker}</p>
				</div>
				<button onclick={() => onclose(false)} class="rounded-md p-1 text-emerald-600 hover:text-emerald-800">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<!-- Body -->
			<div class="p-6">
				<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-4">
					<!-- Ex-Date + Pay Date -->
					<div class="grid grid-cols-2 gap-3">
						<div>
							<label class="mb-1 block text-sm font-medium text-slate-700" for="div-ex-date">Ex-Date</label>
							<input
								id="div-ex-date"
								type="date"
								bind:value={exDate}
								class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
							/>
						</div>
						<div>
							<label class="mb-1 block text-sm font-medium text-slate-700" for="div-pay-date">Pay Date</label>
							<input
								id="div-pay-date"
								type="date"
								bind:value={payDate}
								class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
							/>
						</div>
					</div>

					<!-- Shares Held + Amount per Share -->
					<div class="grid grid-cols-2 gap-3">
						<div>
							<label class="mb-1 block text-sm font-medium text-slate-700" for="div-shares">Shares Held</label>
							<input
								id="div-shares"
								type="number"
								step="any"
								min="0"
								bind:value={sharesHeld}
								placeholder="100"
								class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
							/>
						</div>
						<div>
							<label class="mb-1 block text-sm font-medium text-slate-700" for="div-amount-per-share">Amount per Share</label>
							<input
								id="div-amount-per-share"
								type="number"
								step="any"
								min="0"
								bind:value={amountPerShare}
								placeholder="0.50"
								class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
							/>
						</div>
					</div>

					<!-- Withholding Tax -->
					<div>
						<label class="mb-1 block text-sm font-medium text-slate-700" for="div-withholding">Withholding Tax</label>
						<input
							id="div-withholding"
							type="number"
							step="any"
							min="0"
							bind:value={withholdingTax}
							placeholder="0"
							class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
						/>
					</div>

					<!-- Total Amount -->
					<div>
						<div class="mb-1 flex items-center justify-between">
							<label class="text-sm font-medium text-slate-700" for="div-total">Net Total Amount</label>
							{#if totalAmountManual}
								<button
									type="button"
									onclick={recalculate}
									class="text-xs text-emerald-600 hover:text-emerald-800 hover:underline"
								>↺ Recalculate</button>
							{/if}
						</div>
						<input
							id="div-total"
							type="number"
							step="any"
							bind:value={totalAmount}
							oninput={handleTotalAmountInput}
							placeholder="Auto-calculated"
							class="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1"
							class:border-emerald-400={totalAmountManual}
							class:bg-emerald-50={totalAmountManual}
							class:focus:border-emerald-500={totalAmountManual}
							class:focus:ring-emerald-500={totalAmountManual}
							class:border-slate-300={!totalAmountManual}
							class:focus:border-indigo-500={!totalAmountManual}
							class:focus:ring-indigo-300={!totalAmountManual}
						/>
						{#if totalAmountManual}
							<p class="mt-1 text-xs text-emerald-600">Manually set — click ↺ Recalculate to auto-compute.</p>
						{/if}
					</div>

					<!-- Currency -->
					<div>
						<label class="mb-1 block text-sm font-medium text-slate-700" for="div-currency">Currency</label>
						<select
							id="div-currency"
							bind:value={selectedCurrency}
							class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
						>
							{#each CURRENCIES as c}
								<option value={c}>{c}</option>
							{/each}
						</select>
					</div>

					<!-- Notes -->
					<div>
						<label class="mb-1 block text-sm font-medium text-slate-700" for="div-notes">Notes</label>
						<input
							id="div-notes"
							type="text"
							bind:value={notes}
							placeholder="Optional notes"
							class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
						/>
					</div>

					{#if error}
						<p class="text-sm text-red-600">{error}</p>
					{/if}

					<div class="flex justify-end gap-3 pt-2">
						<button
							type="button"
							onclick={() => onclose(false)}
							class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={loading}
							class="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
						>
							{loading ? 'Saving…' : editDividend ? 'Update Dividend' : 'Add Dividend'}
						</button>
					</div>
				</form>
			</div>
		</div>
	</div>
{/if}

