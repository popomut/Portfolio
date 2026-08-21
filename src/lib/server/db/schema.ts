import { real, sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const task = sqliteTable('task', {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	title: text('title').notNull(),
	priority: integer('priority').notNull().default(1)
});

export const navItem = sqliteTable('nav_item', {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	label: text('label').notNull(),
	href: text('href').notNull(),
	icon: text('icon').notNull().default('circle'),
	parentId: text('parent_id'),
	sortOrder: integer('sort_order').notNull().default(0)
});

export const stock = sqliteTable('stock', {
	ticker: text('ticker').primaryKey(),
	name: text('name').notNull().default(''),
	currentPrice: real('current_price').notNull().default(0),
	currency: text('currency').notNull().default('USD'),
	updatedAt: text('updated_at')
});

export const transaction = sqliteTable('transaction', {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	ticker: text('ticker').notNull(),
	type: text('type').notNull(), // 'buy' | 'sell'
	date: text('date').notNull(), // YYYY-MM-DD
	shares: real('shares').notNull(),
	pricePerShare: real('price_per_share').notNull(),
	fees: real('fees').notNull().default(0),
	notes: text('notes').default(''),
	createdAt: text('created_at').$defaultFn(() => new Date().toISOString())
});

export const sellLotMatch = sqliteTable('sell_lot_match', {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	sellTxnId: text('sell_txn_id').notNull(),
	buyTxnId: text('buy_txn_id').notNull(),
	sharesApplied: real('shares_applied').notNull(),
	createdAt: text('created_at').$defaultFn(() => new Date().toISOString())
});

export const dividend = sqliteTable('dividend', {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	ticker: text('ticker').notNull(),
	exDate: text('ex_date').notNull(),
	payDate: text('pay_date').notNull(),
	sharesHeld: real('shares_held').notNull(),
	amountPerShare: real('amount_per_share').notNull(),
	totalAmount: real('total_amount').notNull(),
	withholdingTax: real('withholding_tax').notNull().default(0),
	currency: text('currency').notNull().default('USD'),
	notes: text('notes').default(''),
	createdAt: text('created_at').$defaultFn(() => new Date().toISOString())
});

// ─── SETMAI Fund (isolated tables, mirror shape of the main portfolio) ───

export const setmaiStock = sqliteTable('setmai_stock', {
	ticker: text('ticker').primaryKey(),
	name: text('name').notNull().default(''),
	currentPrice: real('current_price').notNull().default(0),
	currency: text('currency').notNull().default('THB'),
	updatedAt: text('updated_at')
});

export const setmaiTransaction = sqliteTable('setmai_transaction', {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	ticker: text('ticker').notNull(),
	type: text('type').notNull(),
	date: text('date').notNull(),
	shares: real('shares').notNull(),
	pricePerShare: real('price_per_share').notNull(),
	fees: real('fees').notNull().default(0),
	notes: text('notes').default(''),
	createdAt: text('created_at').$defaultFn(() => new Date().toISOString())
});

export const setmaiDividend = sqliteTable('setmai_dividend', {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	ticker: text('ticker').notNull(),
	exDate: text('ex_date').notNull(),
	payDate: text('pay_date').notNull(),
	sharesHeld: real('shares_held').notNull(),
	amountPerShare: real('amount_per_share').notNull(),
	totalAmount: real('total_amount').notNull(),
	withholdingTax: real('withholding_tax').notNull().default(0),
	currency: text('currency').notNull().default('THB'),
	notes: text('notes').default(''),
	createdAt: text('created_at').$defaultFn(() => new Date().toISOString())
});

// ─── Trend Following (isolated: no dividends; ATR + pyramid tracking) ───

export const trendConfig = sqliteTable('trend_config', {
	id: text('id').primaryKey().default('config'), // single-row table
	equity: real('equity').notNull().default(1000000),
	riskPct: real('risk_pct').notNull().default(1), // % of equity risked per trade
	atrPeriod: integer('atr_period').notNull().default(20),
	atrMultStop: real('atr_mult_stop').notNull().default(2), // stop = entry - atrMultStop * ATR
	atrMultAdd: real('atr_mult_add').notNull().default(1),   // pyramid add every atrMultAdd * ATR up
	maxUnits: integer('max_units').notNull().default(4),
	updatedAt: text('updated_at')
});

export const trendStock = sqliteTable('trend_stock', {
	ticker: text('ticker').primaryKey(),
	name: text('name').notNull().default(''),
	currentPrice: real('current_price').notNull().default(0),
	currency: text('currency').notNull().default('THB'),
	atr: real('atr').notNull().default(0), // most recent ATR value
	atrUpdatedAt: text('atr_updated_at'),
	updatedAt: text('updated_at')
});

export const trendTransaction = sqliteTable('trend_transaction', {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	ticker: text('ticker').notNull(),
	type: text('type').notNull(), // 'buy' | 'sell'
	unitNumber: integer('unit_number').notNull().default(1), // 1..maxUnits (pyramid unit)
	date: text('date').notNull(),
	shares: real('shares').notNull(),
	pricePerShare: real('price_per_share').notNull(),
	stopPrice: real('stop_price').notNull().default(0), // stop set at entry
	atrAtEntry: real('atr_at_entry').notNull().default(0), // ATR value used to size
	fees: real('fees').notNull().default(0),
	notes: text('notes').default(''),
	createdAt: text('created_at').$defaultFn(() => new Date().toISOString())
});
