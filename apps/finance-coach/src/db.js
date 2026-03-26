'use strict';
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || './data/finance.db';

const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');


db.exec(`
  -- Accounts: personal, business, allowance (per family member)
  CREATE TABLE IF NOT EXISTS accounts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL UNIQUE,
    type        TEXT    NOT NULL CHECK(type IN ('personal','business','allowance')),
    balance     REAL    NOT NULL DEFAULT 0,
    currency    TEXT    NOT NULL DEFAULT 'USD',
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  -- Categories for expenses/income
  CREATE TABLE IF NOT EXISTS categories (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL UNIQUE,
    type        TEXT    NOT NULL CHECK(type IN ('expense','income','transfer')),
    icon        TEXT    NOT NULL DEFAULT '📦',
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  -- Transactions: expenses, income, transfers
  CREATE TABLE IF NOT EXISTS transactions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id      INTEGER NOT NULL REFERENCES accounts(id),
    category_id     INTEGER REFERENCES categories(id),
    amount          REAL    NOT NULL CHECK(amount != 0),
    type            TEXT    NOT NULL CHECK(type IN ('expense','income','transfer','allowance')),
    description     TEXT    NOT NULL DEFAULT '',
    notes           TEXT    NOT NULL DEFAULT '',
    date            TEXT    NOT NULL DEFAULT (date('now')),
    tags            TEXT    NOT NULL DEFAULT '[]',  -- JSON array
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  -- Budgets per category per month
  CREATE TABLE IF NOT EXISTS budgets (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL REFERENCES categories(id),
    account_id  INTEGER REFERENCES accounts(id),  -- null = all accounts
    amount      REAL    NOT NULL CHECK(amount > 0),
    period      TEXT    NOT NULL CHECK(period IN ('monthly','weekly')),
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(category_id, account_id, period)
  );

  -- Spending goals / savings jars
  CREATE TABLE IF NOT EXISTS goals (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id  INTEGER NOT NULL REFERENCES accounts(id),
    name        TEXT    NOT NULL,
    target      REAL    NOT NULL CHECK(target > 0),
    saved       REAL    NOT NULL DEFAULT 0,
    deadline    TEXT,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  -- Monthly summaries (auto-computed)
  CREATE TABLE IF NOT EXISTS monthly_summaries (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    year        INTEGER NOT NULL,
    month       INTEGER NOT NULL,
    account_id  INTEGER REFERENCES accounts(id),
    total_income REAL   NOT NULL DEFAULT 0,
    total_expense REAL  NOT NULL DEFAULT 0,
    net         REAL    NOT NULL DEFAULT 0,
    top_category TEXT,
    UNIQUE(year, month, account_id)
  );
`);

const seedDefaults = db.transaction(() => {
  const accCount = db.prepare('SELECT COUNT(*) as c FROM accounts').get();
  if (accCount.c === 0) {
    const insertAcc = db.prepare(
      'INSERT INTO accounts (name, type, balance) VALUES (?, ?, ?)'
    );
    insertAcc.run('Personal', 'personal', 0);
    insertAcc.run('Business', 'business', 0);
    insertAcc.run('Family Allowance', 'allowance', 0);

    const insertCat = db.prepare(
      'INSERT INTO categories (name, type, icon) VALUES (?, ?, ?)'
    );
    const expenseCats = [
      ['Food & Dining', '🍽️'], ['Groceries', '🛒'], ['Transport', '🚗'],
      ['Entertainment', '🎬'], ['Shopping', '🛍️'], ['Health', '💊'],
      ['Bills & Utilities', '⚡'], ['Education', '📚'], ['Personal Care', '🧴'],
      ['Home', '🏠'], ['Business Expense', '💼'], ['Subscriptions', '📱'],
      ['Travel', '✈️'], ['Gifts', '🎁'], ['Charity', '💝'], ['Other', '📦'],
    ];
    const expenseInsert = db.prepare(
      'INSERT OR IGNORE INTO categories (name, type, icon) VALUES (?, ?, ?)'
    );
    for (const [name, icon] of expenseCats) {
      expenseInsert.run(name, 'expense', icon);
    }
const incomeCats = [
      ['Salary', '💰'], ['Freelance', '💻'], ['Business Income', '📈'],
      ['Allowance', '👨‍👩‍👧'], ['Investment', '📊'], ['Gift Received', '🎁'],
      ['Refund', '↩️'], ['Other Income', '💵'],
    ];
    for (const [name, icon] of incomeCats) {
      expenseInsert.run(name, 'income', icon);
    }
  }
});
seedDefaults();

module.exports = db;
