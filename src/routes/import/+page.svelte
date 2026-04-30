<script lang="ts">
	import { invalidateAll } from '$app/navigation';

	type ColumnType = '(ignore)' | 'ticker' | 'date' | 'type' | 'shares' | 'price' | 'fees' | 'notes' | 'currency';

	const COLUMN_TYPES: { value: ColumnType; label: string }[] = [
		{ value: '(ignore)',  label: '— ignore —'     },
		{ value: 'ticker',   label: 'Ticker'          },
		{ value: 'date',     label: 'Date'            },
		{ value: 'type',     label: 'Type (Buy/Sell)' },
		{ value: 'shares',   label: 'Shares'          },
		{ value: 'price',    label: 'Price/Share'     },
		{ value: 'fees',     label: 'Fees'            },
		{ value: 'currency', label: 'Currency'        },
		{ value: 'notes',    label: 'Notes'           },
	];

	const CURRENCIES = [
		{ value: 'USD', label: 'USD — US Dollar'           },
		{ value: 'EUR', label: 'EUR — Euro'                },
		{ value: 'GBP', label: 'GBP — British Pound'       },
		{ value: 'JPY', label: 'JPY — Japanese Yen'        },
		{ value: 'AUD', label: 'AUD — Australian Dollar'   },
		{ value: 'CAD', label: 'CAD — Canadian Dollar'     },
		{ value: 'HKD', label: 'HKD — Hong Kong Dollar'    },
		{ value: 'SGD', label: 'SGD — Singapore Dollar'    },
		{ value: 'THB', label: 'THB — Thai Baht'           },
		{ value: 'CNY', label: 'CNY — Chinese Yuan'        },
		{ value: 'INR', label: 'INR — Indian Rupee'        },
		{ value: 'KRW', label: 'KRW — South Korean Won'    },
		{ value: 'MYR', label: 'MYR — Malaysian Ringgit'   },
		{ value: 'IDR', label: 'IDR — Indonesian Rupiah'   },
		{ value: 'VND', label: 'VND — Vietnamese Dong'     },
		{ value: 'CHF', label: 'CHF — Swiss Franc'         },
		{ value: 'NZD', label: 'NZD — New Zealand Dollar'  },
	];

	const DATE_FORMATS = [
		{ value: 'YYYY-MM-DD',  label: 'YYYY-MM-DD  (e.g. 2024-01-15)' },
		{ value: 'DD/MM/YYYY',  label: 'DD/MM/YYYY  (e.g. 15/01/2024)' },
		{ value: 'MM/DD/YYYY',  label: 'MM/DD/YYYY  (e.g. 01/15/2024)' },
		{ value: 'DD-MM-YYYY',  label: 'DD-MM-YYYY  (e.g. 15-01-2024)' },
		{ value: 'M/D/YYYY',    label: 'M/D/YYYY    (e.g. 1/15/2024)'  },
	];

	let pastedRows      = $state<string[][]>([]);
	let columnTypes     = $state<ColumnType[]>([]);
	let dateFormat      = $state('YYYY-MM-DD');
	let defaultCurrency = $state('USD');
	let importResult    = $state<{ success?: string; error?: string } | null>(null);
	let importing       = $state(false);
	let rowErrors       = $state<Record<number, string>>({});
	let hasPasted       = $state(false);

	/* ─── paste handler (global so it fires regardless of focus) ─── */
	function handlePaste(e: ClipboardEvent) {
		const text = e.clipboardData?.getData('text/plain') ?? '';
		if (!text.trim()) return;

		e.preventDefault();

		// Handle both \r\n (Windows) and \n line endings; strip trailing \r from cells
		const rows = text
			.trim()
			.split(/\r?\n/)
			.map((r) => r.split('\t').map((cell) => cell.replace(/\r$/, '').trim()));

		// Drop entirely empty rows (e.g. Excel trailing newline)
		const filtered = rows.filter((r) => r.some((c) => c !== ''));

		if (filtered.length === 0) return;

		pastedRows  = filtered;
		const ncols = Math.max(...filtered.map((r) => r.length));
		// Build a fresh array explicitly – avoids Array.fill proxy quirks
		columnTypes = Array.from({ length: ncols }, () => '(ignore)' as ColumnType);
		importResult = null;
		rowErrors    = {};
		hasPasted    = true;
	}

	function setCol(idx: number, val: ColumnType) {
		// Immutable update so Svelte detects the change
		columnTypes = columnTypes.map((c, i) => (i === idx ? val : c));
	}

	/* ─── date parsing ─── */
	function parseDate(raw: string, fmt: string): string | null {
		raw = raw.trim();
		if (!raw) return null;
		if (fmt === 'YYYY-MM-DD') {
			return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
		}
		if (fmt === 'DD/MM/YYYY') {
			const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
			return m ? `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}` : null;
		}
		if (fmt === 'MM/DD/YYYY' || fmt === 'M/D/YYYY') {
			const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
			return m ? `${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}` : null;
		}
		if (fmt === 'DD-MM-YYYY') {
			const m = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
			return m ? `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}` : null;
		}
		return null;
	}

	function parseType(raw: string): string | null {
		const v = raw.trim().toLowerCase();
		if (['buy', 'b', '1', 'long'].includes(v))       return 'buy';
		if (['sell', 's', '-1', 'short'].includes(v))     return 'sell';
		return null;
	}

	/* ─── validation ─── */
	function validateRows() {
		const errors: Record<number, string> = {};
		const valid: {
			ticker: string; type: string; date: string;
			shares: number; pricePerShare: number; fees: number; notes: string; currency: string;
		}[] = [];

		const ci = (t: ColumnType) => columnTypes.indexOf(t);
		const tickerCol = ci('ticker'), dateCol = ci('date'),  typeCol    = ci('type');
		const sharesCol = ci('shares'), priceCol = ci('price'), feesCol   = ci('fees');
		const notesCol  = ci('notes'),  currencyCol = ci('currency');

		for (let i = 0; i < pastedRows.length; i++) {
			const row  = pastedRows[i];
			const errs: string[] = [];

			const ticker = tickerCol >= 0 ? (row[tickerCol] ?? '').trim().toUpperCase() : '';
			if (!ticker) errs.push('missing Ticker');

			const rawDate = dateCol >= 0 ? row[dateCol] ?? '' : '';
			const date    = parseDate(rawDate, dateFormat);
			if (!date) errs.push(`bad Date "${rawDate}"`);

			const rawType = typeCol >= 0 ? row[typeCol] ?? '' : '';
			const type    = parseType(rawType);
			if (!type) errs.push(`bad Type "${rawType}"`);

			const shares = sharesCol >= 0 ? parseFloat((row[sharesCol] ?? '').replace(/,/g, '')) : NaN;
			if (isNaN(shares) || shares <= 0) errs.push('bad Shares');

			const price = priceCol >= 0 ? parseFloat((row[priceCol] ?? '').replace(/[,$]/g, '')) : NaN;
			if (isNaN(price) || price < 0) errs.push('bad Price');

			const fees     = feesCol >= 0 ? parseFloat((row[feesCol] ?? '').replace(/[,$]/g, '')) || 0 : 0;
			const notes    = notesCol >= 0 ? (row[notesCol] ?? '') : '';
			const currency = currencyCol >= 0
				? ((row[currencyCol] ?? '').trim().toUpperCase() || defaultCurrency)
				: defaultCurrency;

			if (errs.length) {
				errors[i] = errs.join(', ');
			} else {
				valid.push({ ticker, type: type!, date: date!, shares, pricePerShare: price, fees, notes, currency });
			}
		}
		rowErrors = errors;
		return valid;
	}

	let hasRequired = $derived(
		columnTypes.includes('ticker') &&
		columnTypes.includes('date')   &&
		columnTypes.includes('type')   &&
		columnTypes.includes('shares') &&
		columnTypes.includes('price')
	);

	// Re-validate whenever column mapping or date format changes
	let validCount = $state(0);
	$effect(() => {
		if (pastedRows.length > 0 && hasRequired) {
			validCount = validateRows().length;
		} else {
			rowErrors  = {};
			validCount = 0;
		}
	});

	/* ─── import ─── */
	async function handleImport() {
		const rows = validateRows();
		if (!rows.length) return;

		importing    = true;
		importResult = null;
		try {
			const res  = await fetch('/api/import', {
				method:  'POST',
				headers: { 'Content-Type': 'application/json' },
				body:    JSON.stringify(rows),
			});
			const data = await res.json();
			if (res.ok) {
				importResult = { success: `Imported ${data.imported} transaction(s) successfully.` };
				pastedRows   = [];
				columnTypes  = [];
				rowErrors    = {};
				hasPasted    = false;
				await invalidateAll();
			} else {
				importResult = { error: data.error ?? 'Import failed.' };
			}
		} catch {
			importResult = { error: 'Network error — please try again.' };
		} finally {
			importing = false;
		}
	}

	function handleClear() {
		pastedRows   = [];
		columnTypes  = [];
		rowErrors    = {};
		importResult = null;
		hasPasted    = false;
	}
