# Extra Service Types Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Slack, GitHub, Email (Resend), and Google Sheets service types to the Visual Agent Builder, plus a tabbed SettingsModal for managing service tokens.

**Architecture:** Four new entries in the existing `SERVICE_TYPES` object in `service-registry.js`, each following the same pattern as webhook. The SettingsModal gets a tabbed interface for per-service token management. No new components or hooks needed beyond the SettingsModal rewrite.

**Tech Stack:** React, Tailwind CSS, Vitest, fetch API (no new dependencies)

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/utils/service-registry.js` | Modify | Add 4 new service type entries |
| `src/components/SettingsModal.jsx` | Modify | Rewrite to tabbed interface |
| `tests/service-registry.test.js` | Modify | Add tests for new service types |

---

### Task 1: Slack Service Type

**Files:**
- Modify: `src/utils/service-registry.js`
- Modify: `tests/service-registry.test.js`

- [ ] **Step 1: Write failing tests for Slack service**

Append to `tests/service-registry.test.js`:

```js
describe('slack service', () => {
  it('is a registered service', () => {
    expect(SERVICE_TYPES.slack).toBeDefined()
    expect(SERVICE_TYPES.slack.label).toBe('Slack')
    expect(SERVICE_TYPES.slack.execute).toBeTypeOf('function')
  })

  it('has required config fields', () => {
    const fields = SERVICE_TYPES.slack.configFields.map(f => f.key)
    expect(fields).toContain('message')
  })

  it('has default config', () => {
    const defaults = SERVICE_TYPES.slack.defaultConfig
    expect(defaults.message).toBe('')
  })

  it('throws on missing webhook URL', async () => {
    await expect(
      SERVICE_TYPES.slack.execute({ message: 'hello' }, 'test')
    ).rejects.toThrow('Slack webhook URL not configured')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/service-registry.test.js`
Expected: FAIL — `SERVICE_TYPES.slack` is undefined

- [ ] **Step 3: Implement Slack service type**

Add to `SERVICE_TYPES` in `src/utils/service-registry.js`, after the webhook entry:

```js
  slack: {
    label: 'Slack',
    icon: '💬',
    color: 'purple',
    description: 'Send a message to a Slack channel via webhook',
    configFields: [
      { key: 'message', label: 'Message', type: 'textarea', placeholder: 'Hello from the agent!' }
    ],
    defaultConfig: {
      message: ''
    },
    execute: async (config, input) => {
      const webhookUrl = localStorage.getItem('vab_slack_webhook')
      if (!webhookUrl) throw new Error('Slack webhook URL not configured. Add it in Settings.')

      const text = config.message || input
      if (!text) throw new Error('No message to send')

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      })

      if (!response.ok) {
        const err = await response.text()
        throw new Error(`Slack error ${response.status}: ${err.slice(0, 500)}`)
      }

      return 'Message sent to Slack'
    }
  },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/service-registry.test.js`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/service-registry.js tests/service-registry.test.js
git commit -m "feat: add Slack service type"
```

---

### Task 2: GitHub Service Type

**Files:**
- Modify: `src/utils/service-registry.js`
- Modify: `tests/service-registry.test.js`

- [ ] **Step 1: Write failing tests for GitHub service**

Append to `tests/service-registry.test.js`:

```js
describe('github service', () => {
  it('is a registered service', () => {
    expect(SERVICE_TYPES.github).toBeDefined()
    expect(SERVICE_TYPES.github.label).toBe('GitHub Issue')
    expect(SERVICE_TYPES.github.execute).toBeTypeOf('function')
  })

  it('has required config fields', () => {
    const fields = SERVICE_TYPES.github.configFields.map(f => f.key)
    expect(fields).toContain('owner')
    expect(fields).toContain('repo')
    expect(fields).toContain('title')
    expect(fields).toContain('body')
  })

  it('has default config', () => {
    const defaults = SERVICE_TYPES.github.defaultConfig
    expect(defaults.owner).toBe('')
    expect(defaults.repo).toBe('')
    expect(defaults.title).toBe('')
    expect(defaults.body).toBe('')
  })

  it('throws on missing token', async () => {
    await expect(
      SERVICE_TYPES.github.execute(
        { owner: 'user', repo: 'repo', title: 'test', body: '' },
        'test'
      )
    ).rejects.toThrow('GitHub token not configured')
  })

  it('throws on missing owner', async () => {
    // Temporarily set token
    localStorage.setItem('vab_github_token', 'fake-token')
    await expect(
      SERVICE_TYPES.github.execute(
        { owner: '', repo: 'repo', title: 'test', body: '' },
        'test'
      )
    ).rejects.toThrow('Repository owner is required')
    localStorage.removeItem('vab_github_token')
  })

  it('throws on missing repo', async () => {
    localStorage.setItem('vab_github_token', 'fake-token')
    await expect(
      SERVICE_TYPES.github.execute(
        { owner: 'user', repo: '', title: 'test', body: '' },
        'test'
      )
    ).rejects.toThrow('Repository name is required')
    localStorage.removeItem('vab_github_token')
  })

  it('throws on missing title', async () => {
    localStorage.setItem('vab_github_token', 'fake-token')
    await expect(
      SERVICE_TYPES.github.execute(
        { owner: 'user', repo: 'repo', title: '', body: '' },
        'test'
      )
    ).rejects.toThrow('Issue title is required')
    localStorage.removeItem('vab_github_token')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/service-registry.test.js`
Expected: FAIL — `SERVICE_TYPES.github` is undefined

- [ ] **Step 3: Implement GitHub service type**

Add to `SERVICE_TYPES` in `src/utils/service-registry.js`:

```js
  github: {
    label: 'GitHub Issue',
    icon: 'G',
    color: 'gray',
    description: 'Create an issue in a GitHub repository',
    configFields: [
      { key: 'owner', label: 'Owner', type: 'text', placeholder: 'StudentFrederick' },
      { key: 'repo', label: 'Repository', type: 'text', placeholder: 'visual-agent-builder' },
      { key: 'title', label: 'Issue Title', type: 'text', placeholder: 'Bug: ...' },
      { key: 'body', label: 'Issue Body', type: 'textarea', placeholder: 'Describe the issue...' }
    ],
    defaultConfig: {
      owner: '',
      repo: '',
      title: '',
      body: ''
    },
    execute: async (config, input) => {
      const token = localStorage.getItem('vab_github_token')
      if (!token) throw new Error('GitHub token not configured. Add it in Settings.')
      if (!config.owner) throw new Error('Repository owner is required')
      if (!config.repo) throw new Error('Repository name is required')

      const title = config.title
      if (!title) throw new Error('Issue title is required')
      const body = config.body || input

      const response = await fetch(
        `https://api.github.com/repos/${config.owner}/${config.repo}/issues`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github+json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ title, body })
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(`GitHub error ${response.status}: ${data.message || JSON.stringify(data)}`)
      }

      return data.html_url
    }
  },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/service-registry.test.js`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/service-registry.js tests/service-registry.test.js
git commit -m "feat: add GitHub Issue service type"
```

