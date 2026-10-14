// ① GATEKEEPER (no AI): every ad variant is checked here before any AI call or action.
// Blocks: missing required fields, a failed upstream quality check, invalid dates.
// Builds the idempotency key (brief_id:variant_id) used to stop double-processing.
const body = $input.first().json.body ?? {};
const clean = (v) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim();
const REQUIRED = ['event_id', 'brief_id', 'variant_id', 'headline', 'body', 'cta', 'created_at'];

const reasons = [];
for (const field of REQUIRED) {
  if (body[field] === undefined || body[field] === null || clean(body[field]) === '') reasons.push(`missing_${field}`);
}
// Optional: if your content generator runs its own quality check, send its result here.
if (body.quality_check_passed === false || body.quality_check_passed === 'false') reasons.push('quality_check_failed');
if (body.created_at && isNaN(new Date(body.created_at).getTime())) reasons.push('invalid_created_at');
if (clean(body.headline).length > 300) reasons.push('headline_too_long');

const campaign = body.campaign ?? {};
const brief = body.brief ?? {};
const event = {
  event_id: clean(body.event_id),
  run_id: clean(body.run_id) || 'adhoc',
  mode: body.mode === 'dry_run' ? 'dry_run' : 'live',
  source_agent: clean(body.source_agent) || 'content_generator',
  brief_id: clean(body.brief_id),
  variant_id: clean(body.variant_id),
  headline: clean(body.headline),
  body: clean(body.body),
  cta: clean(body.cta),
  product: clean(body.product),
  quality_score: Number(body.quality_score) || null,
  campaign_owner: clean(body.campaign_owner),
  created_at: clean(body.created_at),
  campaign: {
    company: clean(campaign.company), channel: clean(campaign.channel), campaign_type: clean(campaign.campaign_type),
    audience: clean(campaign.audience), conversion_rate: Number(campaign.conversion_rate) || null,
    roi: Number(campaign.roi) || null, engagement_score: Number(campaign.engagement_score) || null,
  },
  brief: { title: clean(brief.title), summary: clean(brief.summary).slice(0, 600), source: clean(brief.source), url: clean(brief.url), published_date: clean(brief.published_date) },
};

return [{ json: {
  gate_passed: reasons.length === 0,
  gate_reasons: reasons,
  idempotency_key: `${event.brief_id}:${event.variant_id}`,
  received_at_ms: Date.now(),
  event,
} }];
