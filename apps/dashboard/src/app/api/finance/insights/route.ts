import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { financeDb } from '@/lib/database';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { query } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    // Get finance context for the AI
    const summary = financeDb.getFinanceSummary();
    const spendingByCategory = financeDb.getSpendingByCategory(3);
    const budgets = financeDb.getBudgets();
    const recentTx = financeDb.getRecentTransactions(10);

    const budgetUsage = budgets.map(b => {
      const usage = financeDb.getBudgetUsage(b.category, b.period);
      return { category: b.category, budget: b.limit, spent: usage.spent, percentUsed: usage.percentage };
    });

    const context = {
      summary,
      spendingByCategory: spendingByCategory.slice(0, 8),
      budgets: budgetUsage,
      recentTransactions: recentTx.slice(0, 5).map((t: any) => ({
        date: t.date, description: t.description, amount: t.amount, category: t.category,
      })),
    };

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are a financial advisor analyzing personal finance data. Be concise, practical, and encouraging. Provide specific actionable advice. Format your response with bullet points or numbered lists when giving recommendations.`,
        },
        {
          role: 'user',
          content: `Finance data: ${JSON.stringify(context, null, 2)}\n\nQuestion: ${query}`,
        },
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.7,
      max_tokens: 800,
    });

    const insight = completion.choices[0]?.message?.content;
    if (!insight) throw new Error('No response from Groq');

    return NextResponse.json({ insight: insight.trim() });
  } catch (error: any) {
    console.error('Finance insights error:', error);
    if (error.status === 429) {
      return NextResponse.json({ error: 'Rate limit exceeded. Try again later.' }, { status: 429 });
    }
    return NextResponse.json({ error: 'Failed to generate insights' }, { status: 500 });
  }
}
