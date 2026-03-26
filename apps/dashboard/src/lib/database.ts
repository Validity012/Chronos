import Database from 'better-sqlite3';
import path from 'path';

// Path to shared finance database
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
  private db: Database.Database;

  constructor() {
    this.db = new Database(DB_PATH, { 
      readonly: true,
      fileMustExist: true 
    });
    
    // Enable WAL mode for better performance
    this.db.exec('PRAGMA journal_mode = WAL;');
  }

  /**
   * Get recent transactions
   */
  getRecentTransactions(limit: number = 50): Transaction[] {
    const stmt = this.db.prepare(`
      SELECT * FROM transactions 
      ORDER BY date DESC, created_at DESC 
      LIMIT ?
    `);
    return stmt.all(limit) as Transaction[];
  }

  /**
   * Get transactions by date range
   */
  getTransactionsByDateRange(startDate: string, endDate: string): Transaction[] {
    const stmt = this.db.prepare(`
      SELECT * FROM transactions 
      WHERE date BETWEEN ? AND ?
      ORDER BY date DESC, created_at DESC
    `);
    return stmt.all(startDate, endDate) as Transaction[];
  }

  /**
   * Get transactions by category
   */
  getTransactionsByCategory(category: string, limit: number = 100): Transaction[] {
    const stmt = this.db.prepare(`
      SELECT * FROM transactions 
      WHERE category = ?
      ORDER BY date DESC, created_at DESC 
      LIMIT ?
    `);
    return stmt.all(category, limit) as Transaction[];
  }

  /**
   * Get financial summary
   */
  getFinanceSummary(): FinanceSummary {
    // Get overall totals
    const totalsStmt = this.db.prepare(`
      SELECT 
        SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as totalIncome,
        SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as totalExpenses,
        SUM(amount) as balance,
        COUNT(*) as transactionCount
      FROM transactions
    `);
    const totals = totalsStmt.get() as any;

    // Get account summaries
    const accountStmt = this.db.prepare(`
      SELECT 
        account,
        SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as income,
        SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as expenses,
        SUM(amount) as balance
      FROM transactions 
      GROUP BY account
    `);
    const accountSummaries = accountStmt.all() as any[];

    return {
      totalIncome: totals.totalIncome || 0,
      totalExpenses: totals.totalExpenses || 0,
      balance: totals.balance || 0,
      transactionCount: totals.transactionCount || 0,
      accountSummaries: accountSummaries
    };
  }

  /**
   * Get spending by category (for charts)
   */
  getSpendingByCategory(months: number = 3): Array<{category: string; amount: number}> {
    const stmt = this.db.prepare(`
      SELECT 
        category,
        SUM(ABS(amount)) as amount
      FROM transactions 
      WHERE amount < 0 
        AND date >= date('now', '-' || ? || ' months')
      GROUP BY category
      ORDER BY amount DESC
    `);
    return stmt.all(months) as Array<{category: string; amount: number}>;
  }

  /**
   * Get monthly spending trend
   */
  getMonthlyTrend(months: number = 12): Array<{month: string; income: number; expenses: number}> {
    const stmt = this.db.prepare(`
      SELECT 
        strftime('%Y-%m', date) as month,
        SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as income,
        SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as expenses
      FROM transactions 
      WHERE date >= date('now', '-' || ? || ' months')
      GROUP BY strftime('%Y-%m', date)
      ORDER BY month ASC
    `);
    return stmt.all(months) as Array<{month: string; income: number; expenses: number}>;
  }

  /**
   * Get current budgets
   */
  getBudgets(): Budget[] {
    const stmt = this.db.prepare(`
      SELECT * FROM budgets 
      ORDER BY created_at DESC
    `);
    return stmt.all() as Budget[];
  }

  /**
   * Get budget usage for current period
   */
  getBudgetUsage(category: string, period: 'monthly' | 'weekly' | 'daily' = 'monthly'): {
    budget: number;
    spent: number;
    remaining: number;
    percentage: number;
  } {
    // Get budget limit
    const budgetStmt = this.db.prepare(`
      SELECT limit FROM budgets 
      WHERE category = ? AND period = ?
      ORDER BY created_at DESC
      LIMIT 1
    `);
    const budget = budgetStmt.get(category, period) as any;

    if (!budget) {
      return { budget: 0, spent: 0, remaining: 0, percentage: 0 };
    }

    // Calculate date range based on period
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

    // Get spending for period
    const spentStmt = this.db.prepare(`
      SELECT SUM(ABS(amount)) as spent
      FROM transactions 
      WHERE category = ? 
        AND amount < 0 
        AND ${dateFilter}
    `);
    const spent = (spentStmt.get(category) as any)?.spent || 0;

    const remaining = Math.max(0, budget.limit - spent);
    const percentage = budget.limit > 0 ? (spent / budget.limit) * 100 : 0;

    return {
      budget: budget.limit,
      spent,
      remaining,
      percentage
    };
  }

  /**
   * Search transactions
   */
  searchTransactions(query: string, limit: number = 100): Transaction[] {
    const stmt = this.db.prepare(`
      SELECT * FROM transactions 
      WHERE description LIKE ? OR category LIKE ?
      ORDER BY date DESC, created_at DESC 
      LIMIT ?
    `);
    const searchTerm = `%${query}%`;
    return stmt.all(searchTerm, searchTerm, limit) as Transaction[];
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}

// Export singleton instance
export const financeDb = new FinanceDatabase();

// Utility functions
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