</script>

<!-- Capture paste anywhere on this page -->
<svelte:window onpaste={handlePaste} />

<div class="space-y-6">
	<div>
		<h2 class="text-2xl font-bold text-slate-800">Import Transactions</h2>
		<p class="mt-1 text-slate-500">
			Copy rows from Excel / Google Sheets and press
			<kbd class="rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 font-mono text-xs">Ctrl+V</kbd>
			anywhere on this page.
		</p>
	</div>

	<!-- Global currency selector (always visible) -->
	<div class="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
		<div class="flex items-center gap-2">
			<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
			</svg>
			<label class="text-sm font-medium text-slate-700" for="defaultCurrency">Default currency:</label>
		</div>
		<select
			id="defaultCurrency"
			bind:value={defaultCurrency}
			class="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-300"
		>
			{#each CURRENCIES as cur}
				<option value={cur.value}>{cur.label}</option>
			{/each}
		</select>
		<p class="text-xs text-slate-400">
			Applied to all rows unless you map a <strong>Currency</strong> column.
		</p>
	</div>

	<!-- Paste drop zone (visual cue) -->
	{#if !hasPasted}
		<div class="flex min-h-40 flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-indigo-300 bg-indigo-50 text-indigo-400">
			<svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
				<path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-3-3v6M3 7V5a2 2 0 012-2h14a2 2 0 012 2v2M3 17v2a2 2 0 002 2h14a2 2 0 002-2v-2" />
			</svg>
			<p class="text-sm font-semibold">Press <kbd class="rounded border border-indigo-300 bg-white px-1.5 py-0.5 font-mono text-xs text-indigo-600">Ctrl+V</kbd> to paste your spreadsheet data</p>
			<p class="text-xs text-indigo-300">Supports Excel, Google Sheets, or any tab-separated text</p>
		</div>
	{:else}
		<!-- ── pasted: show the grid ── -->
		<div class="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-4 py-3">
			<p class="text-sm font-medium text-green-700">
				✓ {pastedRows.length} rows pasted — use the dropdowns in the header row to map each column, then click Import.
			</p>
			<button onclick={handleClear} class="text-xs text-slate-500 underline hover:text-slate-700">Clear</button>
		</div>

		<!-- Date format selector (shown only when date column is mapped) -->
		{#if columnTypes.includes('date')}
			<div class="flex flex-wrap items-center gap-3">
				<label class="text-sm font-medium text-slate-700" for="dateFmt">Date format:</label>
				<select
					id="dateFmt"
					bind:value={dateFormat}
					class="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
				>
					{#each DATE_FORMATS as fmt}
						<option value={fmt.value}>{fmt.label}</option>
					{/each}
				</select>
			</div>
		{/if}

		<!-- Required columns hint -->
		{#if !hasRequired}
			<p class="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
				⚠ Please map at minimum: <strong>Ticker, Date, Type, Shares, Price</strong>
			</p>
		{/if}

		<!-- Spreadsheet grid -->
		<div class="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
			<table class="min-w-full text-sm">
				<thead class="bg-slate-50">
					<!-- Row 0: column-type dropdowns -->
					<tr class="border-b-2 border-indigo-200">
						<th class="w-10 px-2 py-2 text-center text-xs font-medium text-slate-400">#</th>
						{#each columnTypes as colType, colIdx (colIdx)}
							<th class="min-w-36 px-2 py-2">
								<select
									value={colType}
									onchange={(e) => setCol(colIdx, (e.currentTarget as HTMLSelectElement).value as ColumnType)}
									class="w-full rounded-md border px-2 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-400"
									class:border-indigo-400={colType !== '(ignore)'}
									class:bg-indigo-50={colType !== '(ignore)'}
									class:text-indigo-700={colType !== '(ignore)'}
									class:border-slate-300={colType === '(ignore)'}
									class:text-slate-400={colType === '(ignore)'}
								>
									{#each COLUMN_TYPES as opt}
										<option value={opt.value}>{opt.label}</option>
									{/each}
								</select>
							</th>
						{/each}
						<th class="px-3 py-2 text-left text-xs font-semibold text-slate-500">Status</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-100">
					{#each pastedRows as row, rowIdx (rowIdx)}
						{@const hasError = !!rowErrors[rowIdx]}
						<tr class:bg-red-50={hasError} class="hover:bg-slate-50 transition-colors">
							<td class="px-2 py-2 text-center text-xs text-slate-400">{rowIdx + 1}</td>
							{#each columnTypes as colType, colIdx (colIdx)}
								<td
									class="max-w-48 truncate px-3 py-2"
									class:text-slate-300={colType === '(ignore)'}
									class:italic={colType === '(ignore)'}
									class:text-slate-700={colType !== '(ignore)'}
									class:font-medium={colType === 'ticker'}
								>
									{row[colIdx] ?? ''}
								</td>
							{/each}
							<td class="px-3 py-2 text-xs">
								{#if hasError}
									<span class="text-red-500">⚠ {rowErrors[rowIdx]}</span>
								{:else if hasRequired}
									<span class="text-green-500">✓ ok</span>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<!-- Footer actions -->
		<div class="flex flex-wrap items-center justify-between gap-3">
			<p class="text-sm text-slate-500">
				{#if hasRequired}
					<span class:text-green-600={validCount > 0} class:text-red-600={validCount === 0}>
						{validCount} of {pastedRows.length} rows ready to import
					</span>
				{:else}
					Map the required columns above to continue.
				{/if}
			</p>
			<div class="flex gap-3">
				<button
					onclick={handleClear}
					class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
				>
					Clear
				</button>
				<button
					onclick={handleImport}
					disabled={importing || !hasRequired || validCount === 0}
					class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{importing ? 'Importing…' : `Import ${validCount} row${validCount !== 1 ? 's' : ''}`}
				</button>
			</div>
		</div>
	{/if}

	<!-- Result banner -->
	{#if importResult}
		{#if importResult.success}
			<div class="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
				✓ {importResult.success}
			</div>
		{:else}
			<div class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
				✗ {importResult.error}
			</div>
		{/if}
	{/if}

	<!-- Usage guide -->
	{#if !hasPasted}
		<div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
			<h3 class="mb-3 font-semibold text-slate-700">How to import</h3>
			<ol class="space-y-2 text-sm text-slate-600 list-decimal list-inside">
				<li>Prepare your data in Excel or Google Sheets with columns like Ticker, Date, Type, Shares, Price.</li>
				<li>Select all data rows (no need to include headers).</li>
				<li>Copy (<kbd class="rounded border border-slate-200 bg-slate-100 px-1 font-mono text-xs">Ctrl+C</kbd>).</li>
				<li>Come back to this page and press <kbd class="rounded border border-slate-200 bg-slate-100 px-1 font-mono text-xs">Ctrl+V</kbd>.</li>
				<li>Use the dropdowns in the header row to tell the app what each column means.</li>
				<li>Click <strong>Import</strong>.</li>
			</ol>
			<p class="mt-3 text-xs text-slate-400">
				Supported values for <strong>Type</strong>: buy, sell, b, s, 1, -1
			</p>
		</div>
	{/if}
</div>
