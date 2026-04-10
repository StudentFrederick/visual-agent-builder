import { describe, it, expect } from 'vitest'
import { SERVICE_TYPES, getServiceToolDescription } from '../src/utils/service-registry.js'

describe('SERVICE_TYPES', () => {
  it('has webhook as a registered service', () => {
    expect(SERVICE_TYPES.webhook).toBeDefined()
    expect(SERVICE_TYPES.webhook.label).toBe('Webhook (HTTP)')
    expect(SERVICE_TYPES.webhook.execute).toBeTypeOf('function')
  })

  it('webhook has all required config fields', () => {
    const fields = SERVICE_TYPES.webhook.configFields.map(f => f.key)
    expect(fields).toContain('url')
    expect(fields).toContain('method')
    expect(fields).toContain('headers')
  })

  it('webhook has default config', () => {
    const defaults = SERVICE_TYPES.webhook.defaultConfig
    expect(defaults.method).toBe('POST')
    expect(defaults.url).toBe('')
  })

  it('webhook execute throws on missing URL', async () => {
    await expect(
      SERVICE_TYPES.webhook.execute({ url: '', method: 'POST' }, 'test')
    ).rejects.toThrow('Webhook URL is required')
  })

  it('webhook execute throws on invalid headers JSON', async () => {
    await expect(
      SERVICE_TYPES.webhook.execute(
        { url: 'https://example.com', method: 'POST', headers: 'not-json' },
        'test'
      )
    ).rejects.toThrow('Invalid headers JSON')
  })
})

describe('getServiceToolDescription', () => {
  it('builds description from service node data', () => {
    const node = {
      data: {
        serviceType: 'webhook',
        serviceConfig: { url: 'https://hooks.example.com/abc', method: 'POST' }
      }
    }
    const desc = getServiceToolDescription(node)
    expect(desc).toContain('Webhook (HTTP)')
    expect(desc).toContain('POST')
    expect(desc).toContain('https://hooks.example.com/abc')
  })

  it('shows (not configured) when URL is missing', () => {
    const node = {
      data: {
        serviceType: 'webhook',
        serviceConfig: { method: 'GET' }
      }
    }
    const desc = getServiceToolDescription(node)
    expect(desc).toContain('(not configured)')
  })
})
