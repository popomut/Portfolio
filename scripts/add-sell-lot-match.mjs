import { createClient } from '@libsql/client';

const db = createClient({ url: 'file:local.db' });

await db.execute(`CREATE TABLE IF NOT EXISTS sell_lot_match (
  id TEXT PRIMARY KEY,
  sell_txn_id TEXT NOT NULL,
  buy_txn_id TEXT NOT NULL,
  shares_applied REAL NOT NULL,
  created_at TEXT
)`);

await db.execute(`CREATE INDEX IF NOT EXISTS idx_sell_lot_match_sell ON sell_lot_match(sell_txn_id)`);
await db.execute(`CREATE INDEX IF NOT EXISTS idx_sell_lot_match_buy  ON sell_lot_match(buy_txn_id)`);

console.log('✓ sell_lot_match table ready.');
db.close();
