### How it works

1. Receives each AI-generated ad variant on a **Webhook** and checks it with fixed rules, blocking broken payloads and duplicates.
2. Sends the variant to **Claude**, which scores channel fit, flags risky claims and returns a strict JSON decision (approve, review or block) with a priority, owner team and suggested fix.
3. Falls back to deterministic rules whenever the AI answer is unusable.
4. In live mode, creates a **HubSpot** task and posts a **Slack** alert, then logs every outcome to an n8n **Data Table**.
5. Every evening, has Claude summarize the log into a **Gmail** report, a Slack digest and **Google Sheets** rows.

### Setup steps

- [ ] Click **Run Report Now** once. It creates the `ad_copy_review_log` Data Table.
- [ ] Add credentials: Header Auth (webhook), Anthropic, HubSpot private app, Slack bot with `chat:write`, Gmail and Google Sheets.
- [ ] Set the Slack channels and model in **Configure Routing**, and the report email in **Configure Report**.
- [ ] Pick a spreadsheet in **Append Decisions to Google Sheet**.
- [ ] Send the sample request below with `"mode": "dry_run"`, then switch to `"live"`.

### Customization

Edit owner teams, channel rules and risk levels in **Build Claude Request**, and keep the enums in **Validate AI Decision** in sync. Change the report time in **Daily 6 pm Digest**. Requires an n8n version with Data Tables.
