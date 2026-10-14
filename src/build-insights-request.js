// REPORT ②: Insights Agent request. Claude looks across the whole batch for patterns
// (recurring risks, overloaded teams, weak channels) and recommends what to change upstream.
const s = $input.first().json;
const cfg = $('Configure Report').first().json;
const { rows, ...stats } = s;
const SCHEMA = { type: 'object', additionalProperties: false, required: ['headline', 'patterns', 'recommendations', 'watchlist'], properties: {
  headline: { type: 'string' },
  patterns: { type: 'array', items: { type: 'string' } },
  recommendations: { type: 'array', items: { type: 'string' } },
  watchlist: { type: 'array', items: { type: 'string' } },
} };
return [{ json: { request_body: {
  model: cfg.claude_model,
  max_tokens: 1500,
  system: 'You are the Insights Agent for an ad-copy review pipeline. You receive statistics for a batch of AI-routed ad variants. Write for a marketing director: headline = one sentence on what this batch tells us; patterns = 3 specific, number-backed observations; recommendations = 3 concrete changes to the content generator prompts or team process; watchlist = up to 3 items that need attention this week. Use only the numbers provided.',
  output_config: { format: { type: 'json_schema', schema: SCHEMA } },
  messages: [{ role: 'user', content: `<batch_stats>\n${JSON.stringify(stats, null, 1)}\n</batch_stats>` }],
} } }];
