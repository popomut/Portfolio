<script lang="ts">
	import { invalidateAll } from '$app/navigation';

	// ── Mode ─────────────────────────────────────────────────────────
	type Mode = 'transactions' | 'dividends';
	let mode = $state<Mode>('transactions');

	// ── Column types ──────────────────────────────────────────────────
	type TxnCol = '(ignore)' | 'ticker' | 'date' | 'type' | 'shares' | 'price' | 'fees' | 'notes' | 'currency';
	type DivCol = '(ignore)' | 'ticker' | 'ex_date' | 'pay_date' | 'shares_held' | 'amount_per_share' | 'total_amount' | 'withholding_tax' | 'currency' | 'notes';
	type ColumnType = TxnCol | DivCol;

	const TXN_COLS: { value: TxnCol; label: string }[] = [
		{ value: '(ignore)',  label: '— ignore —'      },
		{ value: 'ticker',   label: 'Ticker'           },
		{ value: 'date',     label: 'Date'             },
		{ value: 'type',     label: 'Type (Buy/Sell)'  },
		{ value: 'shares',   label: 'Shares'           },
		{ value: 'price',    label: 'Price/Share'      },
		{ value: 'fees',     label: 'Fees'             },
		{ value: 'currency', label: 'Currency'         },
		{ value: 'notes',    label: 'Notes'            },
	];

	const DIV_COLS: { value: DivCol; label: string }[] = [
		{ value: '(ignore)',         label: '— ignore —'         },
		{ value: 'ticker',           label: 'Ticker'             },
		{ value: 'ex_date',          label: 'Ex-Date'            },
		{ value: 'pay_date',         label: 'Pay Date'           },
		{ value: 'shares_held',      label: 'Shares Held'        },
		{ value: 'amount_per_share', label: 'Amount/Share'       },
		{ value: 'total_amount',     label: 'Total Amount (net)' },
		{ value: 'withholding_tax',  label: 'Withholding Tax'    },
		{ value: 'currency',         label: 'Currency'           },
		{ value: 'notes',            label: 'Notes'              },
	];

	const CURRENCIES = [
		{ value: 'USD', label: 'USD — US Dollar'          },
		{ value: 'EUR', label: 'EUR — Euro'               },
		{ value: 'GBP', label: 'GBP — British Pound'      },
		{ value: 'JPY', label: 'JPY — Japanese Yen'       },
		{ value: 'AUD', label: 'AUD — Australian Dollar'  },
		{ value: 'CAD', label: 'CAD — Canadian Dollar'    },
		{ value: 'HKD', label: 'HKD — Hong Kong Dollar'   },
		{ value: 'SGD', label: 'SGD — Singapore Dollar'   },
		{ value: 'THB', label: 'THB — Thai Baht'          },
		{ value: 'CNY', label: 'CNY — Chinese Yuan'       },
		{ value: 'INR', label: 'INR — Indian Rupee'       },
		{ value: 'KRW', label: 'KRW — South Korean Won'   },
		{ value: 'MYR', label: 'MYR — Malaysian Ringgit'  },
		{ value: 'IDR', label: 'IDR — Indonesian Rupiah'  },
		{ value: 'VND', label: 'VND — Vietnamese Dong'    },
		{ value: 'CHF', label: 'CHF — Swiss Franc'        },
		{ value: 'NZD', label: 'NZD — New Zealand Dollar' },
	];

	const DATE_FORMATS = [
		{ value: 'YYYY-MM-DD', label: 'YYYY-MM-DD  (e.g. 2024-01-15)' },
		{ value: 'DD/MM/YYYY', label: 'DD/MM/YYYY  (e.g. 15/01/2024)' },
		{ value: 'MM/DD/YYYY', label: 'MM/DD/YYYY  (e.g. 01/15/2024)' },
		{ value: 'DD-MM-YYYY', label: 'DD-MM-YYYY  (e.g. 15-01-2024)' },
		{ value: 'M/D/YYYY',   label: 'M/D/YYYY    (e.g. 1/15/2024)'  },
	];

	let pastedRows      = $state<string[][]>([]);
	let columnTypes     = $state<ColumnType[]>([]);
	let dateFormat      = $state('YYYY-MM-DD');
	let defaultCurrency = $state('USD');
	let importResult    = $state<{ success?: string; error?: string } | null>(null);
	let importing       = $state(false);
	let rowErrors       = $state<Record<number, string>>({});
	let hasPasted       = $state(false);

	// Switching mode clears paste data
	function switchMode(m: Mode) {
		mode        = m;
		pastedRows  = [];
		columnTypes = [];
		rowErrors   = {};
		importResult = null;
		hasPasted   = false;
	}

	let currentCols = $derived(mode === 'dividends' ? DIV_COLS : TXN_COLS);

	/* ─── paste handler ──────────────────────────────────────────── */
	function handlePaste(e: ClipboardEvent) {
		const text = e.clipboardData?.getData('text/plain') ?? '';
		if (!text.trim()) return;
		e.preventDefault();
		const rows = text.trim().split(/\r?\n/)
			.map((r) => r.split('\t').map((cell) => cell.replace(/\r$/, '').trim()));
		const filtered = rows.filter((r) => r.some((c) => c !== ''));
		if (filtered.length === 0) return;
		pastedRows   = filtered;
		const ncols  = Math.max(...filtered.map((r) => r.length));
		columnTypes  = Array.from({ length: ncols }, (_, i) => detectColumnType(i, filtered));
		
		// Auto-detect date format from date column if present
		const dateColIdx = columnTypes.findIndex(t => t === 'date' || t === 'ex_date' || t === 'pay_date');
		if (dateColIdx >= 0) {
			dateFormat = detectDateFormat(dateColIdx, filtered);
		}
		
		importResult = null;
		rowErrors    = {};
		hasPasted    = true;
	}

	function detectColumnType(colIdx: number, rows: string[][]): ColumnType {
		const dataRows = rows.length > 0 && rows[0].length > 0 ? rows.slice(1) : rows;
		const samples = dataRows.slice(0, 5).map(r => r[colIdx]?.trim() ?? '');
		const nonEmpty = samples.filter(s => s.length > 0);
		if (nonEmpty.length === 0) return '(ignore)';
		
		const samplesLower = nonEmpty.map(s => s.toLowerCase());

		// Check for Type FIRST (buy/sell/dividend keywords) to avoid mistaking them for tickers
		if (samplesLower.every(s => parseType(s))) return 'type';

		// Check for Ticker (1–10 chars, letters and dots, uppercase or lowercase)
		// Examples: AAPL, BRK.A, BRK.B, VTSAX, SCC.BK, etc.
		if (nonEmpty.every(s => /^[a-zA-Z.]{1,10}$/.test(s))) {
			const common = new Set(['aapl', 'msft', 'goog', 'amzn', 'tsla', 'meta', 'nvda', 'amd', 'intc', 'ibm']);
			// Return ticker if: has common ticker, OR all are short letter/dot strings (likely tickers)
			if (samplesLower.some(s => common.has(s)) || nonEmpty.every(s => s.length <= 10)) {
				return 'ticker';
			}
		}

		// Check for Dates
		const dateFmts = ['YYYY-MM-DD', 'DD/MM/YYYY', 'MM/DD/YYYY', 'DD-MM-YYYY'];
		if (nonEmpty.every(s => dateFmts.some(fmt => parseDate(s, fmt)))) {
			return mode === 'dividends' ? 'ex_date' : 'date';
		}

		// Check for numeric columns
		const nums = nonEmpty.map(s => parseNum(s)).filter(n => !isNaN(n));
		if (nums.length === nonEmpty.length && nums.length > 0) {
			const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
			const max = Math.max(...nums);

			// Shares: typically whole numbers, < 100,000
			if (max < 100000 && nums.every(n => n % 1 === 0 || n < 100)) return 'shares';
			// Price: typically fractional, 0.01–10,000
			if (max > 0 && max <= 10000) return 'price';
			// Fees: small values, < 100
			if (max < 100 && avg < 10) return 'fees';
		}

		return '(ignore)';
	}

	function setCol(idx: number, val: ColumnType) {
		columnTypes = columnTypes.map((c, i) => (i === idx ? val : c));
	}

	/* ─── date format detection ──────────────────────────────────────── */
	function detectDateFormat(colIdx: number, rows: string[][]): string {
		const dataRows = rows.length > 0 && rows[0].length > 0 ? rows.slice(1) : rows;
		const samples = dataRows.slice(0, 5)
			.map(r => r[colIdx]?.trim() ?? '')
			.filter(s => s.length > 0);

		if (samples.length === 0) return 'YYYY-MM-DD';

		const formats = ['YYYY-MM-DD', 'DD/MM/YYYY', 'MM/DD/YYYY', 'DD-MM-YYYY', 'M/D/YYYY'];
		
		for (const fmt of formats) {
			if (samples.every(s => parseDate(s, fmt))) {
				return fmt;
			}
		}

		return 'YYYY-MM-DD';
	}

	/* ─── date parsing ───────────────────────────────────────────── */
	function parseDate(raw: string, fmt: string): string | null {
		raw = raw.trim();
		if (!raw) return null;
		if (fmt === 'YYYY-MM-DD') {
			const m = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
			if (!m) return null;
			const month = parseInt(m[2], 10);
			const day = parseInt(m[3], 10);
			if (month < 1 || month > 12 || day < 1 || day > 31) return null;
			return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
		}
		if (fmt === 'DD/MM/YYYY') {
			const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
			if (!m) return null;
			const day = parseInt(m[1], 10);
			const month = parseInt(m[2], 10);
			if (day < 1 || day > 31 || month < 1 || month > 12) return null;
			return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
		}
		if (fmt === 'MM/DD/YYYY' || fmt === 'M/D/YYYY') {
			const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
			if (!m) return null;
			const month = parseInt(m[1], 10);
			const day = parseInt(m[2], 10);
			if (month < 1 || month > 12 || day < 1 || day > 31) return null;
			return `${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`;
		}
		if (fmt === 'DD-MM-YYYY') {
			const m = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
			if (!m) return null;
			const day = parseInt(m[1], 10);
			const month = parseInt(m[2], 10);
			if (day < 1 || day > 31 || month < 1 || month > 12) return null;
			return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
		}
		return null;
	}

	function parseType(raw: string): string | null {
		const v = raw.trim().toLowerCase();
		if (['buy', 'b', '1', 'long'].includes(v))                  return 'buy';
		if (['sell', 's', '-1', 'short'].includes(v))                return 'sell';
		if (['d', 'div', 'dividend', 'dividends'].includes(v))       return 'dividend';
		return null;
	}

	function parseNum(raw: string) {
		return parseFloat((raw ?? '').replace(/[,$\s]/g, ''));
	}

	/* ─── transaction validation ─────────────────────────────────── */
	function validateTxnRows() {
		const errors: Record<number, string> = {};
		const valid: {
			ticker: string; type: string; date: string;
			shares: number; pricePerShare: number; fees: number; notes: string; currency: string;
		}[] = [];
		const divRows: {
			ticker: string; exDate: string; payDate: string;
			sharesHeld: number; amountPerShare: number; totalAmount: number;
			withholdingTax: number; currency: string; notes: string;
		}[] = [];

		const ci = (t: ColumnType) => columnTypes.indexOf(t);
		const tickerCol = ci('ticker'), dateCol = ci('date'), typeCol = ci('type');
		const sharesCol = ci('shares'), priceCol = ci('price'), feesCol = ci('fees');
		const notesCol = ci('notes'), currencyCol = ci('currency');

		for (let i = 0; i < pastedRows.length; i++) {
			const row = pastedRows[i];
			const errs: string[] = [];

			const ticker = tickerCol >= 0 ? (row[tickerCol] ?? '').trim().toUpperCase() : '';
			if (!ticker) errs.push('missing Ticker');

			const date = parseDate(row[dateCol] ?? '', dateFormat);
			if (!date) errs.push(`bad Date "${row[dateCol] ?? ''}"`);

			const type = parseType(row[typeCol] ?? '');
			if (!type) errs.push(`bad Type "${row[typeCol] ?? ''}"`);

			const currency = currencyCol >= 0
				? ((row[currencyCol] ?? '').trim().toUpperCase() || defaultCurrency)
				: defaultCurrency;
			const notes = notesCol >= 0 ? (row[notesCol] ?? '') : '';

			// Dividend rows: extract separately, don't flag as error
			if (type === 'dividend' && ticker && date) {
				const shares = sharesCol >= 0 ? parseNum(row[sharesCol] ?? '') : NaN;
				const price  = priceCol  >= 0 ? parseNum(row[priceCol]  ?? '') : NaN;
				const sharesHeld     = isNaN(shares) ? 0 : shares;
				const amountPerShare = isNaN(price)  ? 0 : price;
				divRows.push({
					ticker, exDate: date, payDate: date,
					sharesHeld, amountPerShare,
					totalAmount: sharesHeld * amountPerShare,
					withholdingTax: 0, currency, notes
				});
				continue;
			}

			const shares = parseNum(row[sharesCol] ?? '');
			if (isNaN(shares) || shares <= 0) errs.push('bad Shares');

			const price = parseNum(row[priceCol] ?? '');
			if (isNaN(price) || price < 0) errs.push('bad Price');

			const fees = feesCol >= 0 ? parseNum(row[feesCol] ?? '') || 0 : 0;

			if (errs.length) errors[i] = errs.join(', ');
			else valid.push({ ticker, type: type!, date: date!, shares, pricePerShare: price, fees, notes, currency });
		}
		rowErrors = errors;
		return { valid, divRows };
	}

	/* ─── dividend validation ────────────────────────────────────── */
	function validateDivRows() {
		const errors: Record<number, string> = {};
		const valid: {
			ticker: string; exDate: string; payDate: string;
			sharesHeld: number; amountPerShare: number; totalAmount: number;
			withholdingTax: number; currency: string; notes: string;
		}[] = [];

		const ci = (t: ColumnType) => columnTypes.indexOf(t);
		const tickerCol   = ci('ticker'),           exDateCol    = ci('ex_date');
		const payDateCol  = ci('pay_date'),          sharesCol    = ci('shares_held');
		const amtCol      = ci('amount_per_share'),  totalCol     = ci('total_amount');
		const taxCol      = ci('withholding_tax'),   currencyCol  = ci('currency');
		const notesCol    = ci('notes');

		for (let i = 0; i < pastedRows.length; i++) {
			const row = pastedRows[i];
			const errs: string[] = [];

			const ticker = tickerCol >= 0 ? (row[tickerCol] ?? '').trim().toUpperCase() : '';
			if (!ticker) errs.push('missing Ticker');

			const exDate = parseDate(row[exDateCol] ?? '', dateFormat);
			if (!exDate) errs.push(`bad Ex-Date "${row[exDateCol] ?? ''}"`);

			// Pay date defaults to ex-date if not mapped
			const payDate = payDateCol >= 0
				? (parseDate(row[payDateCol] ?? '', dateFormat) ?? exDate ?? '')
				: (exDate ?? '');

			const sharesHeld = sharesCol >= 0 ? parseNum(row[sharesCol] ?? '') : NaN;
			if (isNaN(sharesHeld) || sharesHeld < 0) errs.push('bad Shares Held');

			const amountPerShare = amtCol >= 0 ? parseNum(row[amtCol] ?? '') : NaN;

			const withholdingTax = taxCol >= 0 ? parseNum(row[taxCol] ?? '') || 0 : 0;

			// totalAmount: use column if mapped, else calculate from shares × amount
			let totalAmount: number;
			if (totalCol >= 0 && row[totalCol]?.trim()) {
				totalAmount = parseNum(row[totalCol]);
			} else if (!isNaN(amountPerShare) && !isNaN(sharesHeld)) {
				totalAmount = sharesHeld * amountPerShare - withholdingTax;
			} else {
				totalAmount = NaN;
			}

			if (isNaN(totalAmount) || totalAmount < 0) errs.push('need Amount/Share or Total Amount');

			const currency = currencyCol >= 0
				? ((row[currencyCol] ?? '').trim().toUpperCase() || defaultCurrency)
				: defaultCurrency;
			const notes = notesCol >= 0 ? (row[notesCol] ?? '') : '';

			if (errs.length) errors[i] = errs.join(', ');
			else valid.push({
				ticker, exDate: exDate!, payDate,
				sharesHeld: isNaN(sharesHeld) ? 0 : sharesHeld,
				amountPerShare: isNaN(amountPerShare) ? 0 : amountPerShare,
				totalAmount, withholdingTax, currency, notes
			});
		}
		rowErrors = errors;
		return valid;
	}

	/* ─── derived: required columns mapped? ─────────────────────── */
	let hasRequired = $derived(
		mode === 'dividends'
			? columnTypes.includes('ticker') && columnTypes.includes('ex_date') &&
			  (columnTypes.includes('total_amount') ||
			   (columnTypes.includes('shares_held') && columnTypes.includes('amount_per_share')))
			: columnTypes.includes('ticker') && columnTypes.includes('date') &&
			  columnTypes.includes('type')   && columnTypes.includes('shares') &&
			  columnTypes.includes('price')
	);

	let validCount = $state(0);
	let divCount  = $state(0);
	$effect(() => {
		if (pastedRows.length > 0 && hasRequired) {
			if (mode === 'dividends') {
				validCount = validateDivRows().length;
				divCount   = 0;
			} else {
				const { valid, divRows } = validateTxnRows();
				validCount = valid.length;
				divCount   = divRows.length;
			}
		} else {
			rowErrors  = {};
			validCount = 0;
			divCount   = 0;
		}
	});

	/* ─── import ─────────────────────────────────────────────────── */
	async function handleImport() {
		importing    = true;
		importResult = null;
		try {
			if (mode === 'dividends') {
				const rows = validateDivRows();
				if (!rows.length) { importing = false; return; }
				const res  = await fetch('/api/dividends/import', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(rows)
				});
				const data = await res.json();
				if (res.ok) {
					importResult = { success: `Imported ${data.imported} dividend record(s) successfully.` };
					resetPaste();
					await invalidateAll();
				} else {
					importResult = { error: data.error ?? 'Import failed.' };
				}
			} else {
				const { valid, divRows } = validateTxnRows();
				if (!valid.length && !divRows.length) { importing = false; return; }

				const parts: string[] = [];
				const errors: string[] = [];

				// Import buy/sell transactions
				if (valid.length) {
					const res  = await fetch('/api/import', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(valid)
					});
					const data = await res.json();
					if (res.ok) parts.push(`${data.imported} transaction(s)`);
					else errors.push(data.error ?? 'Transaction import failed.');
				}

				// Import any dividend rows found in the same data
				if (divRows.length) {
					const res  = await fetch('/api/dividends/import', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(divRows)
					});
					const data = await res.json();
					if (res.ok) parts.push(`${data.imported} dividend(s)`);
					else errors.push(data.error ?? 'Dividend import failed.');
				}

				if (errors.length) {
					importResult = { error: errors.join(' | ') };
				} else {
					importResult = { success: `Imported ${parts.join(' and ')} successfully.` };
					resetPaste();
					await invalidateAll();
				}
			}
		} catch {
			importResult = { error: 'Network error — please try again.' };
		} finally {
			importing = false;
		}
	}

	function resetPaste() {
		pastedRows  = [];
		columnTypes = [];
		rowErrors   = {};
		hasPasted   = false;
	}

	function handleClear() {
		resetPaste();
		importResult = null;
	}
