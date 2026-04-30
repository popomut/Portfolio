<script lang="ts">
	import type { Transaction } from '$lib/utils/portfolio';

	let {
		open,
		editTransaction = null,
		onclose
	}: {
		open: boolean;
		editTransaction: Transaction | null;
		onclose: (saved: boolean) => void;
	} = $props();

	let type = $state<'buy' | 'sell'>('buy');
	let ticker = $state('');
	let date = $state(new Date().toISOString().slice(0, 10));
	let shares = $state('');
	let pricePerShare = $state('');
	let fees = $state('0');
	let notes = $state('');
	let error = $state('');
	let loading = $state(false);

	$effect(() => {
		if (open) {
			if (editTransaction) {
				type = editTransaction.type as 'buy' | 'sell';
				ticker = editTransaction.ticker;
				date = editTransaction.date;
				shares = String(editTransaction.shares);
				pricePerShare = String(editTransaction.pricePerShare);
				fees = String(editTransaction.fees);
				notes = editTransaction.notes ?? '';
			} else {
				type = 'buy';
				ticker = '';
				date = new Date().toISOString().slice(0, 10);
				shares = '';
				pricePerShare = '';
				fees = '0';
				notes = '';
			}
			error = '';
		}
	});

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose(false);
	}

	async function handleSubmit() {
		error = '';
		if (!ticker.trim()) { error = 'Ticker is required'; return; }
		if (!date) { error = 'Date is required'; return; }
		if (!shares || isNaN(Number(shares)) || Number(shares) <= 0) { error = 'Shares must be a positive number'; return; }
		if (!pricePerShare || isNaN(Number(pricePerShare)) || Number(pricePerShare) < 0) { error = 'Price must be a non-negative number'; return; }

		loading = true;
		try {
			const body = {
				ticker: ticker.trim().toUpperCase(),
				type,
				date,
				shares: Number(shares),
				pricePerShare: Number(pricePerShare),
				fees: Number(fees) || 0,
				notes
			};

			let res;
			if (editTransaction) {
				res = await fetch(`/api/transactions/${editTransaction.id}`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(body)
				});
			} else {
				res = await fetch('/api/transactions', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(body)
				});
			}

			if (!res.ok) {
				const data = await res.json();
				error = data.error ?? 'Failed to save transaction';
				return;
			}

			onclose(true);
		} catch (e) {
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
		<div class="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
			<div class="mb-5 flex items-center justify-between">
				<h2 class="text-lg font-semibold text-slate-800">
					{editTransaction ? 'Edit Transaction' : 'Add Transaction'}
				</h2>
				<button
					onclick={() => onclose(false)}
					class="rounded-md p-1 text-slate-400 hover:text-slate-600"
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-4">
				<!-- Type toggle -->
				<div>
					<label class="mb-1 block text-sm font-medium text-slate-700">Type</label>
					<div class="flex gap-2">
						<button
							type="button"
							onclick={() => (type = 'buy')}
							class="flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-colors"
							class:bg-green-600={type === 'buy'}
							class:text-white={type === 'buy'}
							class:border-green-600={type === 'buy'}
							class:border-slate-300={type !== 'buy'}
							class:text-slate-700={type !== 'buy'}
						>Buy</button>
						<button
							type="button"
							onclick={() => (type = 'sell')}
							class="flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-colors"
							class:bg-red-600={type === 'sell'}
							class:text-white={type === 'sell'}
							class:border-red-600={type === 'sell'}
							class:border-slate-300={type !== 'sell'}
							class:text-slate-700={type !== 'sell'}
						>Sell</button>
					</div>
				</div>

				<!-- Ticker -->
				<div>
					<label class="mb-1 block text-sm font-medium text-slate-700" for="ticker">Ticker</label>
					<input
						id="ticker"
						type="text"
						bind:value={ticker}
						oninput={() => (ticker = ticker.toUpperCase())}
						placeholder="AAPL"
						class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
					/>
				</div>

				<!-- Date -->
				<div>
					<label class="mb-1 block text-sm font-medium text-slate-700" for="date">Date</label>
					<input
						id="date"
						type="date"
						bind:value={date}
						class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
					/>
				</div>

				<!-- Shares + Price -->
				<div class="grid grid-cols-2 gap-3">
					<div>
						<label class="mb-1 block text-sm font-medium text-slate-700" for="shares">Shares</label>
						<input
							id="shares"
							type="number"
							step="any"
							min="0"
							bind:value={shares}
							placeholder="100"
							class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
						/>
					</div>
					<div>
						<label class="mb-1 block text-sm font-medium text-slate-700" for="price">Price/Share</label>
						<input
							id="price"
							type="number"
							step="any"
							min="0"
							bind:value={pricePerShare}
							placeholder="150.00"
							class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
						/>
					</div>
				</div>

				<!-- Fees -->
				<div>
					<label class="mb-1 block text-sm font-medium text-slate-700" for="fees">Fees</label>
					<input
						id="fees"
						type="number"
						step="any"
						min="0"
						bind:value={fees}
						placeholder="0"
						class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
					/>
				</div>

				<!-- Notes -->
				<div>
					<label class="mb-1 block text-sm font-medium text-slate-700" for="notes">Notes</label>
					<input
						id="notes"
						type="text"
						bind:value={notes}
						placeholder="Optional notes"
						class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
					/>
				</div>

				{#if error}
					<p class="text-sm text-red-600">{error}</p>
				{/if}

				<div class="flex justify-end gap-3 pt-2">
					<button
						type="button"
						onclick={() => onclose(false)}
						class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
					>
						Cancel
					</button>
					<button
						type="submit"
						disabled={loading}
						class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
					>
						{loading ? 'Saving…' : editTransaction ? 'Update' : 'Add Transaction'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
