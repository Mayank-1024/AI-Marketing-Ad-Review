// ③ EXECUTION, planner. Turns the decision into ready-to-send payloads:
// a HubSpot task (who does what, by when) and a Slack Block Kit alert (what happened, why, the fix).
// The AI picks a channel *role* (urgent / review / digest); the real channel names come from
// "Configure Routing", so you can rename channels without touching the prompt.
const p = $input.first().json;
const d = p.decision;
const g = $('Gatekeeper: Validate & Normalize').first().json;
const e = g.event;
const cfg = $('Configure Routing').first().json;
const CHANNELS = { urgent: cfg.slack_channel_urgent, review: cfg.slack_channel_review, digest: cfg.slack_channel_digest };

const PRIORITY = { urgent: 'HIGH', high: 'HIGH', normal: 'MEDIUM', low: 'LOW' };
const EMOJI = { urgent: '🚀', high: '🔶', normal: '🟦', low: '⚪️' };
const DECISION_LABEL = { auto_approve: '✅ Auto-approved', needs_review: '👀 Needs review', block: '⛔️ Blocked' };
const due = Date.now() + Math.max(0, d.hubspot_task.due_in_days || 0) * 86400000;

const hubspot = { properties: {
  hs_task_subject: d.hubspot_task.title.slice(0, 250),
  hs_task_body: [d.hubspot_task.body, '', `Decision: ${d.decision} · Priority: ${d.priority} · Owner: ${d.owner_team}`,
    `Suggested fix: ${d.suggested_fix}`, `Event: ${e.event_id} (${g.idempotency_key})`].join('\n'),
  hs_timestamp: String(due),
  hs_task_priority: PRIORITY[d.priority],
  hs_task_status: 'NOT_STARTED',
  hs_task_type: 'TODO',
} };

const risks = d.risk_flags.length
  ? d.risk_flags.map((r) => `• *${r.type.replace(/_/g, ' ')}* (${r.severity}): “${r.evidence}”`).join('\n')
  : '• None found';
const slack = {
  channel: CHANNELS[d.slack_channel] || cfg.slack_channel_review,
  text: `${EMOJI[d.priority]} ${d.slack_message}`,
  unfurl_links: false,
  blocks: [
    { type: 'section', text: { type: 'mrkdwn', text: `${EMOJI[d.priority]} *${d.priority.toUpperCase()}* · ${DECISION_LABEL[d.decision]}\n${d.slack_message}` } },
    { type: 'section', fields: [
      { type: 'mrkdwn', text: `*Campaign*\n${e.campaign.company} · ${e.campaign.campaign_type} on ${e.campaign.channel}` },
      { type: 'mrkdwn', text: `*Owner*\n${d.owner_team}` },
      { type: 'mrkdwn', text: `*Headline*\n${e.headline.slice(0, 150)}` },
      { type: 'mrkdwn', text: `*Channel fit*\n${d.channel_fit.score}/5 - ${d.channel_fit.note.slice(0, 120)}` },
    ] },
    { type: 'section', text: { type: 'mrkdwn', text: `*Risk flags*\n${risks}\n\n*Suggested fix*\n${d.suggested_fix.slice(0, 500)}` } },
    { type: 'context', elements: [{ type: 'mrkdwn', text: `HubSpot task __TASK_ID__ · ${p.ai_ok ? `Routed by ${cfg.claude_model}` : '⚠️ Routed by fallback rules'} · confidence ${d.confidence} · ${e.event_id}` }] },
  ],
};

return [{ json: { ...p, live: e.mode === 'live', hubspot_payload: hubspot, slack_payload: slack } }];