---

### Task 3: Email (Resend) Service Type

**Files:**
- Modify: `src/utils/service-registry.js`
- Modify: `tests/service-registry.test.js`

- [ ] **Step 1: Write failing tests for Email service**

Append to `tests/service-registry.test.js`:

```js
describe('email service', () => {
  it('is a registered service', () => {
    expect(SERVICE_TYPES.email).toBeDefined()
    expect(SERVICE_TYPES.email.label).toBe('Email (Resend)')
    expect(SERVICE_TYPES.email.execute).toBeTypeOf('function')
  })

  it('has required config fields', () => {
    const fields = SERVICE_TYPES.email.configFields.map(f => f.key)
    expect(fields).toContain('to')
    expect(fields).toContain('subject')
    expect(fields).toContain('body')
  })

  it('has default config', () => {
    const defaults = SERVICE_TYPES.email.defaultConfig
    expect(defaults.to).toBe('')
    expect(defaults.subject).toBe('')
    expect(defaults.body).toBe('')
  })

  it('throws on missing API key', async () => {
    await expect(
      SERVICE_TYPES.email.execute(
        { to: 'test@example.com', subject: 'Hi', body: 'Hello' },
        'test'
      )
    ).rejects.toThrow('Resend API key not configured')
  })

  it('throws on missing recipient', async () => {
    localStorage.setItem('vab_resend_key', 'fake-key')
    await expect(
      SERVICE_TYPES.email.execute(
        { to: '', subject: 'Hi', body: 'Hello' },
        'test'
      )
    ).rejects.toThrow('Recipient email is required')
    localStorage.removeItem('vab_resend_key')
  })

  it('throws on missing subject', async () => {
    localStorage.setItem('vab_resend_key', 'fake-key')
    await expect(
      SERVICE_TYPES.email.execute(
        { to: 'test@example.com', subject: '', body: 'Hello' },
        'test'
      )
    ).rejects.toThrow('Email subject is required')
    localStorage.removeItem('vab_resend_key')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/service-registry.test.js`
