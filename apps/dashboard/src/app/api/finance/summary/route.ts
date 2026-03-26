import { NextRequest, NextResponse } from 'next/server';
import { financeDb } from '@/lib/database';

export async function GET(): Promise<NextResponse> {
  try {
    const summary = financeDb.getFinanceSummary();
    const recentTransactions = financeDb.getRecentTransactions(20);
    const spendingByCategory = financeDb.getSpendingByCategory(3);
    const budgets = financeDb.getBudgets();

    const budgetUsage = budgets.map(b => {
      const usage = financeDb.getBudgetUsage(b.category, b.period);
      return {
        category: b.category,
        icon: getCategoryIcon(b.category),
        limit: b.limit,
        spent: usage.spent,
        remaining: usage.remaining,
        percentage: usage.percentage,
        period: b.period,
      };
    });

    return NextResponse.json({
      summary,
      recentTransactions: recentTransactions.map(t => ({
        id: t.id,
        date: t.date,
        description: t.description,
        amount: t.amount,
        category: t.category,
        account: t.account,
      })),
      spendingByCategory,
      budgetUsage,
    });
  } catch (error: any) {
    console.error('Finance summary error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch finance summary' },
      { status: 500 }
    );
  }
}

function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    'Food & Dining': '🍽️', 'Groceries': '🛒', 'Transport': '🚗',
    'Entertainment': '🎬', 'Shopping': '🛍️', 'Health': '💊',
    'Bills & Utilities': '⚡', 'Education': '📚', 'Personal Care': '🧴',
    'Home': '🏠', 'Business Expense': '💼', 'Subscriptions': '📱',
    'Travel': '✈️', 'Gifts': '🎁', 'Charity': '💝', 'Other': '📦',
    'Salary': '💰', 'Freelance': '💻', 'Business Income': '📈',
    'Allowance': '👨‍👩‍👧', 'Investment': '📊', 'Refund': '↩️',
  };
  return icons[category] || '📦';
}
