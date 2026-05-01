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
