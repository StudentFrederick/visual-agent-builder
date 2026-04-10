/**
 * Pluggable service registry.
 * Each service type defines its config fields, UI metadata, and executor.
 * Add new services by adding entries to SERVICE_TYPES.
 */

export const SERVICE_TYPES = {
  webhook: {
    label: 'Webhook (HTTP)',
    icon: '\u{1F517}', // 🔗
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

  // Future services can be added here:
  // slack: { ... },
  // email: { ... },
  // database: { ... },
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
