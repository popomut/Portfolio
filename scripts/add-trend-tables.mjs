import { createClient } from '@libsql/client';

const db = createClient({ url: 'file:local.db' });

await db.execute(`CREATE TABLE IF NOT EXISTS trend_config (
  id TEXT PRIMARY KEY DEFAULT 'config',
  equity REAL NOT NULL DEFAULT 1000000,
  risk_pct REAL NOT NULL DEFAULT 1,
  atr_period INTEGER NOT NULL DEFAULT 20,
  atr_mult_stop REAL NOT NULL DEFAULT 2,
  atr_mult_add REAL NOT NULL DEFAULT 1,
  max_units INTEGER NOT NULL DEFAULT 4,
  updated_at TEXT
)`);

await db.execute(`CREATE TABLE IF NOT EXISTS trend_stock (
  ticker TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  current_price REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'THB',
  atr REAL NOT NULL DEFAULT 0,
  atr_updated_at TEXT,
  updated_at TEXT
)`);

await db.execute(`CREATE TABLE IF NOT EXISTS trend_transaction (
  id TEXT PRIMARY KEY,
  ticker TEXT NOT NULL,
  type TEXT NOT NULL,
  unit_number INTEGER NOT NULL DEFAULT 1,
  date TEXT NOT NULL,
  shares REAL NOT NULL,
  price_per_share REAL NOT NULL,
  stop_price REAL NOT NULL DEFAULT 0,
  atr_at_entry REAL NOT NULL DEFAULT 0,
  fees REAL NOT NULL DEFAULT 0,
  notes TEXT DEFAULT '',
  created_at TEXT
)`);

console.log('✓ Trend Following tables ready.');
db.close();
