import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const body = await request.json();
    const { query } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    const context = {
      summary: { totalIncome: 0, totalExpenses: 0, balance: 0, transactionCount: 0, accountSummaries: [] },
      spendingByCategory: [],
      budgets: [],
      recentTransactions: [],
    };

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are a financial advisor. Be concise, practical, and encouraging.`,
        },
        {
          role: 'user',
          content: `Finance data: ${JSON.stringify(context)}\n\nQuestion: ${query}`,
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
