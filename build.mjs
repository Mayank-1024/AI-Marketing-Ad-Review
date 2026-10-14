// Builds the n8n Creator Portal template "Review AI ad copy with Claude and route it to HubSpot
// and Slack", a generalized copy of the Madison Action Layer workflow:
//  - Madison / Popper names removed; the upstream quality check is optional
//  - two Set Fields nodes: "Configure Routing" (model, Slack channels, prices) and
//    "Configure Report" (email, lookback, digest channel); fixes the live workflow's
//    misnamed email field and the leftover run_id filter
//  - no credentials, no spreadsheet ID; data table renamed ad_copy_review_log
//  - yellow description sticky, neutral step stickies, a sample-request sticky
// Usage: node build.mjs  -> workflow/
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { houseStickies } from './house-style.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const TITLE = 'Review AI ad copy with Claude and route it to HubSpot and Slack';
const TABLE = 'ad_copy_review_log';
const js = (f) => readFileSync(join(here, 'src', f), 'utf8');
const uuid = (name) => {
  const h = createHash('sha1').update(`tpl-review:${name}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
const YELLOW = 1, NEUTRAL = 7;
const RETRY = { retryOnFail: true, maxTries: 3, waitBetweenTries: 5000, onError: 'continueRegularOutput' };

const code = (name, file, position) => ({
  id: uuid(name), name, type: 'n8n-nodes-base.code', typeVersion: 2, position,
  parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: js(file) }
});
const ifTrue = (name, position, left, operator) => ({
  id: uuid(name), name, type: 'n8n-nodes-base.if', typeVersion: 2.2, position,
  parameters: { conditions: {
    options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
    conditions: [{ id: uuid(`cond:${name}`), leftValue: left, rightValue: '', operator }],
    combinator: 'and' }, options: {} }
});
const BOOL_TRUE = { type: 'boolean', operation: 'true', singleValue: true };
const anthropic = (name, position) => ({
  id: uuid(name), name, type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position,
  parameters: {
    method: 'POST', url: 'https://api.anthropic.com/v1/messages',
    authentication: 'predefinedCredentialType', nodeCredentialType: 'anthropicApi',
    sendHeaders: true, headerParameters: { parameters: [{ name: 'anthropic-version', value: '2023-06-01' }] },
    sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify($json.request_body) }}',
    options: { timeout: 60000 }
  }, ...RETRY
});
const slackPost = (name, position, jsonBody) => ({
  id: uuid(name), name, type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position,
  parameters: {
    method: 'POST', url: 'https://slack.com/api/chat.postMessage',
    authentication: 'predefinedCredentialType', nodeCredentialType: 'slackApi',
    sendBody: true, specifyBody: 'json', jsonBody, options: { timeout: 30000 }
  }, ...RETRY
});
const table = () => ({ __rl: true, mode: 'name', value: TABLE });
const assign = (name, type, value) => ({ id: uuid(`cfg:${name}`), name, type, value });
const setNode = (name, position, assignments, extra = {}) => ({
  id: uuid(name), name, type: 'n8n-nodes-base.set', typeVersion: 3.4, position,
  parameters: { assignments: { assignments }, ...extra, options: {} }
});
const sticky = (name, position, width, height, color, content) => ({
  id: uuid(name), name, type: 'n8n-nodes-base.stickyNote', typeVersion: 1, position, parameters: { content, width, height, color }
});

const LOG_COLUMNS = [
  ['idempotency_key', 'string'], ['event_id', 'string'], ['run_id', 'string'], ['mode', 'string'], ['status', 'string'],
  ['decision', 'string'], ['priority', 'string'], ['owner_team', 'string'], ['slack_channel', 'string'], ['ai_status', 'string'],
  ['risk_count', 'number'], ['headline', 'string'], ['summary', 'string'], ['hubspot_task_id', 'string'], ['slack_ok', 'boolean'],
  ['cost_usd', 'number'], ['latency_ms', 'number'], ['detail_json', 'string']
];

const SAMPLE = `{
  "event_id": "evt-001",
  "run_id": "test-batch",
  "mode": "dry_run",
  "brief_id": "brief-42",
  "variant_id": "v1",
  "headline": "Run further in the new Aurora 2",
  "body": "Lighter cushioning for daily miles. Free returns for 30 days.",
  "cta": "Shop the Aurora 2",
  "product": "Aurora 2 running shoe",
  "quality_check_passed": true,
  "quality_score": 0.86,
  "created_at": "2026-10-12T09:00:00Z",
  "campaign": {
    "company": "Acme Running",
    "channel": "Instagram",
    "campaign_type": "Product launch",
    "audience": "Runners 25-40",
    "conversion_rate": 0.08,
    "roi": 5.2,
    "engagement_score": 7
  },
  "brief": {
    "title": "Fall running season starts",
    "summary": "Search interest in running shoes rises in October.",
    "source": "Industry newsletter",
    "published_date": "2026-10-10"
  }
}`;

const DESCRIPTION = `# ${TITLE}

## Who's it for
Marketing ops teams that generate ad copy with AI and need every variant checked, prioritized and handed to the right owner, without copy-pasting into a CRM.

## How it works
1. Your content tool posts each ad variant to the **Webhook**. A rules-only **Gatekeeper** blocks broken payloads and duplicates.
2. **Claude** checks channel fit and risky claims. It returns a strict JSON decision (approve, review or block) with a priority, an owner team and a suggested fix. Unusable AI answers fall back to fixed rules.
3. In live mode it creates a **HubSpot** task and posts a **Slack** alert. Every outcome is logged to an n8n **Data Table**.
4. Every evening, Claude turns the log into a **Gmail** report, a Slack digest and **Google Sheets** rows.

## How to set up
1. Click **Run Report Now** once. It creates the action log Data Table.
2. Add these credentials: Header Auth, Anthropic, HubSpot app token, Slack, Gmail and Google Sheets.
3. Edit **Configure Routing** and **Configure Report**, then pick a spreadsheet in **Append Decisions to Google Sheet**.
4. Send the sample request with \`"mode": "dry_run"\`, then switch to \`"live"\`.

## Requirements
- n8n with Data Tables
- Anthropic API key
- HubSpot private app
- Slack bot with \`chat:write\`
- Gmail and Google Sheets accounts

## How to customize the workflow
- **Teams, channel rules and risk levels:** edit them in **Build Claude Request**. Keep the enums in **Validate AI Decision** in sync.
- **Report time:** change it in **Daily 6 pm Digest**.`;

const nodes = [
  sticky('Template description', [2140, 1520], 760, 1260, YELLOW, DESCRIPTION),
  sticky('Sample request', [2140, 2820], 760, 860, NEUTRAL,
`## Sample request
Send this from Postman or curl to the **Receive Ad Variant** test URL. Add the header you defined in the Header Auth credential.

\`\`\`json
${SAMPLE}
\`\`\`

**Required:** \`event_id\`, \`brief_id\`, \`variant_id\`, \`headline\`, \`body\`, \`cta\`, \`created_at\`.

Everything else is optional context that improves the decision. Sending \`"quality_check_passed": false\` blocks the variant before any AI call.`),
  sticky('Step 1: Gatekeeper', [2940, 1520], 1110, 760, NEUTRAL,
`## ① Receive and gatekeep (no AI)
**Receive Ad Variant** accepts a POST (Header Auth). **Configure Routing** holds the model, Slack channel names and token prices.

The **Gatekeeper** checks required fields, dates and the optional upstream quality check. It builds the idempotency key \`brief_id:variant_id\`.

- **Bad payload:** logged as *blocked* and answered with **422**.
- **Already processed:** answered with *duplicate*, and nothing new is created.`),
  sticky('Step 2: Routing agent', [4096, 1520], 900, 760, NEUTRAL,
`## ② Routing agent (Claude)
Claude scores channel fit, flags risks with the exact words, and picks:
- a decision: auto-approve, review or block
- a priority
- an owner team
- a Slack channel role
- a suggested fix

The reply must match a strict JSON schema. Every request retries 3 times.

**Validate AI Decision** rejects API errors, refusals, truncated or malformed JSON and out-of-range values. When that happens, the **Rule-based Fallback Router** routes the variant and says so.`),
  sticky('Step 3: Execute and log', [5040, 1520], 1160, 760, NEUTRAL,
`## ③ Execute and log
**Plan Actions** builds the HubSpot task and a Slack Block Kit alert. It maps the AI's channel role (urgent / review / digest) to your real channel names.

- **Live mode:** creates the task, then posts the alert. Each call retries 3 times.
- **Dry-run mode:** skips both, which is useful for tests.

**Assemble Outcome** records what actually happened, including partial failures, in the \`${TABLE}\` Data Table. Then the sender gets the result.`),
  sticky('Step 4: Daily insights report', [3152, 2352], 2480, 560, NEUTRAL,
`## ④ Daily insights report
Runs every day at 18:00, or on demand with **Run Report Now**. **Configure Report** sets the email recipient, lookback window, digest channel and model.

The report reads the action log and computes decisions, priorities, teams, risk flags, latency and AI cost. Claude then writes patterns, recommendations and a watchlist, which are delivered as:
- an HTML email (Gmail)
- a Slack digest
- rows in Google Sheets
- a downloadable HTML file

**Ensure Action Log Table** creates the log table on the first run.\n\nLeave \`run_id\` empty to report on the last \`lookback_hours\`. Set it to report on a single batch.`),
  sticky('First run', [3152, 2960], 700, 300, NEUTRAL,
`## First run
Click **Run Report Now** once after importing. **Ensure Action Log Table** creates the \`${TABLE}\` Data Table that the webhook branch logs to. If the table already exists, the step is skipped, so the scheduled digest keeps it in place.

Do this before you send the first webhook request.`),

  { id: uuid('Receive Ad Variant'), name: 'Receive Ad Variant', type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [2980, 1904],
    parameters: { httpMethod: 'POST', path: 'ad-copy-review', authentication: 'headerAuth', responseMode: 'responseNode', options: {} },
    webhookId: uuid('webhook:ad-copy-review') },
  setNode('Configure Routing', [3200, 1904], [
    assign('claude_model', 'string', 'claude-haiku-4-5'),
    assign('slack_channel_urgent', 'string', 'campaign-urgent'),
    assign('slack_channel_review', 'string', 'campaign-review'),
    assign('slack_channel_digest', 'string', 'campaign-digest'),
    assign('price_input_per_million_tokens', 'number', 1),
    assign('price_output_per_million_tokens', 'number', 5)
  ], { includeOtherFields: true, include: 'all' }),
  code('Gatekeeper: Validate & Normalize', 'gatekeeper.js', [3424, 1904]),
  ifTrue('Passed Gatekeeper?', [3632, 1904], '={{ $json.gate_passed }}', BOOL_TRUE),
  code('Blocked Outcome', 'blocked-outcome.js', [3856, 2112]),
  { id: uuid('Check Already Processed'), name: 'Check Already Processed', type: 'n8n-nodes-base.dataTable', typeVersion: 1.1,
    position: [3856, 1824],
    parameters: { operation: 'get', dataTableId: table(),
      filters: { conditions: [{ keyName: 'idempotency_key', keyValue: '={{ $json.idempotency_key }}' }] }, limit: 1 },
    alwaysOutputData: true, onError: 'continueRegularOutput' },
  ifTrue('Already Processed?', [4080, 1824], '={{ $json.idempotency_key }}', { type: 'string', operation: 'notEmpty', singleValue: true }),
  code('Duplicate Outcome', 'duplicate-outcome.js', [4304, 1664]),
  code('Build Claude Request', 'build-claude-request.js', [4304, 1888]),
  anthropic('Routing Agent (Claude)', [4512, 1888]),
  code('Validate AI Decision', 'validate-ai-decision.js', [4736, 1888]),
  ifTrue('AI Decision Valid?', [4960, 1888], '={{ $json.ai_ok }}', BOOL_TRUE),
  code('Rule-based Fallback Router', 'fallback-router.js', [4960, 2112]),
  code('Plan Actions', 'plan-actions.js', [5184, 1888]),
  ifTrue('Live Mode?', [5376, 1888], '={{ $json.live }}', BOOL_TRUE),
  { id: uuid('Create HubSpot Task'), name: 'Create HubSpot Task', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [5600, 1792],
    parameters: { method: 'POST', url: 'https://api.hubapi.com/crm/v3/objects/tasks',
      authentication: 'predefinedCredentialType', nodeCredentialType: 'hubspotAppToken',
      sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify($json.hubspot_payload) }}', options: { timeout: 30000 } },
    ...RETRY },
  slackPost('Post Slack Alert', [5824, 1792],
    "={{ JSON.stringify($('Plan Actions').first().json.slack_payload).replace('__TASK_ID__', $json.id ? '#' + $json.id : 'not created') }}"),
  code('Assemble Outcome', 'assemble-outcome.js', [5824, 2000]),
  { id: uuid('Log to Action Log'), name: 'Log to Action Log', type: 'n8n-nodes-base.dataTable', typeVersion: 1.1, position: [6016, 2000],
    parameters: { dataTableId: table(), columns: {
      mappingMode: 'autoMapInputData', value: {}, matchingColumns: [],
      schema: LOG_COLUMNS.map(([id, type]) => ({ id, displayName: id, required: false, defaultMatch: false, display: true, type, readOnly: false, removed: false })),
      attemptToConvertTypes: false, convertFieldsToString: false }, options: {} },
    onError: 'continueRegularOutput' },
  { id: uuid('Respond to Sender'), name: 'Respond to Sender', type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.4, position: [6096, 1664],
    parameters: { options: { responseCode: "={{ $json.status === 'blocked' ? 422 : 200 }}" } } },

  { id: uuid('Run Report Now'), name: 'Run Report Now', type: 'n8n-nodes-base.manualTrigger', typeVersion: 1, position: [3200, 2544], parameters: {} },
  { id: uuid('Daily 6 pm Digest'), name: 'Daily 6 pm Digest', type: 'n8n-nodes-base.scheduleTrigger', typeVersion: 1.2, position: [3200, 2720],
    parameters: { rule: { interval: [{ field: 'days', daysInterval: 1, triggerAtHour: 18, triggerAtMinute: 0 }] } } },
  setNode('Configure Report', [3424, 2624], [
    assign('report_email', 'string', 'you@example.com'),
    assign('lookback_hours', 'number', 24),
    assign('run_id', 'string', ''),
    assign('slack_digest_channel', 'string', 'campaign-digest'),
    assign('claude_model', 'string', 'claude-haiku-4-5'),
    assign('minutes_saved_per_variant', 'number', 6)
  ]),
  { id: uuid('Read Action Log'), name: 'Read Action Log', type: 'n8n-nodes-base.dataTable', typeVersion: 1.1, position: [3856, 2624],
    parameters: { operation: 'get', dataTableId: table(), returnAll: true }, alwaysOutputData: true },
  code('Aggregate Run Stats', 'aggregate-run-stats.js', [4080, 2624]),
  code('Build Insights Request', 'build-insights-request.js', [4304, 2624]),
  anthropic('Insights Agent (Claude)', [4512, 2624]),
  code('Build Report', 'build-report.js', [4736, 2624]),
  { id: uuid('Email Report (Gmail)'), name: 'Email Report (Gmail)', type: 'n8n-nodes-base.gmail', typeVersion: 2.1, position: [4976, 2448],
    parameters: { sendTo: "={{ $('Configure Report').first().json.report_email }}", subject: '={{ $json.subject }}',
                  message: '={{ $json.html }}', options: { appendAttribution: false } },
    webhookId: uuid('gmail:report'), ...RETRY },
  slackPost('Post Slack Digest', [4976, 2592], '={{ JSON.stringify($json.slack_payload) }}'),
  { id: uuid('Save Report as HTML'), name: 'Save Report as HTML', type: 'n8n-nodes-base.convertToFile', typeVersion: 1.1, position: [4976, 2720],
    parameters: { operation: 'toText', sourceProperty: 'html', options: { fileName: 'ad_copy_review_report.html' } } },
  code('Rows for Sheet', 'rows-for-sheet.js', [5200, 2784]),
  { id: uuid('Append Decisions to Google Sheet'), name: 'Append Decisions to Google Sheet', type: 'n8n-nodes-base.googleSheets', typeVersion: 4.7,
    position: [5420, 2784],
    parameters: { operation: 'append',
      documentId: { __rl: true, mode: 'list', value: '' }, sheetName: { __rl: true, mode: 'list', value: '' },
      columns: { mappingMode: 'autoMapInputData', value: {}, matchingColumns: [], schema: [],
                 attemptToConvertTypes: false, convertFieldsToString: false }, options: {} },
    ...RETRY },
  { id: uuid('Ensure Action Log Table'), name: 'Ensure Action Log Table', type: 'n8n-nodes-base.dataTable', typeVersion: 1.1,
    position: [3632, 2624],
    parameters: { resource: 'table', operation: 'create', tableName: TABLE,
      columns: { column: LOG_COLUMNS.map(([name, type]) => (type === 'string' ? { name } : { name, type })) },
      options: { createIfNotExists: true } } }
];

const link = (to) => ({ node: to, type: 'main', index: 0 });
const connections = {
  'Receive Ad Variant': { main: [[link('Configure Routing')]] },
  'Configure Routing': { main: [[link('Gatekeeper: Validate & Normalize')]] },
  'Gatekeeper: Validate & Normalize': { main: [[link('Passed Gatekeeper?')]] },
  'Passed Gatekeeper?': { main: [[link('Check Already Processed')], [link('Blocked Outcome')]] },
  'Check Already Processed': { main: [[link('Already Processed?')]] },
  'Already Processed?': { main: [[link('Duplicate Outcome')], [link('Build Claude Request')]] },
  'Build Claude Request': { main: [[link('Routing Agent (Claude)')]] },
  'Routing Agent (Claude)': { main: [[link('Validate AI Decision')]] },
  'Validate AI Decision': { main: [[link('AI Decision Valid?')]] },
  'AI Decision Valid?': { main: [[link('Plan Actions')], [link('Rule-based Fallback Router')]] },
  'Rule-based Fallback Router': { main: [[link('Plan Actions')]] },
  'Plan Actions': { main: [[link('Live Mode?')]] },
  'Live Mode?': { main: [[link('Create HubSpot Task')], [link('Assemble Outcome')]] },
  'Create HubSpot Task': { main: [[link('Post Slack Alert')]] },
  'Post Slack Alert': { main: [[link('Assemble Outcome')]] },
  'Assemble Outcome': { main: [[link('Log to Action Log')]] },
  'Blocked Outcome': { main: [[link('Log to Action Log')]] },
  'Log to Action Log': { main: [[link('Respond to Sender')]] },
  'Duplicate Outcome': { main: [[link('Respond to Sender')]] },
  'Run Report Now': { main: [[link('Configure Report')]] },
  'Daily 6 pm Digest': { main: [[link('Configure Report')]] },
  'Configure Report': { main: [[link('Ensure Action Log Table')]] },
  'Ensure Action Log Table': { main: [[link('Read Action Log')]] },
  'Read Action Log': { main: [[link('Aggregate Run Stats')]] },
  'Aggregate Run Stats': { main: [[link('Build Insights Request')]] },
  'Build Insights Request': { main: [[link('Insights Agent (Claude)')]] },
  'Insights Agent (Claude)': { main: [[link('Build Report')]] },
  'Build Report': { main: [[link('Email Report (Gmail)'), link('Post Slack Digest'), link('Save Report as HTML'), link('Rows for Sheet')]] },
  'Rows for Sheet': { main: [[link('Append Decisions to Google Sheet')]] }
};

// ---- n8n house style --------------------------------------------------------
// Clean grid layout: the webhook path runs left to right on one row, the daily
// report on a second row. One neutral sticky per group, computed from node
// positions, and a 480 px overview with the sample request stacked under it.
const POS = {
  'Receive Ad Variant': [0, 400], 'Configure Routing': [224, 400], 'Gatekeeper: Validate & Normalize': [448, 400],
  'Passed Gatekeeper?': [672, 400], 'Blocked Outcome': [672, 624],
  'Check Already Processed': [1072, 400], 'Already Processed?': [1296, 400], 'Duplicate Outcome': [1296, 624],
  'Build Claude Request': [1648, 400], 'Routing Agent (Claude)': [1872, 400], 'Validate AI Decision': [2096, 400],
  'AI Decision Valid?': [2320, 400], 'Rule-based Fallback Router': [2320, 624],
  'Plan Actions': [2720, 400], 'Live Mode?': [2944, 400], 'Create HubSpot Task': [3168, 304], 'Post Slack Alert': [3392, 304],
  'Assemble Outcome': [3792, 400], 'Log to Action Log': [4016, 400], 'Respond to Sender': [4240, 400],
  'Run Report Now': [0, 1072], 'Daily 6 pm Digest': [0, 1264], 'Configure Report': [224, 1168],
  'Ensure Action Log Table': [448, 1168], 'Read Action Log': [672, 1168], 'Aggregate Run Stats': [896, 1168],
  'Build Insights Request': [1296, 1168], 'Insights Agent (Claude)': [1520, 1168], 'Build Report': [1744, 1168],
  'Email Report (Gmail)': [2144, 1040], 'Post Slack Digest': [2144, 1232], 'Save Report as HTML': [2144, 1424],
  'Rows for Sheet': [2368, 1424], 'Append Decisions to Google Sheet': [2592, 1424]
};
const OVERVIEW = `## ${TITLE}

### How it works

1. Receives each AI-generated ad variant on a **Webhook** and checks it with fixed rules, blocking broken payloads and duplicates.
2. Sends the variant to **Claude**, which scores channel fit, flags risky claims and returns a strict JSON decision (approve, review or block) with a priority, owner team and suggested fix.
3. Falls back to deterministic rules whenever the AI answer is unusable.
4. In live mode, creates a **HubSpot** task and posts a **Slack** alert, then logs every outcome to an n8n **Data Table**.
5. Every evening, has Claude summarize the log into a **Gmail** report, a Slack digest and **Google Sheets** rows.

### Setup steps

- [ ] Click **Run Report Now** once. It creates the \`${TABLE}\` Data Table.
- [ ] Add credentials: Header Auth (webhook), Anthropic, HubSpot private app, Slack bot with \`chat:write\`, Gmail and Google Sheets.
- [ ] Set the Slack channels and model in **Configure Routing**, and the report email in **Configure Report**.
- [ ] Pick a spreadsheet in **Append Decisions to Google Sheet**.
- [ ] Send the sample request below with \`"mode": "dry_run"\`, then switch to \`"live"\`.

### Customization

Edit owner teams, channel rules and risk levels in **Build Claude Request**, and keep the enums in **Validate AI Decision** in sync. Change the report time in **Daily 6 pm Digest**. Requires an n8n version with Data Tables.`;

const sample = nodes.find((n) => n.name === 'Sample request').parameters.content;
const realNodes = nodes.filter((n) => n.type !== 'n8n-nodes-base.stickyNote')
  .map((n) => ({ ...n, position: POS[n.name] ?? (() => { throw new Error(`no position for ${n.name}`); })() }));
const stickies = houseStickies({
  nodes: realNodes, overview: OVERVIEW, uuid,
  extras: [{ name: 'Sample request', content: sample }],
  groups: [
    { title: 'Receive and gatekeep', body: 'Takes the webhook, loads routing settings and blocks invalid variants with a 422.',
      members: ['Receive Ad Variant', 'Configure Routing', 'Gatekeeper: Validate & Normalize', 'Passed Gatekeeper?', 'Blocked Outcome'] },
    { title: 'Skip duplicates', body: 'Answers "duplicate" if this brief and variant were already processed.',
      members: ['Check Already Processed', 'Already Processed?', 'Duplicate Outcome'] },
    { title: 'Route with Claude', body: 'Claude returns a strict JSON decision. Bad answers go to the rule-based fallback.',
      members: ['Build Claude Request', 'Routing Agent (Claude)', 'Validate AI Decision', 'AI Decision Valid?', 'Rule-based Fallback Router'] },
    { title: 'Create task and alert', body: 'In live mode, creates the HubSpot task and posts the Slack alert.',
      members: ['Plan Actions', 'Live Mode?', 'Create HubSpot Task', 'Post Slack Alert'] },
    { title: 'Log and respond', body: 'Records what actually happened in the Data Table and answers the sender.',
      members: ['Assemble Outcome', 'Log to Action Log', 'Respond to Sender'] },
    { title: 'Collect daily stats', body: 'Runs daily or on demand, ensures the log table exists and aggregates the last 24 hours.',
      members: ['Run Report Now', 'Daily 6 pm Digest', 'Configure Report', 'Ensure Action Log Table', 'Read Action Log', 'Aggregate Run Stats'] },
    { title: 'Write insights with Claude', body: 'Claude finds patterns and recommendations, then builds the HTML report.',
      members: ['Build Insights Request', 'Insights Agent (Claude)', 'Build Report'] },
    { title: 'Deliver the report', body: 'Sends the report by Gmail and Slack, saves an HTML file and appends rows to Google Sheets.',
      members: ['Email Report (Gmail)', 'Post Slack Digest', 'Save Report as HTML', 'Rows for Sheet', 'Append Decisions to Google Sheet'] }
  ]
});
nodes.splice(0, nodes.length, ...stickies, ...realNodes);

const workflow = { name: TITLE, nodes, connections, settings: { executionOrder: 'v1' } };
mkdirSync(join(here, 'workflow'), { recursive: true });
const file = join(here, 'workflow', 'review-ai-ad-copy-claude-hubspot-slack.json');
writeFileSync(file, JSON.stringify(workflow, null, 2) + '\n');
writeFileSync(join(here, 'workflow', 'description.md'), OVERVIEW.replace(/^## .*\n\n/, '') + '\n');
console.log(`wrote ${file}: ${nodes.length} nodes`);