Expected: FAIL — `SERVICE_TYPES.email` is undefined

- [ ] **Step 3: Implement Email service type**

Add to `SERVICE_TYPES` in `src/utils/service-registry.js`:

```js
  email: {
    label: 'Email (Resend)',
    icon: '✉',
    color: 'blue',
    description: 'Send an email via Resend',
    configFields: [
      { key: 'to', label: 'To', type: 'text', placeholder: 'recipient@example.com' },
      { key: 'subject', label: 'Subject', type: 'text', placeholder: 'Email subject' },
      { key: 'body', label: 'Body', type: 'textarea', placeholder: 'Email body text...' }
    ],
    defaultConfig: {
      to: '',
      subject: '',
      body: ''
    },
    execute: async (config, input) => {
      const apiKey = localStorage.getItem('vab_resend_key')
      if (!apiKey) throw new Error('Resend API key not configured. Add it in Settings.')
      if (!config.to) throw new Error('Recipient email is required')
      if (!config.subject) throw new Error('Email subject is required')

      const body = config.body || input

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'onboarding@resend.dev',
          to: config.to,
          subject: config.subject,
          text: body
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(`Resend error ${response.status}: ${data.message || JSON.stringify(data)}`)
      }

      return `Email sent: ${data.id}`
    }
  },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/service-registry.test.js`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/service-registry.js tests/service-registry.test.js
