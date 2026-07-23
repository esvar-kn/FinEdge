import config from '../config/index.js';
import TransactionService from './transactionService.js';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const REQUEST_TIMEOUT_MS = 30_000;

const SYSTEM_PROMPT = `You are the budgeting coach inside FinEdge, a personal finance tracker.
You receive a JSON snapshot of one user's finances: a summary (income, expenses, net balance,
per-category expense breakdown, budget status) and a per-month trend.

Write practical spending and budgeting observations: where money is going, how spending is
trending, which budgets are at risk, and concrete habits that would improve savings.
Keep it concise — a short opening sentence plus 3-6 bullet points. Refer to amounts as plain
numbers without assuming a currency. You are not a licensed financial advisor: never recommend
specific investments, securities, or financial products, and say so briefly if asked.`;

class AiInsightsService {
  /**
   * Generates narrative financial advice with the Groq API (OpenAI-compatible
   * chat completions, free tier available). Without a GROQ_API_KEY (or when
   * the API call fails) it falls back to the built-in rule-based insights so
   * the endpoint always answers.
   * @param {string} userId
   * @param {string} [month] YYYY-MM
   * @returns {Promise<Object>}
   */
  static async getAdvice(userId, month) {
    const summary = await TransactionService.getFinancialSummary(userId, month);
    const trend = await TransactionService.getMonthlyTrend(userId, 6);

    if (!config.groqApiKey) {
      return {
        source: 'rules',
        note: 'Set GROQ_API_KEY in .env to enable AI-generated insights (free key at console.groq.com).',
        insights: summary.insights
      };
    }

    try {
      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.groqApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: config.aiModel,
          max_tokens: 1024,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            {
              role: 'user',
              content: JSON.stringify({ period: month || 'all-time', summary, trend })
            }
          ]
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Groq API error ${response.status}: ${errorBody.slice(0, 200)}`);
      }

      const data = await response.json();
      const advice = data.choices?.[0]?.message?.content?.trim();

      if (!advice) {
        return { source: 'rules', note: 'AI returned no text; showing rule-based insights.', insights: summary.insights };
      }

      return { source: 'ai', model: data.model, advice };
    } catch (error) {
      // Any failure (bad key, rate limit, timeout, network) degrades the same
      // way for a personal tool: log and fall back to the rule engine.
      const reason = error.name === 'TimeoutError'
        ? `Groq API request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`
        : error.message;
      console.error('AI insights fallback:', reason);
      return { source: 'rules', note: reason, insights: summary.insights };
    }
  }
}

export default AiInsightsService;
