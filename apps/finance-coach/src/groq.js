'use strict';
const Groq = require('groq-sdk');

const client = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';


const PARSE_PROMPT = `You are a personal finance assistant. Parse the user's message and extract transaction details.

Return a JSON object with these fields:
- action: "expense" | "income" | "transfer" | "allowance" | "query" | "budget" | "goal" | "unknown"
- amount: number (positive, in user's currency)
- description: string (what was it for)
- category: string (best matching category from the list below, or "Other")
- account: "Personal" | "Business" | "Family Allowance" | "auto"
- date: ISO date string (YYYY-MM-DD) or null for today
- tags: array of strings (optional keywords)
- intent: one sentence explaining what the user wants

IMPORTANT: 
- If the user is asking a question (how much, what, show, tell me, etc.) → action = "query"
- If the user is describing spending → action = "expense"
- If the user is describing earning/receiving money → action = "income"
- If user says "allowance for [name]" → action = "allowance"
- Always extract the AMOUNT - if no amount found, set amount to 0

Available expense categories: Food & Dining, Groceries, Transport, Entertainment, Shopping, Health, Bills & Utilities, Education, Personal Care, Home, Business Expense, Subscriptions, Travel, Gifts, Charity, Other
Available income categories: Salary, Freelance, Business Income, Allowance, Investment, Gift Received, Refund, Other Income
Available accounts: Personal, Business, Family Allowance

Return ONLY valid JSON, no markdown, no explanation.`;

const INSIGHT_PROMPT = `You are a personal finance coach. Analyze the user's financial data and give actionable, encouraging advice.

Context:
- Current month spending by category
- Budget vs actual
- Recent transactions
- Top spending areas

Give:
1. A brief analysis of their spending patterns
2. 2-3 specific, actionable tips
3. One positive observation
4. Any red flags

Be conversational, warm, and motivating — NOT preachy or guilt-trippy. Focus on progress, not perfection.

Keep it concise — 3-4 short paragraphs max.`;

const COACH_PROMPT = `You are Finley, a friendly personal finance coach. You help users understand their money, set goals, and build better spending habits.

Guidelines:
- Be warm, conversational, and encouraging
- Give specific numbers from their data when relevant
- Explain things simply, no jargon
- Celebrate wins, even small ones
- Gently redirect without shame
- Answer in the same language the user uses
- Keep responses concise but helpful

You have access to their transaction history, budgets, and spending summaries. Use that data to give personalized advice.`;



/**
 * Parse natural language into structured transaction data
 * @param {string} message - User's raw message
 * @param {string} userLang - Language code (en, es, etc.)
 * @returns {Promise<Object>} Parsed transaction data
 */
async function parseTransaction(message, userLang = 'en') {
  const completion = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: PARSE_PROMPT },
      { role: 'user', content: message },
    ],
    temperature: 0.1,
    max_tokens: 500,
    response_format: { type: 'json_object' },
  });

  const text = completion.choices[0]?.message?.content || '{}';
  try {
    return JSON.parse(text);
  } catch {
    return { action: 'unknown', amount: 0, description: message };
  }
}

/**
 * Generate spending insights and coaching advice
 * @param {Object} data - Financial summary data
 * @returns {Promise<string>} Formatted insight text
 */
async function generateInsights(data) {
  const completion = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: INSIGHT_PROMPT },
      { role: 'user', content: JSON.stringify(data) },
    ],
    temperature: 0.7,
    max_tokens: 800,
  });

  return completion.choices[0]?.message?.content || 'I analyzed your finances but ran into an issue. Try again!';
}

/**
 * Answer a natural language query about finances
 * @param {string} query - User's question
 * @param {Object} context - Financial data for context
 * @returns {Promise<string>} Answer
 */
async function answerQuery(query, context) {
  const completion = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: COACH_PROMPT },
      { role: 'user', content: `User asks: "${query}"\n\nTheir financial data:\n${JSON.stringify(context, null, 2)}` },
    ],
    temperature: 0.6,
    max_tokens: 600,
  });

  return completion.choices[0]?.message?.content || 'I\'m not sure how to answer that. Try rephrasing!';
}

/**
 * Categorize a transaction description
 * @param {string} description - Transaction description
 * @returns {Promise<string>} Best category name
 */
async function autoCategorize(description) {
  const completion = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: `Given this transaction description, return the best matching category from this list: Food & Dining, Groceries, Transport, Entertainment, Shopping, Health, Bills & Utilities, Education, Personal Care, Home, Business Expense, Subscriptions, Travel, Gifts, Charity, Other, Salary, Freelance, Business Income, Allowance, Investment, Gift Received, Refund, Other Income. Return ONLY the category name, nothing else.` },
      { role: 'user', content: description },
    ],
    temperature: 0.1,
    max_tokens: 30,
  });

  return (completion.choices[0]?.message?.content || 'Other').trim();
}

module.exports = {
  parseTransaction,
  generateInsights,
  answerQuery,
  autoCategorize,
};