</script>

<!-- Capture paste anywhere on this page -->
<svelte:window onpaste={handlePaste} />

<div class="space-y-6">
	<div class="flex flex-wrap items-start justify-between gap-4">
		<div>
			<h2 class="text-2xl font-bold text-slate-800">Import Data</h2>
			<p class="mt-1 text-slate-500">
				Copy rows from Excel / Google Sheets and press
				<kbd class="rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 font-mono text-xs">Ctrl+V</kbd>
				anywhere on this page.
			</p>
		</div>
		<!-- Mode toggle -->
		<div class="flex rounded-xl border border-slate-200 bg-slate-50 p-1 text-sm font-medium shadow-sm">
			<button
				onclick={() => switchMode('transactions')}
				class="flex items-center gap-2 rounded-lg px-4 py-2 transition-colors"
				class:bg-white={mode === 'transactions'}
				class:text-indigo-600={mode === 'transactions'}
				class:shadow-sm={mode === 'transactions'}
				class:text-slate-500={mode !== 'transactions'}
			>
				<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
				</svg>
				Transactions
			</button>
			<button
				onclick={() => switchMode('dividends')}
				class="flex items-center gap-2 rounded-lg px-4 py-2 transition-colors"
				class:bg-white={mode === 'dividends'}
				class:text-emerald-600={mode === 'dividends'}
				class:shadow-sm={mode === 'dividends'}
				class:text-slate-500={mode !== 'dividends'}
			>
				<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
				Dividends
			</button>
		</div>
	</div>

	<!-- Settings bar: currency + (date format when applicable) -->
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
		<p class="text-xs text-slate-400">Applied to all rows unless you map a <strong>Currency</strong> column.</p>
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

		<!-- Date format selector (shown only when a date column is mapped) -->
		{#if columnTypes.includes('date') || columnTypes.includes('ex_date') || columnTypes.includes('pay_date')}
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
			<p class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">
				{#if mode === 'dividends'}
					⚠ Please map at minimum: <strong>Ticker, Ex-Date</strong>, and either <strong>Total Amount</strong> or both <strong>Shares Held + Amount/Share</strong>
				{:else}
					⚠ Please map at minimum: <strong>Ticker, Date, Type, Shares, Price</strong>
				{/if}
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
									{#each currentCols as opt}
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
									{@const typeCol = columnTypes.indexOf('type')}
									{@const rawType = typeCol >= 0 ? (row[typeCol] ?? '').trim().toLowerCase() : ''}
									{@const isDivRow = ['d','div','dividend','dividends'].includes(rawType)}
									{#if isDivRow}
										<span class="text-emerald-500">✓ dividend</span>
									{:else}
										<span class="text-green-500">✓ ok</span>
									{/if}
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
					{#if mode === 'transactions'}
						<span class:text-green-600={validCount > 0 || divCount > 0} class:text-red-600={validCount === 0 && divCount === 0}>
							{validCount} transaction{validCount !== 1 ? 's' : ''}{divCount > 0 ? ` + ${divCount} dividend${divCount !== 1 ? 's' : ''}` : ''} ready to import
						</span>
					{:else}
						<span class:text-green-600={validCount > 0} class:text-red-600={validCount === 0}>
							{validCount} of {pastedRows.length} rows ready to import
						</span>
					{/if}
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
					disabled={importing || !hasRequired || (validCount === 0 && divCount === 0)}
					class="rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
					class:bg-indigo-600={mode === 'transactions'}
					class:hover:bg-indigo-700={mode === 'transactions'}
					class:bg-emerald-600={mode === 'dividends'}
					class:hover:bg-emerald-700={mode === 'dividends'}
				>
					{#if importing}
						Importing…
					{:else if mode === 'dividends'}
						Import {validCount} dividend{validCount !== 1 ? 's' : ''}
					{:else if divCount > 0}
						Import {validCount > 0 ? `${validCount} transaction${validCount !== 1 ? 's' : ''} + ` : ''}{divCount} dividend{divCount !== 1 ? 's' : ''}
					{:else}
						Import {validCount} transaction{validCount !== 1 ? 's' : ''}
					{/if}
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

<!-- Import loading modal -->
{#if importing}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
		<div class="rounded-xl bg-white p-8 shadow-2xl">
			<div class="flex flex-col items-center gap-4">
				<!-- Spinner animation -->
				<div class="relative h-16 w-16">
					<div class="absolute inset-0 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600"></div>
				</div>
				<div class="text-center">
					<p class="text-lg font-semibold text-slate-800">Importing data</p>
					<p class="mt-1 text-sm text-slate-500">Please wait...</p>
				</div>
			</div>
		</div>
	</div>
{/if}
