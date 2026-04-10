# Extra Service Types — Design Spec

**Date:** 2026-04-10
**Status:** Approved

---

## Overview

Add four new service types to the Visual Agent Builder: Slack, GitHub, Email (Resend), and Google Sheets. Each is a new entry in the existing `SERVICE_TYPES` registry, following the same pattern as the webhook service. Authentication tokens are stored per-service in localStorage. The SettingsModal is extended with tabs for each service.

---

## Service Definitions

### Slack

| Field | Value |
|---|---|
| Key | `slack` |
| Label | Slack |
| Icon | S (or 💬) |
| Color | `purple` |

**Config fields:**
- `message` (textarea) — Message text to send. Falls back to `prevOutput` if empty.

**Authentication:**
- Slack webhook URL stored in localStorage under `vab_slack_webhook`
- Entered via Settings modal, Slack tab

**Execute:**
```js
POST {webhookUrl}
Content-Type: application/json
Body: { "text": message || prevOutput }
```

**Response:** Slack returns `"ok"` on success.

---

### GitHub

| Field | Value |
|---|---|
| Key | `github` |
| Label | GitHub Issue |
| Icon | G |
| Color | `gray` |

**Config fields:**
- `owner` (text) — Repository owner (e.g., `StudentFrederick`)
- `repo` (text) — Repository name (e.g., `visual-agent-builder`)
- `title` (text) — Issue title. Template variables supported.
- `body` (textarea) — Issue body. Falls back to `prevOutput` if empty. Template variables supported.

**Authentication:**
- GitHub personal access token stored in localStorage under `vab_github_token`
- Entered via Settings modal, GitHub tab
- Required scope: `repo`

**Execute:**
```js
POST https://api.github.com/repos/{owner}/{repo}/issues
Headers: {
  "Authorization": "Bearer {token}",
  "Accept": "application/vnd.github+json",
  "Content-Type": "application/json"
}
Body: { "title": title, "body": body || prevOutput }
```

**Response:** JSON with created issue data. Return `issue.html_url` as output.

---

### Email (Resend)

| Field | Value |
|---|---|
| Key | `email` |
| Label | Email (Resend) |
| Icon | ✉ |
| Color | `blue` |

**Config fields:**
- `to` (text) — Recipient email address
- `subject` (text) — Email subject. Template variables supported.
- `body` (textarea) — Email body. Falls back to `prevOutput` if empty. Template variables supported.

**Authentication:**
- Resend API key stored in localStorage under `vab_resend_key`
- Entered via Settings modal, Email tab

**Execute:**
```js
POST https://api.resend.com/emails
Headers: {
  "Authorization": "Bearer {apiKey}",
  "Content-Type": "application/json"
}
Body: {
  "from": "onboarding@resend.dev",
  "to": to,
  "subject": subject,
  "text": body || prevOutput
}
```

**Response:** JSON with `{ id }`. Return `"Email sent: {id}"` as output.

---

### Google Sheets

| Field | Value |
|---|---|
| Key | `gsheets` |
| Label | Google Sheets |
| Icon | 📊 |
| Color | `green` |

**Config fields:**
- `spreadsheetId` (text) — The spreadsheet ID from the URL
- `sheetName` (text) — Sheet/tab name (default: `Sheet1`)
- `values` (textarea) — Values to append as comma-separated or JSON array. Falls back to `prevOutput` if empty.

**Authentication:**
- Google Sheets API key stored in localStorage under `vab_gsheets_key`
- Entered via Settings modal, Sheets tab
- Spreadsheet must be shared with "Anyone with the link" for API key access

**Execute:**
```js
POST https://sheets.googleapis.com/v4/spreadsheets/{spreadsheetId}/values/{sheetName}:append?valueInputOption=USER_ENTERED&key={apiKey}
Headers: {
  "Content-Type": "application/json"
}
Body: {
  "values": [parsedValues]
}
```

Where `parsedValues` is:
1. If `values` is valid JSON array → use as-is
2. If comma-separated string → split by comma and trim
3. If `prevOutput` fallback → wrap in single-element array

**Response:** JSON with update details. Return `"Added row to {sheetName}"` as output.

---

## Authentication Storage

| Service | localStorage Key | Value |
|---|---|---|
| Slack | `vab_slack_webhook` | Webhook URL |
| GitHub | `vab_github_token` | Personal access token |
| Email | `vab_resend_key` | Resend API key |
| Google Sheets | `vab_gsheets_key` | Google Sheets API key |

All tokens are managed via the SettingsModal tabs.

---

## SettingsModal Changes

The current single-field modal becomes a tabbed interface:

```
┌─────────────────────────────────────┐
│  Settings                        ✕  │
│                                     │
│  [Claude] [Slack] [GitHub] [Email] [Sheets] │
│                                     │
│  ┌─ Active tab content ───────────┐ │
│  │ Service-specific fields here   │ │
│  └────────────────────────────────┘ │
│                                     │
│              [Save]                 │
└─────────────────────────────────────┘
```

**Tab contents:**

- **Claude:** API Key field (existing behavior, unchanged)
- **Slack:** Webhook URL field
- **GitHub:** Personal Access Token field
- **Email:** Resend API Key field
- **Sheets:** Google Sheets API Key field

Each tab loads/saves its own localStorage key independently. The "Save" button saves the currently visible tab's value.

The modal still opens on first visit if no Claude API key is set (existing behavior).

---

## Implementation Scope

### Modified Files

| File | Change |
|---|---|
| `src/utils/service-registry.js` | Add 4 new entries to `SERVICE_TYPES` |
| `src/components/SettingsModal.jsx` | Add tabs for service tokens |
| `tests/service-registry.test.js` | Add tests for new service types |

### No Changes Needed

- `ServiceNode.jsx` — already renders dynamically from registry
- `NodeEditorPanel.jsx` — already renders `configFields` dynamically
- `FlowCanvas.jsx` — already registers `serviceNode` type
- `useFlow.js` — already handles `serviceNode` type with `serviceConfig`
- `useRunner.js` — already calls `executeService()` for service nodes

### Not In Scope

- Read actions (read sheets, list issues)
- OAuth flows
- Retry logic or rate limiting
- Service-specific error recovery

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Missing token in Settings | `execute` throws `"Slack webhook URL not configured. Add it in Settings."` (same pattern per service) |
| API returns error | Throw with status code and message, displayed on node |
| Invalid config (empty required field) | Throw with field-specific message |
| Google Sheets not shared publicly | API returns 403, shown as error on node |

---

## Testing

- Unit: each service type has valid `configFields`, `defaultConfig`, `execute` function
- Unit: `getServiceToolDescription()` returns correct descriptions for new types
- Unit: config validation (missing URL, missing token, etc.)
- Manual: create each service node, configure, run flow
