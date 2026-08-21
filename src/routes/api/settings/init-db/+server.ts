import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { sql } from 'drizzle-orm';

// One-shot idempotent schema bootstrapper. Safe to run repeatedly:
// every statement uses CREATE TABLE IF NOT EXISTS.
export const POST: RequestHandler = async () => {
  const statements: string[] = [
    // ─── Main portfolio ──────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS task (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      priority INTEGER NOT NULL DEFAULT 1
    )`,
    `CREATE TABLE IF NOT EXISTS nav_item (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      href TEXT NOT NULL,
      icon TEXT NOT NULL DEFAULT 'circle',
      parent_id TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS stock (
      ticker TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '',
      current_price REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'USD',
      updated_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS "transaction" (
      id TEXT PRIMARY KEY,
      ticker TEXT NOT NULL,
      type TEXT NOT NULL,
      date TEXT NOT NULL,
      shares REAL NOT NULL,
      price_per_share REAL NOT NULL,
      fees REAL NOT NULL DEFAULT 0,
      notes TEXT DEFAULT '',
      created_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS dividend (
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
    )`,
    `CREATE TABLE IF NOT EXISTS sell_lot_match (
      id TEXT PRIMARY KEY,
      sell_txn_id TEXT NOT NULL,
      buy_txn_id TEXT NOT NULL,
      shares_applied REAL NOT NULL,
      created_at TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS idx_sell_lot_match_sell ON sell_lot_match(sell_txn_id)`,
    `CREATE INDEX IF NOT EXISTS idx_sell_lot_match_buy  ON sell_lot_match(buy_txn_id)`,

    // ─── SETMAI Fund ─────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS setmai_stock (
      ticker TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '',
      current_price REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'THB',
      updated_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS setmai_transaction (
      id TEXT PRIMARY KEY,
      ticker TEXT NOT NULL,
      type TEXT NOT NULL,
      date TEXT NOT NULL,
      shares REAL NOT NULL,
      price_per_share REAL NOT NULL,
      fees REAL NOT NULL DEFAULT 0,
      notes TEXT DEFAULT '',
      created_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS setmai_dividend (
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
    )`,

    // ─── Trend Following ─────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS trend_config (
      id TEXT PRIMARY KEY DEFAULT 'config',
      equity REAL NOT NULL DEFAULT 1000000,
      risk_pct REAL NOT NULL DEFAULT 1,
      atr_period INTEGER NOT NULL DEFAULT 20,
      atr_mult_stop REAL NOT NULL DEFAULT 2,
      atr_mult_add REAL NOT NULL DEFAULT 1,
      max_units INTEGER NOT NULL DEFAULT 4,
      updated_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS trend_stock (
      ticker TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '',
      current_price REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'THB',
      atr REAL NOT NULL DEFAULT 0,
      atr_updated_at TEXT,
      updated_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS trend_transaction (
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
    )`
  ];

  const created: string[] = [];
  try {
    for (const stmt of statements) {
      await db.run(sql.raw(stmt));
      const m = stmt.match(/CREATE\s+(?:TABLE|INDEX)\s+IF NOT EXISTS\s+"?([A-Za-z_][A-Za-z0-9_]*)"?/i);
      if (m) created.push(m[1]);
    }
    return json({ ok: true, ensured: created });
  } catch (err) {
    return json(
      { ok: false, error: (err as Error).message, completedBefore: created },
      { status: 500 }
    );
  }
};
