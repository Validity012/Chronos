import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';

export interface GroqInsightRequest {
  query: string;
  context: 'finance' | 'tasks' | 'lms' | 'general';
  data?: any;
}

export interface GroqInsightResponse {
  insight: string;
  actionable_items?: string[];
  confidence_score?: number;
  error?: string;
}

/**
 * POST /api/groq - Generate AI insights using Groq
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Validate API key
    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json(
        { error: 'Groq API key not configured' },
        { status: 500 }
      );
    }

    // Parse request body
    const body: GroqInsightRequest = await request.json();
    
    if (!body.query || typeof body.query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required and must be a string' },
        { status: 400 }
      );
    }

    if (body.query.length > 2000) {
      return NextResponse.json(
        { error: 'Query is too long (max 2000 characters)' },
        { status: 400 }
      );
    }

    // Generate system prompt based on context
    const systemPrompt = getSystemPrompt(body.context);
    
    // Prepare user prompt with context data
    const userPrompt = formatUserPrompt(body.query, body.data, body.context);

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: userPrompt
        }
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.7,
      max_tokens: 1024,
      top_p: 0.9,
    });

    const insight = completion.choices[0]?.message?.content;
    
    if (!insight) {
      throw new Error('No response from Groq API');
    }

    // Parse actionable items if present
    const actionableItems = extractActionableItems(insight);
    
    // Calculate confidence score based on response length and structure
    const confidenceScore = calculateConfidenceScore(insight);

    const response: GroqInsightResponse = {
      insight: insight.trim(),
      actionable_items: actionableItems,
      confidence_score: confidenceScore
    };

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('Groq API Error:', error);

    // Handle rate limiting
    if (error.status === 429) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      );
    }

    // Handle API key issues
    if (error.status === 401) {
      return NextResponse.json(
        { error: 'Invalid API credentials' },
        { status: 500 }
      );
    }

    // Handle model/service unavailable
    if (error.status === 503) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again later.' },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to generate insight. Please try again.' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/groq - Health check endpoint
 */
export async function GET(): Promise<NextResponse> {
  const isConfigured = !!process.env.GROQ_API_KEY;
  
  return NextResponse.json({
    status: 'ok',
    configured: isConfigured,
    model: 'llama-3.3-70b-versatile'
  });
}

/**
 * Generate system prompt based on context
 */
function getSystemPrompt(context: string): string {
  const basePrompt = `You are an AI assistant specialized in providing actionable insights for personal productivity and life management. You are concise, practical, and focus on specific actionable advice.`;

  switch (context) {
    case 'finance':
      return `${basePrompt}

You are a financial advisor analyzing personal finance data. Provide insights about:
- Spending patterns and trends
- Budget optimization opportunities
- Saving recommendations
- Financial goal progress
- Expense categorization insights

Always be encouraging but realistic. Suggest specific actionable steps.`;

    case 'tasks':
      return `${basePrompt}

You are a productivity coach analyzing task and project data. Provide insights about:
- Task prioritization and time management
- Productivity patterns and bottlenecks
- Goal achievement strategies
- Work-life balance optimization
- Deadline management

Focus on practical, implementable suggestions for better task management.`;

    case 'lms':
      return `${basePrompt}

You are an academic advisor analyzing student learning data. Provide insights about:
- Study schedule optimization
- Assignment prioritization
- Grade improvement strategies
- Time management for coursework
- Learning efficiency tips

Be supportive and focus on academic success strategies.`;

    case 'general':
    default:
      return `${basePrompt}

You are a life coach providing holistic insights across finance, productivity, and learning. Analyze the provided data to give balanced advice that considers all aspects of personal development and life management.`;
  }
}

/**
 * Format user prompt with context data
 */
function formatUserPrompt(query: string, data: any, context: string): string {
  let prompt = query;

  if (data) {
    prompt += '\n\nContext data:\n';
    
    // Safely stringify data with size limit
    try {
      const dataStr = JSON.stringify(data, null, 2);
      if (dataStr.length > 3000) {
        // Truncate if too large
        prompt += dataStr.substring(0, 3000) + '\n... (data truncated)';
      } else {
        prompt += dataStr;
      }
    } catch (error) {
      prompt += '[Data could not be serialized]';
    }
  }

  // Add context-specific instructions
  switch (context) {
    case 'finance':
      prompt += '\n\nPlease analyze the financial data and provide 3-5 specific, actionable insights. Focus on practical steps the user can take to improve their financial situation.';
      break;
    case 'tasks':
      prompt += '\n\nPlease analyze the task data and provide 3-5 specific recommendations for better productivity and task management.';
      break;
    case 'lms':
      prompt += '\n\nPlease analyze the academic data and provide 3-5 specific study and academic success recommendations.';
      break;
    default:
      prompt += '\n\nPlease provide 3-5 specific, actionable insights based on the data provided.';
  }

  return prompt;
}

/**
 * Extract actionable items from response
 */
function extractActionableItems(insight: string): string[] {
  const lines = insight.split('\n');
  const actionableItems: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    
    // Look for lines that start with numbers, bullets, or action words
    if (
      /^(\d+[\.\)]|\*|\-|\•)/.test(trimmed) ||
      /^(Consider|Try|Start|Stop|Reduce|Increase|Set|Create|Review|Track)/i.test(trimmed)
    ) {
      // Clean up the line
      const cleaned = trimmed.replace(/^(\d+[\.\)]|\*|\-|\•)\s*/, '').trim();
      if (cleaned.length > 10 && cleaned.length < 200) {
        actionableItems.push(cleaned);
      }
    }
  }

  return actionableItems.slice(0, 5); // Limit to 5 items
}

/**
 * Calculate confidence score based on response quality
 */
function calculateConfidenceScore(insight: string): number {
  let score = 50; // Base score
  
  // Length indicates thoroughness
  if (insight.length > 200) score += 10;
  if (insight.length > 500) score += 10;
  
  // Specific numbers or data references indicate analysis
  if (/\$\d+|\d+%|\d+\s+(day|week|month|year)s?/i.test(insight)) score += 15;
  
  // Action words indicate practicality
  const actionWords = ['recommend', 'suggest', 'consider', 'try', 'start', 'stop', 'increase', 'decrease', 'set', 'create'];
  const actionWordCount = actionWords.filter(word => 
    insight.toLowerCase().includes(word)
  ).length;
  score += Math.min(actionWordCount * 3, 15);
  
  // Structure indicates organization
  if (/^\d+[\.\)]|^\*|\-/m.test(insight)) score += 10;
  
  return Math.min(score, 95); // Cap at 95%
}
