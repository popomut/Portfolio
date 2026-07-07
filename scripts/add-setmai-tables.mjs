import { createClient } from '@libsql/client';

const db = createClient({ url: 'file:local.db' });

await db.execute(`CREATE TABLE IF NOT EXISTS setmai_stock (
  ticker TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  current_price REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'THB',
  updated_at TEXT
)`);

await db.execute(`CREATE TABLE IF NOT EXISTS setmai_transaction (
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

await db.execute(`CREATE TABLE IF NOT EXISTS setmai_dividend (
  id TEXT PRIMARY KEY,
  ticker TEXT NOT NULL,
  ex_date TEXT NOT NULL,
  pay_date TEXT NOT NULL,
  shares_held REAL NOT NULL,
  amount_per_share REAL NOT NULL,
  total_amount REAL NOT NULL,
  withholding_tax REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'THB',
  notes TEXT DEFAULT '',
  created_at TEXT
)`);

console.log('✓ SETMAI Fund tables ready.');
db.close();
