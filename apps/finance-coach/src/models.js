'use strict';
const db = require('./db');


function toYYYYMM(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function getOrCreate(data, insertStmt, getStmt, key) {
  const existing = getStmt ? getStmt.get(data[key]) : null;
  if (existing) return existing;
  const result = insertStmt.run(data);
  return getStmt ? getStmt.get(data[key]) : { id: result.lastInsertRowid };
}


const accounts = {
  list: () => db.prepare('SELECT * FROM accounts ORDER BY id').all(),
  get: (name) => db.prepare('SELECT * FROM accounts WHERE name = ?').get(name),
  getById: (id) => db.prepare('SELECT * FROM accounts WHERE id = ?').get(id),
  updateBalance: (id, delta) =>
    db.prepare("UPDATE accounts SET balance = balance + ?, updated_at = datetime('now') WHERE id = ?").run(delta, id),
};


const categories = {
  list: (type) => type
    ? db.prepare('SELECT * FROM categories WHERE type = ? ORDER BY name').all(type)
    : db.prepare('SELECT * FROM categories ORDER BY name').all(),
  get: (name) => db.prepare('SELECT * FROM categories WHERE name = ?').get(name),
  getById: (id) => db.prepare('SELECT * FROM categories WHERE id = ?').get(id),
  getDefault: (type) => db.prepare('SELECT * FROM categories WHERE type = ? AND name = "Other"').get(type),
};


const transactions = {
  add: ({ accountId, categoryId, amount, type, description = '', notes = '', date, tags = [] }) => {
    const stmt = db.prepare(`
      INSERT INTO transactions (account_id, category_id, amount, type, description, notes, date, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(accountId, categoryId, amount, type, description, notes, date || new Date().toISOString().split('T')[0], JSON.stringify(tags));

    const delta = type === 'expense' || type === 'allowance' ? -Math.abs(amount) : Math.abs(amount);
    accounts.updateBalance(accountId, delta);
    updateMonthlySummary(accountId, type, amount, date);

    return { id: result.lastInsertRowid };
  },

  list: ({ accountId, categoryId, type, startDate, endDate, limit = 50 } = {}) => {
    const conditions = ['1=1'];
    const params = [];
    if (accountId) { conditions.push('t.account_id = ?'); params.push(accountId); }
    if (categoryId) { conditions.push('t.category_id = ?'); params.push(categoryId); }
    if (type) { conditions.push('t.type = ?'); params.push(type); }
    if (startDate) { conditions.push('t.date >= ?'); params.push(startDate); }
    if (endDate) { conditions.push('t.date <= ?'); params.push(endDate); }
    params.push(limit);

    return db.prepare(`
      SELECT t.*, a.name as account_name, a.type as account_type,
             c.name as category_name, c.icon as category_icon
      FROM transactions t
      JOIN accounts a ON t.account_id = a.id
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY t.date DESC, t.created_at DESC
      LIMIT ?
    `).all(...params);
  },

  getRecent: (accountId, days = 7) => {
    return db.prepare(`
      SELECT t.*, a.name as account_name, c.name as category_name, c.icon as category_icon
      FROM transactions t
      JOIN accounts a ON t.account_id = a.id
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.date >= date('now', '-${days} days')
        AND (? IS NULL OR t.account_id = ?)
      ORDER BY t.date DESC
    `).all(accountId, accountId);
  },
};


function updateMonthlySummary(accountId, type, amount, dateStr) {
  const [year, month] = (dateStr || new Date().toISOString().split('T')[0]).split('-').map(Number);
  const upsert = db.prepare(`
    INSERT INTO monthly_summaries (year, month, account_id, total_income, total_expense, net)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(year, month, account_id) DO UPDATE SET
      total_income = total_income + excluded.total_income,
      total_expense = total_expense + excluded.total_expense,
      net = net + excluded.net
  `);
  const income = type === 'income' ? amount : 0;
  const expense = type === 'expense' || type === 'allowance' ? amount : 0;
  upsert.run(year, month, accountId, income, expense, income - expense);
}

function getMonthlySummary(accountId = null, year = null, month = null) {
  const now = new Date();
  const y = year || now.getFullYear();
  const m = month || now.getMonth() + 1;
  const params = [y, m];
  let where = 'year = ? AND month = ?';
  if (accountId) { where += ' AND account_id = ?'; params.push(accountId); }
  const row = db.prepare(`
    SELECT
      COALESCE(SUM(total_income), 0) as total_income,
      COALESCE(SUM(total_expense), 0) as total_expense,
      COALESCE(SUM(net), 0) as net
    FROM monthly_summaries WHERE ${where}
  `).get(...params);
  return { ...row, year: y, month: m };
}

function getSpendingByCategory({ accountId, year, month, type = 'expense' }) {
  const now = new Date();
  const y = year || now.getFullYear();
  const m = month || now.getMonth() + 1;
  const params = [String(y), String(m).padStart(2, '0'), type];
  let where = `strftime('%Y', t.date) = ? AND strftime('%m', t.date) = ? AND t.type = ?`;
  if (accountId) { where += ' AND t.account_id = ?'; params.push(accountId); }
  return db.prepare(`
    SELECT c.name, c.icon, SUM(ABS(t.amount)) as total, COUNT(*) as count
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE ${where}
    GROUP BY t.category_id
    ORDER BY total DESC
  `).all(...params);
}


const budgets = {
  list: () => db.prepare('SELECT b.*, c.name as category_name, c.icon as category_icon FROM budgets b LEFT JOIN categories c ON b.category_id = c.id').all(),
  set: (categoryId, accountId, amount, period = 'monthly') => {
    db.prepare(`
      INSERT INTO budgets (category_id, account_id, amount, period)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(category_id, account_id, period) DO UPDATE SET amount = excluded.amount
    `).run(categoryId, accountId || null, amount, period);
  },
  getForMonth: (accountId = null) => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
    const endDate = `${y}-${String(m).padStart(2, '0')}-31`;

    return db.prepare(`
      SELECT b.*, c.name as category_name, c.icon as category_icon,
             COALESCE(SUM(ABS(t.amount)), 0) as spent
      FROM budgets b
      JOIN categories c ON b.category_id = c.id
      LEFT JOIN transactions t ON t.category_id = b.category_id
        AND (? IS NULL OR t.account_id = ?)
        AND t.type = 'expense'
        AND t.date >= ? AND t.date <= ?
      WHERE b.period = 'monthly'
      GROUP BY b.id
      ORDER BY c.name
    `).all(accountId, accountId, startDate, endDate);
  },
};


function getAISummary(accountId = null) {
  const now = new Date();
  const currentMonth = toYYYYMM(now);
  const lastMonth = toYYYYMM(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const [cy, cm] = currentMonth.split('-').map(Number);
  const [ly, lm] = lastMonth.split('-').map(Number);

  const thisMonth = getMonthlySummary(accountId, cy, cm);
  const lastMonthData = getMonthlySummary(accountId, ly, lm);

  const thisSpending = getSpendingByCategory({ accountId, year: cy, month: cm, type: 'expense' });
  const lastSpending = getSpendingByCategory({ accountId, year: ly, month: lm, type: 'expense' });

  const thisBudgets = budgets.getForMonth(accountId);
  const recentTx = transactions.getRecent(accountId, 14);

  const accountsList = accounts.list();

  return {
    period: `${now.toLocaleString('default', { month: 'long', year: 'numeric' })}`,
    currentMonth: {
      income: thisMonth?.total_income || 0,
      expenses: thisMonth?.total_expense || 0,
      net: thisMonth?.net || 0,
    },
    lastMonth: {
      income: lastMonthData?.total_income || 0,
      expenses: lastMonthData?.total_expense || 0,
      net: lastMonthData?.net || 0,
    },
    topCategoriesThisMonth: thisSpending.slice(0, 5),
    topCategoriesLastMonth: lastSpending.slice(0, 5),
    budgets: thisBudgets.map(b => ({
      category: b.category_name,
      budget: b.amount,
      spent: b.spent,
      remaining: Math.max(0, b.amount - b.spent),
      percentUsed: b.amount > 0 ? Math.round((b.spent / b.amount) * 100) : 0,
    })),
    recentTransactions: recentTx.slice(0, 10).map(t => ({
      date: t.date,
      description: t.description,
      amount: t.amount,
      type: t.type,
      category: t.category_name,
      account: t.account_name,
    })),
    accounts: accountsList.map(a => ({
      name: a.name,
      type: a.type,
      balance: a.balance,
    })),
    trends: {
      incomeVsLastMonth: thisMonth?.total_income && lastMonthData?.total_income
        ? (((thisMonth.total_income - lastMonthData.total_income) / lastMonthData.total_income) * 100).toFixed(1)
        : '0',
      expensesVsLastMonth: thisMonth?.total_expense && lastMonthData?.total_expense
        ? (((thisMonth.total_expense - lastMonthData.total_expense) / lastMonthData.total_expense) * 100).toFixed(1)
        : '0',
    },
  };
}

module.exports = {
  accounts,
  categories,
  transactions,
  budgets,
  getAISummary,
  getMonthlySummary,
  getSpendingByCategory,
  toYYYYMM,
};
