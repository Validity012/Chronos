import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    summary: { totalIncome: 0, totalExpenses: 0, balance: 0, transactionCount: 0, accountSummaries: [] },
    recentTransactions: [],
    spendingByCategory: [],
    budgetUsage: [],
  });
}
