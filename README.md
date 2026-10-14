# AI Marketing Ad Review

**Every AI-generated ad variant reviewed, routed and acted on in about 6 seconds, with Claude making the call and a rule-based safety net behind it.**

An [n8n](https://n8n.io) workflow that turns marketing content into real work. Each ad variant arrives on a webhook and is checked, judged by Claude, and turned into a HubSpot task and a Slack alert. A daily report summarizes the whole batch.

```
 Webhook ─▶ Gatekeeper ─▶ Seen before? ─▶ Claude decides ─▶ Valid? ──────────▶ Plan actions ─▶ HubSpot task
 (header     (rules, no AI)  (Data Table)    approve · review   │                                Slack alert
  auth)                                       · block            └▶ Rules fallback ─┘              Action log
```

## How it works

1. **Gatekeeper (no AI):** broken or low-quality payloads and duplicates are stopped straight away, at no AI cost.
2. **Routing agent (Claude):** scores channel fit against real platform limits, flags risky claims, and returns a strict JSON decision (`approve`, `review` or `block`) with a priority, an owner team and a suggested fix.
3. **Fallback:** whenever the AI answer is unusable (rate limit, timeout, bad JSON), deterministic rules route the ad instead.
4. **Actions:** in live mode, creates a **HubSpot** task and posts a **Slack** alert, then logs every outcome to an n8n **Data Table**.
5. **Daily digest:** every evening, Claude summarizes the log into a **Gmail** report, a Slack digest and **Google Sheets** rows.

## Results

Measured on the original deployment ([Madison-Project](https://github.com/Mayank-1024/Madison-Project)) with real HTTP requests:

| Metric | Result |
|---|---|
| Requests sent across all tests | **834** |
| Failed requests | **0** |
| AI cost per routed ad | **$0.0044** |
| Median time from webhook to Slack and HubSpot (50 live ads) | **6.4 s** |
| Throughput ceiling on a 1-vCPU / 4 GB VPS | **≈330 events / minute** |

## Files

| File | What it is |
|---|---|
| `workflow/review-ai-ad-copy-claude-hubspot-slack.json` | The workflow. Import it into n8n. No credentials or IDs are included. |
| `workflow/description.md` | The listing description for the n8n Creator Portal. |
| `src/*.js` | The body of each Code node, one file per node. **Edit these, not the JSON.** |
| `build.mjs` | Assembles the workflow JSON from `src/`: `node build.mjs` |
| `house-style.mjs` | Lays out the sticky notes in n8n's template style. |

## Setup

1. Import the workflow and click **Run Report Now** once. It creates the `ad_copy_review_log` Data Table.
2. Add credentials: Header Auth (webhook), Anthropic, HubSpot private app, Slack bot with `chat:write`, Gmail and Google Sheets.
3. Set the Slack channels and model in **Configure Routing**, and the report email in **Configure Report**.
4. Pick a spreadsheet in **Append Decisions to Google Sheet**.
5. Send a sample request with `"mode": "dry_run"`, then switch to `"live"`.

Owner teams, channel rules and risk levels live in `src/build-claude-request.js`; keep the enums in `src/validate-ai-decision.js` in sync. Requires an n8n version with Data Tables.

## Background

This is a generalized, shareable version of the routing layer built in [Madison-Project](https://github.com/Mayank-1024/Madison-Project), which extends the open-source [Madison](https://github.com/Humanitariansai/Madison) AI marketing framework.
