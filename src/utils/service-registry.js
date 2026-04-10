/**
 * Pluggable service registry.
 * Each service type defines its config fields, UI metadata, and executor.
 * Add new services by adding entries to SERVICE_TYPES.
 */

export const SERVICE_TYPES = {
  webhook: {
    label: 'Webhook (HTTP)',
    icon: 'W',
    color: 'orange',
    description: 'Send an HTTP request to an external URL',
    configFields: [
      { key: 'url', label: 'URL', type: 'text', placeholder: 'https://hooks.slack.com/...' },
      { key: 'method', label: 'Method', type: 'select', options: ['POST', 'GET', 'PUT', 'PATCH', 'DELETE'] },
      { key: 'headers', label: 'Headers (JSON)', type: 'textarea', placeholder: '{"Authorization": "Bearer ..."}' }
    ],
    defaultConfig: {
      url: '',
      method: 'POST',
      headers: '{"Content-Type": "application/json"}'
    },
    /**
     * Execute the webhook service.
     * @param {object} config - service config (url, method, headers)
     * @param {string} input - payload to send (from orchestrator or previous node)
     * @returns {Promise<string>} response text
     */
    execute: async (config, input) => {
      if (!config.url) throw new Error('Webhook URL is required')

      let headers = {}
      try {
        headers = config.headers ? JSON.parse(config.headers) : {}
      } catch {
        throw new Error('Invalid headers JSON')
      }

      // Try to parse input as JSON for the body, fall back to wrapping in { data: ... }
      let body
      if (config.method !== 'GET') {
        try {
          JSON.parse(input)
          body = input
        } catch {
          body = JSON.stringify({ data: input })
        }
      }

      const response = await fetch(config.url, {
        method: config.method,
        headers,
        body: config.method !== 'GET' ? body : undefined
      })

      const text = await response.text()

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${text.slice(0, 500)}`)
      }

      // Try to return pretty-printed JSON if response is JSON
      try {
        const json = JSON.parse(text)
        return JSON.stringify(json, null, 2)
      } catch {
        return text
      }
    }
  },

  slack: {
    label: 'Slack',
    icon: '💬',
    color: 'purple',
    configFields: [
      { key: 'message', label: 'Message', type: 'textarea', placeholder: 'Enter message or leave blank to forward input' }
    ],
    defaultConfig: {
      message: ''
    },
    execute: async (config, input) => {
      const webhookUrl = localStorage.getItem('vab_slack_webhook')
      if (!webhookUrl) throw new Error('Slack webhook URL not configured. Add it in Settings.')

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: config.message || input })
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(`HTTP ${response.status}: ${text.slice(0, 500)}`)
      }

      return 'Message sent to Slack'
    }
  },

  github: {
    label: 'GitHub Issue',
    icon: 'G',
    color: 'gray',
    configFields: [
      { key: 'owner', label: 'Owner', type: 'text', placeholder: 'octocat' },
      { key: 'repo', label: 'Repository', type: 'text', placeholder: 'my-repo' },
      { key: 'title', label: 'Title', type: 'text', placeholder: 'Issue title' },
      { key: 'body', label: 'Body', type: 'textarea', placeholder: 'Issue body' }
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
      if (!config.owner) throw new Error('GitHub owner is required')
      if (!config.repo) throw new Error('GitHub repo is required')
      if (!config.title) throw new Error('GitHub issue title is required')

      const response = await fetch(`https://api.github.com/repos/${config.owner}/${config.repo}/issues`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: config.title,
          body: config.body || input
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${data.message || JSON.stringify(data)}`)
      }

      return data.html_url
    }
  },

  email: {
    label: 'Email (Resend)',
    icon: '✉',
    color: 'blue',
    configFields: [
      { key: 'to', label: 'To', type: 'text', placeholder: 'recipient@example.com' },
      { key: 'subject', label: 'Subject', type: 'text', placeholder: 'Email subject' },
      { key: 'body', label: 'Body', type: 'textarea', placeholder: 'Email body' }
    ],
    defaultConfig: {
      to: '',
      subject: '',
      body: ''
    },
    execute: async (config, input) => {
      const apiKey = localStorage.getItem('vab_resend_key')
      if (!apiKey) throw new Error('Resend API key not configured. Add it in Settings.')
      if (!config.to) throw new Error('Email recipient (to) is required')
      if (!config.subject) throw new Error('Email subject is required')

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          from: 'onboarding@resend.dev',
          to: config.to,
          subject: config.subject,
          text: config.body || input
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${data.message || JSON.stringify(data)}`)
      }

      return `Email sent: ${data.id}`
    }
  },

  gsheets: {
    label: 'Google Sheets',
    icon: '📊',
    color: 'green',
    configFields: [
      { key: 'spreadsheetId', label: 'Spreadsheet ID', type: 'text', placeholder: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms' },
      { key: 'sheetName', label: 'Sheet Name', type: 'text', placeholder: 'Sheet1' },
      { key: 'values', label: 'Values (JSON array or comma-separated)', type: 'textarea', placeholder: '["value1", "value2"] or value1,value2' }
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

      let row
      try {
        row = JSON.parse(rawValues)
        if (!Array.isArray(row)) row = [rawValues]
      } catch {
        row = rawValues.split(',').map(v => v.trim())
      }

      const range = encodeURIComponent(`${sheetName}!A1`)
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&key=${apiKey}`

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [row] })
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(`HTTP ${response.status}: ${text.slice(0, 500)}`)
      }

      return `Added row to ${sheetName}`
    }
  },
}

/**
 * Execute a service by type.
 * @param {string} serviceType - key in SERVICE_TYPES
 * @param {object} config - service-specific config
 * @param {string} input - input payload
 * @returns {Promise<string>} result
 */
export async function executeService(serviceType, config, input) {
  const service = SERVICE_TYPES[serviceType]
  if (!service) throw new Error(`Unknown service type: ${serviceType}`)
  return service.execute(config, input)
}

/**
 * Get tool description for a ServiceNode (used by orchestrator).
 */
export function getServiceToolDescription(node) {
  const service = SERVICE_TYPES[node.data.serviceType]
  const label = service?.label || node.data.serviceType
  const method = node.data.serviceConfig?.method || 'POST'
  const url = node.data.serviceConfig?.url || '(not configured)'
  return `${label}: ${method} ${url}. Send a JSON payload to this service.`
}
