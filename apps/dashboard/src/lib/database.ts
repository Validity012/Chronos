import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), '../../data/finance.db');

export interface Transaction {
  id: number;
  amount: number;
  description: string;
  category: string;
  account: string;
  date: string;
  created_at: string;
}

export interface Budget {
  id: number;
  category: string;
  limit: number;
  period: 'monthly' | 'weekly' | 'daily';
  created_at: string;
}

export interface Account {
  id: number;
  name: string;
  type: 'personal' | 'business' | 'allowance';
  balance: number;
  created_at: string;
}

export interface FinanceSummary {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  transactionCount: number;
  accountSummaries: Array<{
    account: string;
    income: number;
    expenses: number;
    balance: number;
  }>;
}

class FinanceDatabase {
  private db: Database.Database | null = null;

  private getDb(): Database.Database {
    if (!this.db) {
      this.db = new Database(DB_PATH, {
        readonly: true,
        fileMustExist: false
      });
      this.db.exec('PRAGMA journal_mode = WAL;');
    }
    return this.db;
  }

  getRecentTransactions(limit: number = 50): Transaction[] {
    return this.getDb().prepare(`
      SELECT * FROM transactions
      ORDER BY date DESC, created_at DESC
      LIMIT ?
    `).all(limit) as Transaction[];
  }

  getTransactionsByDateRange(startDate: string, endDate: string): Transaction[] {
    return this.getDb().prepare(`
      SELECT * FROM transactions
      WHERE date BETWEEN ? AND ?
      ORDER BY date DESC, created_at DESC
    `).all(startDate, endDate) as Transaction[];
  }

  getTransactionsByCategory(category: string, limit: number = 100): Transaction[] {
    return this.getDb().prepare(`
      SELECT * FROM transactions
      WHERE category = ?
      ORDER BY date DESC, created_at DESC
      LIMIT ?
    `).all(category, limit) as Transaction[];
  }

  getFinanceSummary(): FinanceSummary {
    const totals = this.getDb().prepare(`
      SELECT
        SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as totalIncome,
        SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as totalExpenses,
        SUM(amount) as balance,
        COUNT(*) as transactionCount
      FROM transactions
    `).get() as any;

    const accountSummaries = this.getDb().prepare(`
      SELECT
        account,
        SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as income,
        SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as expenses,
        SUM(amount) as balance
      FROM transactions
      GROUP BY account
    `).all() as any[];

    return {
      totalIncome: totals.totalIncome || 0,
      totalExpenses: totals.totalExpenses || 0,
      balance: totals.balance || 0,
      transactionCount: totals.transactionCount || 0,
      accountSummaries: accountSummaries
    };
  }

  getSpendingByCategory(months: number = 3): Array<{category: string; amount: number}> {
    return this.getDb().prepare(`
      SELECT
        category,
        SUM(ABS(amount)) as amount
      FROM transactions
      WHERE amount < 0
        AND date >= date('now', '-' || ? || ' months')
      GROUP BY category
      ORDER BY amount DESC
    `).all(months) as Array<{category: string; amount: number}>;
  }

  getMonthlyTrend(months: number = 12): Array<{month: string; income: number; expenses: number}> {
    return this.getDb().prepare(`
      SELECT
        strftime('%Y-%m', date) as month,
        SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as income,
        SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as expenses
      FROM transactions
      WHERE date >= date('now', '-' || ? || ' months')
      GROUP BY strftime('%Y-%m', date)
      ORDER BY month ASC
    `).all(months) as Array<{month: string; income: number; expenses: number}>;
  }

  getBudgets(): Budget[] {
    return this.getDb().prepare(`
      SELECT * FROM budgets
      ORDER BY created_at DESC
    `).all() as Budget[];
  }

  getBudgetUsage(category: string, period: 'monthly' | 'weekly' | 'daily' = 'monthly'): {
    budget: number;
    spent: number;
    remaining: number;
    percentage: number;
  } {
    const budget = this.getDb().prepare(`
      SELECT limit FROM budgets
      WHERE category = ? AND period = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).get(category, period) as any;

    if (!budget) {
      return { budget: 0, spent: 0, remaining: 0, percentage: 0 };
    }

    let dateFilter = '';
    switch (period) {
      case 'daily':
        dateFilter = "date >= date('now', 'start of day')";
        break;
      case 'weekly':
        dateFilter = "date >= date('now', 'weekday 1', '-7 days')";
        break;
      case 'monthly':
      default:
        dateFilter = "date >= date('now', 'start of month')";
        break;
    }

    const spent = (this.getDb().prepare(`
      SELECT SUM(ABS(amount)) as spent
      FROM transactions
      WHERE category = ?
        AND amount < 0
        AND ${dateFilter}
    `).get(category) as any)?.spent || 0;

    const remaining = Math.max(0, budget.limit - spent);
    const percentage = budget.limit > 0 ? (spent / budget.limit) * 100 : 0;

    return {
      budget: budget.limit,
      spent,
      remaining,
      percentage
    };
  }

  searchTransactions(query: string, limit: number = 100): Transaction[] {
    const searchTerm = `%${query}%`;
    return this.getDb().prepare(`
      SELECT * FROM transactions
      WHERE description LIKE ? OR category LIKE ?
      ORDER BY date DESC, created_at DESC
      LIMIT ?
    `).all(searchTerm, searchTerm, limit) as Transaction[];
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

export const financeDb = new FinanceDatabase();

export async function getFinanceOverview() {
  const summary = financeDb.getFinanceSummary();
  const recentTransactions = financeDb.getRecentTransactions(10);
  const monthlyTrend = financeDb.getMonthlyTrend(6);
  const spendingByCategory = financeDb.getSpendingByCategory(3);

  return {
    summary,
    recentTransactions,
    monthlyTrend,
    spendingByCategory
  };
}

export async function getTransactionData(page: number = 1, pageSize: number = 50) {
  const offset = (page - 1) * pageSize;
  const transactions = financeDb.getRecentTransactions(pageSize + offset).slice(offset);
  const summary = financeDb.getFinanceSummary();

  return {
    transactions,
    total: summary.transactionCount,
    page,
    pageSize,
    totalPages: Math.ceil(summary.transactionCount / pageSize)
  };
}
