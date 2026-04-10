import { describe, it, expect } from 'vitest'
import {
  sanitizeToolName,
  getOrchestratorSubagentIds,
  getSubagentNodes,
  buildTools
} from '../src/utils/orchestrator.js'

describe('sanitizeToolName', () => {
  it('lowercases and replaces spaces with underscores', () => {
    expect(sanitizeToolName('My Agent')).toBe('my_agent')
  })

  it('strips non-alphanumeric characters', () => {
    expect(sanitizeToolName('Agent #1 (test)')).toBe('agent_1_test')
  })

  it('returns "agent" for empty string', () => {
    expect(sanitizeToolName('')).toBe('agent')
  })

  it('truncates to 64 characters', () => {
    const long = 'a'.repeat(100)
    expect(sanitizeToolName(long)).toHaveLength(64)
  })
})

describe('getOrchestratorSubagentIds', () => {
  it('returns IDs of AgentNodes connected to orchestrators', () => {
    const nodes = [
      { id: 'orch', type: 'orchestratorNode', data: {} },
      { id: 'agent1', type: 'agentNode', data: {} },
      { id: 'agent2', type: 'agentNode', data: {} },
      { id: 'standalone', type: 'agentNode', data: {} }
    ]
    const edges = [
      { source: 'orch', target: 'agent1' },
      { source: 'orch', target: 'agent2' }
    ]
    const ids = getOrchestratorSubagentIds(nodes, edges)
    expect(ids).toContain('agent1')
    expect(ids).toContain('agent2')
    expect(ids).not.toContain('standalone')
    expect(ids).not.toContain('orch')
  })

  it('returns empty set when no orchestrators exist', () => {
    const nodes = [{ id: 'a', type: 'agentNode', data: {} }]
    const edges = []
    const ids = getOrchestratorSubagentIds(nodes, edges)
    expect(ids.size).toBe(0)
  })

  it('ignores orchestrator-to-orchestrator edges', () => {
    const nodes = [
      { id: 'orch1', type: 'orchestratorNode', data: {} },
      { id: 'orch2', type: 'orchestratorNode', data: {} }
    ]
    const edges = [{ source: 'orch1', target: 'orch2' }]
    const ids = getOrchestratorSubagentIds(nodes, edges)
    expect(ids.size).toBe(0)
  })

  it('includes ServiceNodes connected to orchestrators', () => {
    const nodes = [
      { id: 'orch', type: 'orchestratorNode', data: {} },
      { id: 'agent1', type: 'agentNode', data: {} },
      { id: 'svc1', type: 'serviceNode', data: {} }
    ]
    const edges = [
      { source: 'orch', target: 'agent1' },
      { source: 'orch', target: 'svc1' }
    ]
    const ids = getOrchestratorSubagentIds(nodes, edges)
    expect(ids).toContain('agent1')
    expect(ids).toContain('svc1')
  })
})

describe('getSubagentNodes', () => {
  it('returns only AgentNodes connected from the given orchestrator', () => {
    const nodes = [
      { id: 'orch', type: 'orchestratorNode', data: {} },
      { id: 'a1', type: 'agentNode', data: { name: 'A1' } },
      { id: 'a2', type: 'agentNode', data: { name: 'A2' } },
      { id: 'a3', type: 'agentNode', data: { name: 'A3' } }
    ]
    const edges = [
      { source: 'orch', target: 'a1' },
      { source: 'orch', target: 'a2' }
    ]
    const result = getSubagentNodes('orch', nodes, edges)
    expect(result.map(n => n.id)).toEqual(['a1', 'a2'])
  })
})

describe('buildTools', () => {
  it('builds tool definitions from agent nodes', () => {
    const agents = [
      { id: 'n1', type: 'agentNode', data: { name: 'Researcher', systemPrompt: 'You research topics' } },
      { id: 'n2', type: 'agentNode', data: { name: 'Writer', systemPrompt: 'You write articles' } }
    ]
    const result = buildTools(agents)
    expect(result).toHaveLength(2)

    expect(result[0].name).toBe('researcher')
    expect(result[0].nodeId).toBe('n1')
    expect(result[0].tool.name).toBe('researcher')
    expect(result[0].tool.description).toBe('You research topics')
    expect(result[0].tool.input_schema.properties.task.type).toBe('string')

    expect(result[1].name).toBe('writer')
    expect(result[1].nodeId).toBe('n2')
  })

  it('deduplicates tool names by appending node ID suffix', () => {
    const agents = [
      { id: 'node-1234', type: 'agentNode', data: { name: 'Agent', systemPrompt: 'First' } },
      { id: 'node-5678', type: 'agentNode', data: { name: 'Agent', systemPrompt: 'Second' } }
    ]
    const result = buildTools(agents)
    expect(result[0].name).toBe('agent')
    expect(result[1].name).toBe('agent_5678')
  })

  it('falls back to node name when systemPrompt is empty', () => {
    const agents = [
      { id: 'n1', type: 'agentNode', data: { name: 'Helper', systemPrompt: '' } }
    ]
    const result = buildTools(agents)
    expect(result[0].tool.description).toBe('Agent: Helper')
  })

  it('builds service tool with service description', () => {
    const nodes = [
      {
        id: 's1',
        type: 'serviceNode',
        data: {
          name: 'Inventory API',
          serviceType: 'webhook',
          serviceConfig: { url: 'https://api.example.com/inventory', method: 'POST' }
        }
      }
    ]
    const result = buildTools(nodes)
    expect(result).toHaveLength(1)
    expect(result[0].nodeType).toBe('serviceNode')
    expect(result[0].tool.description).toContain('Webhook (HTTP)')
    expect(result[0].tool.description).toContain('https://api.example.com/inventory')
  })

  it('builds mixed agent + service tools', () => {
    const nodes = [
      { id: 'a1', type: 'agentNode', data: { name: 'Writer', systemPrompt: 'Write things' } },
      {
        id: 's1',
        type: 'serviceNode',
        data: {
          name: 'Slack Notify',
          serviceType: 'webhook',
          serviceConfig: { url: 'https://hooks.slack.com/x', method: 'POST' }
        }
      }
    ]
    const result = buildTools(nodes)
    expect(result).toHaveLength(2)
    expect(result[0].nodeType).toBe('agentNode')
    expect(result[1].nodeType).toBe('serviceNode')
  })
})
