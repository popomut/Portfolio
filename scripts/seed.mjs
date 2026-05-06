import { createClient } from '@libsql/client';
import { randomUUID } from 'crypto';

const db = createClient({ url: 'file:local.db' });

// Create tables
await db.execute(`CREATE TABLE IF NOT EXISTS task (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 1
)`);

await db.execute(`CREATE TABLE IF NOT EXISTS nav_item (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  href TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'circle',
  parent_id TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
)`);

await db.execute(`CREATE TABLE IF NOT EXISTS stock (
  ticker TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  current_price REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  updated_at TEXT
)`);

await db.execute(`CREATE TABLE IF NOT EXISTS "transaction" (
  id TEXT PRIMARY KEY,
  ticker TEXT NOT NULL,
  type TEXT NOT NULL,
  date TEXT NOT NULL,
  shares REAL NOT NULL,
  price_per_share REAL NOT NULL,
  fees REAL NOT NULL DEFAULT 0,
  notes TEXT DEFAULT '',
  created_at TEXT
)`);

await db.execute(`CREATE TABLE IF NOT EXISTS dividend (
  id TEXT PRIMARY KEY,
  ticker TEXT NOT NULL,
  ex_date TEXT NOT NULL,
  pay_date TEXT NOT NULL,
  shares_held REAL NOT NULL,
  amount_per_share REAL NOT NULL,
  total_amount REAL NOT NULL,
  withholding_tax REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  notes TEXT DEFAULT '',
  created_at TEXT
)`);

// Seed nav items
await db.execute('DELETE FROM nav_item');
const settingsId = randomUUID();
await db.execute({
  sql: 'INSERT INTO nav_item (id, label, href, icon, parent_id, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
  args: [randomUUID(), 'Portfolio', '/', 'bar-chart-2', null, 0]
});
await db.execute({
  sql: 'INSERT INTO nav_item (id, label, href, icon, parent_id, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
  args: [randomUUID(), 'Import', '/import', 'upload', null, 1]
});
await db.execute({
  sql: 'INSERT INTO nav_item (id, label, href, icon, parent_id, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
  args: [randomUUID(), 'Imported Data', '/imported-data', 'folder', null, 2]
});
await db.execute({
  sql: 'INSERT INTO nav_item (id, label, href, icon, parent_id, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
  args: [randomUUID(), 'Closed Positions', '/closed-positions', 'circle', null, 3]
});
await db.execute({
  sql: 'INSERT INTO nav_item (id, label, href, icon, parent_id, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
  args: [settingsId, 'Settings', '/settings', 'settings', null, 4]
});
await db.execute({
  sql: 'INSERT INTO nav_item (id, label, href, icon, parent_id, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
  args: [randomUUID(), 'Dividends', '/dividends', 'bar-chart-2', null, 5]
});

// Clear existing data
await db.execute('DELETE FROM "transaction"');
await db.execute('DELETE FROM stock');

// Seed stocks
await db.execute({
  sql: 'INSERT INTO stock (ticker, name, current_price, currency, updated_at) VALUES (?, ?, ?, ?, ?)',
  args: ['AAPL', 'Apple Inc.', 185, 'USD', new Date().toISOString()]
});
await db.execute({
  sql: 'INSERT INTO stock (ticker, name, current_price, currency, updated_at) VALUES (?, ?, ?, ?, ?)',
  args: ['MSFT', 'Microsoft Corporation', 420, 'USD', new Date().toISOString()]
});
await db.execute({
  sql: 'INSERT INTO stock (ticker, name, current_price, currency, updated_at) VALUES (?, ?, ?, ?, ?)',
  args: ['GOOGL', 'Alphabet Inc.', 165, 'USD', new Date().toISOString()]
});

// Seed transactions
const txns = [
  [randomUUID(), 'AAPL', 'buy', '2024-01-15', 100, 150, 0, 'Initial purchase', new Date().toISOString()],
  [randomUUID(), 'AAPL', 'sell', '2024-06-01', 20, 175, 0, 'Partial sell', new Date().toISOString()],
  [randomUUID(), 'MSFT', 'buy', '2024-02-01', 50, 380, 5, 'Initial purchase', new Date().toISOString()],
  [randomUUID(), 'GOOGL', 'buy', '2024-03-10', 30, 140, 0, 'Initial purchase', new Date().toISOString()],
];

for (const tx of txns) {
  await db.execute({
    sql: 'INSERT INTO "transaction" (id, ticker, type, date, shares, price_per_share, fees, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    args: tx
  });
}

console.log('Database seeded successfully');
db.close();

