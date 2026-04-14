import { describe, it, expect } from 'vitest'
import { parseFlowJson, layoutNodes } from '../src/utils/flow-generator.js'

describe('parseFlowJson', () => {
  it('parses a valid two-node flow', () => {
    const json = JSON.stringify({
      nodes: [
        { type: 'agentNode', name: 'Writer', systemPrompt: 'Write a poem.', temperature: 0.7 },
        { type: 'agentNode', name: 'Critic', systemPrompt: 'Critique the poem.', temperature: 0.3 }
      ],
      edges: [{ from: 0, to: 1 }]
    })
    const result = parseFlowJson(json)
    expect(result.nodes).toHaveLength(2)
    expect(result.nodes[0].name).toBe('Writer')
    expect(result.nodes[1].name).toBe('Critic')
    expect(result.edges).toEqual([{ from: 0, to: 1 }])
  })

  it('filters out nodes with invalid types', () => {
    const json = JSON.stringify({
      nodes: [
        { type: 'agentNode', name: 'Good', systemPrompt: '', temperature: 0.7 },
        { type: 'invalidType', name: 'Bad', systemPrompt: '' }
      ],
      edges: []
    })
    const result = parseFlowJson(json)
    expect(result.nodes).toHaveLength(1)
    expect(result.nodes[0].name).toBe('Good')
  })

  it('filters out edges with invalid indices', () => {
    const json = JSON.stringify({
      nodes: [
        { type: 'agentNode', name: 'A', systemPrompt: '', temperature: 0.7 }
      ],
      edges: [{ from: 0, to: 5 }]
    })
    const result = parseFlowJson(json)
    expect(result.edges).toHaveLength(0)
  })

  it('throws on invalid JSON', () => {
    expect(() => parseFlowJson('not json')).toThrow()
  })

  it('throws on missing nodes array', () => {
    expect(() => parseFlowJson(JSON.stringify({ edges: [] }))).toThrow()
  })

  it('throws when all nodes are invalid', () => {
    const json = JSON.stringify({
      nodes: [{ type: 'fake', name: 'X' }],
      edges: []
    })
    expect(() => parseFlowJson(json)).toThrow()
  })

  it('parses orchestrator nodes with maxRounds', () => {
    const json = JSON.stringify({
      nodes: [
        { type: 'orchestratorNode', name: 'Boss', systemPrompt: 'Coordinate.', temperature: 0.5, maxRounds: 8 }
      ],
      edges: []
    })
    const result = parseFlowJson(json)
    expect(result.nodes[0].type).toBe('orchestratorNode')
    expect(result.nodes[0].maxRounds).toBe(8)
  })

  it('parses service nodes with serviceType and serviceConfig', () => {
    const json = JSON.stringify({
      nodes: [
        { type: 'serviceNode', name: 'Slack', serviceType: 'slack', serviceConfig: { message: 'hello' } }
      ],
      edges: []
    })
    const result = parseFlowJson(json)
    expect(result.nodes[0].serviceType).toBe('slack')
    expect(result.nodes[0].serviceConfig).toEqual({ message: 'hello' })
  })

  it('strips markdown code fences from response', () => {
    const inner = JSON.stringify({
      nodes: [{ type: 'agentNode', name: 'A', systemPrompt: 'Do it.', temperature: 0.7 }],
      edges: []
    })
    const wrapped = '```json\n' + inner + '\n```'
    const result = parseFlowJson(wrapped)
    expect(result.nodes).toHaveLength(1)
  })
})

describe('layoutNodes', () => {
  it('positions a linear chain horizontally', () => {
    const nodes = [
      { type: 'agentNode', name: 'A' },
      { type: 'agentNode', name: 'B' },
      { type: 'agentNode', name: 'C' }
    ]
    const edges = [{ from: 0, to: 1 }, { from: 1, to: 2 }]
    const result = layoutNodes(nodes, edges, { offsetX: 0, offsetY: 0 })
    expect(result[0].position.x).toBe(100)
    expect(result[1].position.x).toBe(380)
    expect(result[2].position.x).toBe(660)
    expect(result[0].position.y).toBe(150)
    expect(result[1].position.y).toBe(150)
    expect(result[2].position.y).toBe(150)
  })

  it('stacks orchestrator subagents vertically', () => {
    const nodes = [
      { type: 'orchestratorNode', name: 'Boss' },
      { type: 'agentNode', name: 'Worker1' },
      { type: 'agentNode', name: 'Worker2' }
    ]
    const edges = [{ from: 0, to: 1 }, { from: 0, to: 2 }]
    const result = layoutNodes(nodes, edges, { offsetX: 0, offsetY: 0 })
    expect(result[0].position.x).toBe(100)
    expect(result[1].position.x).toBe(380)
    expect(result[2].position.x).toBe(380)
    expect(result[1].position.y).toBeLessThan(result[2].position.y)
  })

  it('applies offsets for append mode', () => {
    const nodes = [{ type: 'agentNode', name: 'A' }]
    const edges = []
    const result = layoutNodes(nodes, edges, { offsetX: 0, offsetY: 400 })
    expect(result[0].position.y).toBe(550)
  })
})
