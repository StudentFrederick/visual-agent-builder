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

describe('Slack service', () => {
  it('has slack as a registered service', () => {
    expect(SERVICE_TYPES.slack).toBeDefined()
    expect(SERVICE_TYPES.slack.label).toBe('Slack')
    expect(SERVICE_TYPES.slack.execute).toBeTypeOf('function')
  })

  it('slack has required config fields', () => {
    const fields = SERVICE_TYPES.slack.configFields.map(f => f.key)
    expect(fields).toContain('message')
  })

  it('slack has default config', () => {
    const defaults = SERVICE_TYPES.slack.defaultConfig
    expect(defaults.message).toBe('')
  })
})

describe('GitHub Issue service', () => {
  it('has github as a registered service', () => {
    expect(SERVICE_TYPES.github).toBeDefined()
    expect(SERVICE_TYPES.github.label).toBe('GitHub Issue')
    expect(SERVICE_TYPES.github.execute).toBeTypeOf('function')
  })

  it('github has required config fields', () => {
    const fields = SERVICE_TYPES.github.configFields.map(f => f.key)
    expect(fields).toContain('owner')
    expect(fields).toContain('repo')
    expect(fields).toContain('title')
    expect(fields).toContain('body')
  })

  it('github has default config', () => {
    const defaults = SERVICE_TYPES.github.defaultConfig
    expect(defaults.owner).toBe('')
    expect(defaults.repo).toBe('')
    expect(defaults.title).toBe('')
    expect(defaults.body).toBe('')
  })

  it('github execute throws on missing owner', async () => {
    globalThis.localStorage = { getItem: () => 'fake-token' }
    await expect(
      SERVICE_TYPES.github.execute({ owner: '', repo: 'myrepo', title: 'Bug' }, 'test')
    ).rejects.toThrow()
    delete globalThis.localStorage
  })

  it('github execute throws on missing repo', async () => {
    globalThis.localStorage = { getItem: () => 'fake-token' }
    await expect(
      SERVICE_TYPES.github.execute({ owner: 'myorg', repo: '', title: 'Bug' }, 'test')
    ).rejects.toThrow()
    delete globalThis.localStorage
  })

  it('github execute throws on missing title', async () => {
    globalThis.localStorage = { getItem: () => 'fake-token' }
    await expect(
      SERVICE_TYPES.github.execute({ owner: 'myorg', repo: 'myrepo', title: '' }, 'test')
    ).rejects.toThrow()
    delete globalThis.localStorage
  })
})

describe('Email (Resend) service', () => {
  it('has email as a registered service', () => {
    expect(SERVICE_TYPES.email).toBeDefined()
    expect(SERVICE_TYPES.email.label).toBe('Email (Resend)')
    expect(SERVICE_TYPES.email.execute).toBeTypeOf('function')
  })

  it('email has required config fields', () => {
    const fields = SERVICE_TYPES.email.configFields.map(f => f.key)
    expect(fields).toContain('to')
    expect(fields).toContain('subject')
    expect(fields).toContain('body')
  })

  it('email has default config', () => {
    const defaults = SERVICE_TYPES.email.defaultConfig
    expect(defaults.to).toBe('')
    expect(defaults.subject).toBe('')
    expect(defaults.body).toBe('')
  })

  it('email execute throws on missing to', async () => {
    globalThis.localStorage = { getItem: () => 'fake-key' }
    await expect(
      SERVICE_TYPES.email.execute({ to: '', subject: 'Hello', body: 'Hi' }, 'test')
    ).rejects.toThrow()
    delete globalThis.localStorage
  })

  it('email execute throws on missing subject', async () => {
    globalThis.localStorage = { getItem: () => 'fake-key' }
    await expect(
      SERVICE_TYPES.email.execute({ to: 'user@example.com', subject: '', body: 'Hi' }, 'test')
    ).rejects.toThrow()
    delete globalThis.localStorage
  })
})

describe('Google Sheets service', () => {
  it('has gsheets as a registered service', () => {
    expect(SERVICE_TYPES.gsheets).toBeDefined()
    expect(SERVICE_TYPES.gsheets.label).toBe('Google Sheets')
    expect(SERVICE_TYPES.gsheets.execute).toBeTypeOf('function')
  })

  it('gsheets has required config fields', () => {
    const fields = SERVICE_TYPES.gsheets.configFields.map(f => f.key)
    expect(fields).toContain('spreadsheetId')
    expect(fields).toContain('sheetName')
    expect(fields).toContain('values')
  })

  it('gsheets has default config', () => {
    const defaults = SERVICE_TYPES.gsheets.defaultConfig
    expect(defaults.spreadsheetId).toBe('')
    expect(defaults.sheetName).toBe('Sheet1')
    expect(defaults.values).toBe('')
  })

  it('gsheets execute throws on missing spreadsheetId', async () => {
    globalThis.localStorage = { getItem: () => 'fake-key' }
    await expect(
      SERVICE_TYPES.gsheets.execute({ spreadsheetId: '', sheetName: 'Sheet1', values: 'a,b' }, 'test')
    ).rejects.toThrow()
    delete globalThis.localStorage
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