git commit -m "feat: add Email (Resend) service type"
```

---

### Task 4: Google Sheets Service Type

**Files:**
- Modify: `src/utils/service-registry.js`
- Modify: `tests/service-registry.test.js`

- [ ] **Step 1: Write failing tests for Google Sheets service**

Append to `tests/service-registry.test.js`:

```js
describe('gsheets service', () => {
  it('is a registered service', () => {
    expect(SERVICE_TYPES.gsheets).toBeDefined()
    expect(SERVICE_TYPES.gsheets.label).toBe('Google Sheets')
    expect(SERVICE_TYPES.gsheets.execute).toBeTypeOf('function')
  })

  it('has required config fields', () => {
    const fields = SERVICE_TYPES.gsheets.configFields.map(f => f.key)
    expect(fields).toContain('spreadsheetId')
    expect(fields).toContain('sheetName')
    expect(fields).toContain('values')
  })

  it('has default config', () => {
    const defaults = SERVICE_TYPES.gsheets.defaultConfig
    expect(defaults.spreadsheetId).toBe('')
    expect(defaults.sheetName).toBe('Sheet1')
    expect(defaults.values).toBe('')
  })

  it('throws on missing API key', async () => {
    await expect(
      SERVICE_TYPES.gsheets.execute(
        { spreadsheetId: 'abc', sheetName: 'Sheet1', values: 'a,b' },
        'test'
      )
    ).rejects.toThrow('Google Sheets API key not configured')
  })

  it('throws on missing spreadsheet ID', async () => {
    localStorage.setItem('vab_gsheets_key', 'fake-key')
    await expect(
      SERVICE_TYPES.gsheets.execute(
        { spreadsheetId: '', sheetName: 'Sheet1', values: 'a,b' },
        'test'
      )
    ).rejects.toThrow('Spreadsheet ID is required')
    localStorage.removeItem('vab_gsheets_key')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/service-registry.test.js`
Expected: FAIL — `SERVICE_TYPES.gsheets` is undefined

- [ ] **Step 3: Implement Google Sheets service type**

Add to `SERVICE_TYPES` in `src/utils/service-registry.js`:

```js
  gsheets: {
    label: 'Google Sheets',
    icon: '📊',
    color: 'green',
    description: 'Append a row to a Google Sheets spreadsheet',
    configFields: [
      { key: 'spreadsheetId', label: 'Spreadsheet ID', type: 'text', placeholder: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms' },
      { key: 'sheetName', label: 'Sheet Name', type: 'text', placeholder: 'Sheet1' },
      { key: 'values', label: 'Values (comma-separated or JSON array)', type: 'textarea', placeholder: 'value1, value2, value3' }
    ],
    defaultConfig: {
      spreadsheetId: '',
      sheetName: 'Sheet1',
      values: ''
    },
    execute: async (config, input) => {
      const apiKey = localStorage.getItem('vab_gsheets_key')
      if (!apiKey) throw new Error('Google Sheets API key not configured. Add it in Settings.')
      if (!config.spreadsheetId) throw new Error('Spreadsheet ID is required')

      const sheetName = config.sheetName || 'Sheet1'
      const rawValues = config.values || input

      // Parse values: JSON array or comma-separated string
      let row
      try {
        const parsed = JSON.parse(rawValues)
        row = Array.isArray(parsed) ? parsed : [String(parsed)]
      } catch {
        row = rawValues.split(',').map(v => v.trim())
      }

      const url = `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}/values/${encodeURIComponent(sheetName)}:append?valueInputOption=USER_ENTERED&key=${apiKey}`

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [row] })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(`Google Sheets error ${response.status}: ${data.error?.message || JSON.stringify(data)}`)
      }

      return `Added row to ${sheetName}`
    }
  },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/service-registry.test.js`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/service-registry.js tests/service-registry.test.js
git commit -m "feat: add Google Sheets service type"
```

---

### Task 5: Tabbed SettingsModal

**Files:**
- Modify: `src/components/SettingsModal.jsx`

- [ ] **Step 1: Rewrite SettingsModal with tabs**

Replace the full contents of `src/components/SettingsModal.jsx`:

```jsx
import { useState } from 'react'

const TABS = [
  { key: 'claude', label: 'Claude', storageKey: 'vab_api_key', placeholder: 'sk-ant-...', type: 'password' },
  { key: 'slack', label: 'Slack', storageKey: 'vab_slack_webhook', placeholder: 'https://hooks.slack.com/services/...', type: 'text' },
  { key: 'github', label: 'GitHub', storageKey: 'vab_github_token', placeholder: 'ghp_...', type: 'password' },
  { key: 'email', label: 'Email', storageKey: 'vab_resend_key', placeholder: 're_...', type: 'password' },
  { key: 'gsheets', label: 'Sheets', storageKey: 'vab_gsheets_key', placeholder: 'AIza...', type: 'password' }
]

const HELP_TEXT = {
  claude: 'Your key is stored in your browser only and never sent anywhere else.',
  slack: 'Create a webhook at api.slack.com/apps → Incoming Webhooks.',
  github: 'Create a token at github.com/settings/tokens with repo scope.',
  email: 'Get your API key at resend.com/api-keys.',
  gsheets: 'Get an API key at console.cloud.google.com. Your spreadsheet must be shared with "Anyone with the link" for API key access to work.'
}

export function SettingsModal({ onSave }) {
  const [activeTab, setActiveTab] = useState('claude')
  const [values, setValues] = useState(() => {
    const initial = {}
    for (const tab of TABS) {
      initial[tab.key] = localStorage.getItem(tab.storageKey) || ''
    }
    return initial
  })

  const activeTabDef = TABS.find(t => t.key === activeTab)
  const claudeKey = values.claude
  const isClaudeValid = claudeKey.startsWith('sk-ant-') && claudeKey.length > 20

  const handleSave = () => {
    for (const tab of TABS) {
      const val = values[tab.key]
      if (val) {
        localStorage.setItem(tab.storageKey, val)
      } else {
        localStorage.removeItem(tab.storageKey)
      }
    }
    if (isClaudeValid) {
      onSave(claudeKey)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-[28rem] shadow-xl">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Settings</h2>

        <div className="flex gap-1 mb-4 border-b border-gray-200">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-t transition-colors ${
                activeTab === tab.key
                  ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <p className="text-sm text-gray-500 mb-3">{HELP_TEXT[activeTab]}</p>

        <input
          type={activeTabDef.type}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-400"
          placeholder={activeTabDef.placeholder}
          value={values[activeTab]}
          onChange={e => setValues(prev => ({ ...prev, [activeTab]: e.target.value }))}
          autoFocus
        />

        <button
          className="w-full bg-blue-600 text-white rounded px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          disabled={!isClaudeValid && !localStorage.getItem('vab_api_key')}
          onClick={handleSave}
        >
          Save & Continue
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run all tests to make sure nothing broke**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/SettingsModal.jsx
git commit -m "feat: add tabbed SettingsModal for service tokens"
```

---

### Task 6: Update getServiceToolDescription for New Types

**Files:**
- Modify: `src/utils/service-registry.js`
- Modify: `tests/service-registry.test.js`

- [ ] **Step 1: Write failing tests for new tool descriptions**

Append to `tests/service-registry.test.js`:

```js
describe('getServiceToolDescription for new types', () => {
  it('builds description for slack service', () => {
    const node = { data: { serviceType: 'slack', serviceConfig: { message: '' } } }
    const desc = getServiceToolDescription(node)
    expect(desc).toContain('Slack')
  })

  it('builds description for github service', () => {
    const node = {
      data: {
        serviceType: 'github',
        serviceConfig: { owner: 'user', repo: 'repo', title: '', body: '' }
      }
    }
    const desc = getServiceToolDescription(node)
    expect(desc).toContain('GitHub Issue')
    expect(desc).toContain('user/repo')
  })

  it('builds description for email service', () => {
    const node = {
      data: {
        serviceType: 'email',
        serviceConfig: { to: 'test@example.com', subject: '', body: '' }
      }
    }
    const desc = getServiceToolDescription(node)
    expect(desc).toContain('Email')
    expect(desc).toContain('test@example.com')
  })

  it('builds description for gsheets service', () => {
    const node = {
      data: {
        serviceType: 'gsheets',
        serviceConfig: { spreadsheetId: 'abc123', sheetName: 'Data', values: '' }
      }
    }
    const desc = getServiceToolDescription(node)
    expect(desc).toContain('Google Sheets')
    expect(desc).toContain('Data')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/service-registry.test.js`
Expected: FAIL — descriptions don't contain expected strings (current `getServiceToolDescription` only handles webhook pattern)

- [ ] **Step 3: Update getServiceToolDescription**

Replace `getServiceToolDescription` in `src/utils/service-registry.js`:

```js
/**
 * Get tool description for a ServiceNode (used by orchestrator).
 */
export function getServiceToolDescription(node) {
  const service = SERVICE_TYPES[node.data.serviceType]
  const label = service?.label || node.data.serviceType
  const config = node.data.serviceConfig || {}

  switch (node.data.serviceType) {
    case 'webhook': {
      const method = config.method || 'POST'
      const url = config.url || '(not configured)'
      return `${label}: ${method} ${url}. Send a JSON payload to this service.`
    }
    case 'slack':
      return `${label}: Send a message to a Slack channel.`
    case 'github': {
      const target = config.owner && config.repo ? `${config.owner}/${config.repo}` : '(not configured)'
      return `${label}: Create an issue in ${target}.`
    }
    case 'email': {
      const to = config.to || '(not configured)'
      return `${label}: Send an email to ${to}.`
    }
    case 'gsheets': {
      const sheet = config.sheetName || 'Sheet1'
      return `${label}: Append a row to sheet "${sheet}".`
    }
    default:
      return `${label}: Execute this service.`
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/service-registry.test.js`
Expected: All tests PASS

- [ ] **Step 5: Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/utils/service-registry.js tests/service-registry.test.js
git commit -m "feat: update tool descriptions for all service types"
```

---

### Task 7: Manual Testing

- [ ] **Step 1: Start dev server**

Run: `npm run dev`

- [ ] **Step 2: Test SettingsModal tabs**

1. Open the app, click Settings
2. Verify all 5 tabs are visible: Claude, Slack, GitHub, Email, Sheets
3. Switch between tabs — each shows its own input field and help text
4. Verify Sheets tab shows the sharing reminder
5. Enter and save values — verify they persist after page reload

- [ ] **Step 3: Test adding each service node**

1. Click "+ Service" — verify ServiceNode appears
2. Select the node, change service type dropdown to each of: Slack, GitHub Issue, Email (Resend), Google Sheets
3. Verify config fields update per type

- [ ] **Step 4: Test validation errors**

1. Add a Slack node without configuring the webhook URL in Settings
2. Run the flow — verify error "Slack webhook URL not configured. Add it in Settings." appears on the node
3. Repeat for GitHub (missing token), Email (missing key), Sheets (missing key)

- [ ] **Step 5: Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: service types (Slack, GitHub, Email, Google Sheets) complete"
```
