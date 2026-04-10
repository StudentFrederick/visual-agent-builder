import { describe, it, expect } from 'vitest'
import {
  extractVariables,
  resolvePath,
  resolveTemplate,
  validateVariables,
  extractNodeVariables
} from '../src/utils/template.js'

// ---------------------------------------------------------------------------
// extractVariables
// ---------------------------------------------------------------------------
describe('extractVariables', () => {
  it('returns empty array for empty string', () => {
    expect(extractVariables('')).toEqual([])
  })

  it('returns empty array for null input', () => {
    expect(extractVariables(null)).toEqual([])
  })

  it('returns empty array for undefined input', () => {
    expect(extractVariables(undefined)).toEqual([])
  })

  it('returns empty array when no template variables present', () => {
    expect(extractVariables('Hello world')).toEqual([])
  })

  it('extracts a simple variable with no sub-path', () => {
    const result = extractVariables('{{MyNode.output}}')
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ raw: '{{MyNode.output}}', nodeName: 'MyNode', path: '' })
  })

  it('extracts a variable with a dot-notation sub-path', () => {
    const result = extractVariables('{{DataNode.output.result}}')
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      raw: '{{DataNode.output.result}}',
      nodeName: 'DataNode',
      path: 'result'
    })
  })

  it('extracts a variable with a nested dot-notation sub-path', () => {
    const result = extractVariables('{{DataNode.output.user.name}}')
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      raw: '{{DataNode.output.user.name}}',
      nodeName: 'DataNode',
      path: 'user.name'
    })
  })

  it('handles node names with spaces', () => {
    const result = extractVariables('{{My Agent.output}}')
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ raw: '{{My Agent.output}}', nodeName: 'My Agent', path: '' })
  })

  it('handles node names with spaces and a sub-path', () => {
    const result = extractVariables('{{My Agent.output.score}}')
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      raw: '{{My Agent.output.score}}',
      nodeName: 'My Agent',
      path: 'score'
    })
  })

  it('extracts multiple variables from a single string', () => {
    const result = extractVariables('{{NodeA.output}} and {{NodeB.output.field}}')
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ raw: '{{NodeA.output}}', nodeName: 'NodeA', path: '' })
    expect(result[1]).toEqual({ raw: '{{NodeB.output.field}}', nodeName: 'NodeB', path: 'field' })
  })

  it('ignores malformed variables that have no .output', () => {
    expect(extractVariables('{{NodeA.result}}')).toEqual([])
  })

  it('ignores malformed variables with empty braces', () => {
    expect(extractVariables('{{}}')).toEqual([])
  })

  it('returns empty array for string with only regular braces', () => {
    expect(extractVariables('{NodeA.output}')).toEqual([])
  })

  it('extracts from a mixed string with text around variables', () => {
    const result = extractVariables('Prefix {{Foo.output.bar}} middle {{Baz.output}} suffix')
    expect(result).toHaveLength(2)
    expect(result[0].nodeName).toBe('Foo')
    expect(result[1].nodeName).toBe('Baz')
  })
})

// ---------------------------------------------------------------------------
// resolvePath
// ---------------------------------------------------------------------------
describe('resolvePath', () => {
  it('returns the whole object for empty path', () => {
    const obj = { a: 1 }
    expect(resolvePath(obj, '')).toEqual({ a: 1 })
  })

  it('resolves a top-level key', () => {
    expect(resolvePath({ name: 'Jan' }, 'name')).toBe('Jan')
  })

  it('resolves a nested key via dot notation', () => {
    expect(resolvePath({ user: { name: 'Jan' } }, 'user.name')).toBe('Jan')
  })

  it('resolves deeply nested key', () => {
    expect(resolvePath({ a: { b: { c: 42 } } }, 'a.b.c')).toBe(42)
  })

  it('resolves array index with bracket notation', () => {
    expect(resolvePath({ items: ['a', 'b', 'c'] }, 'items[0]')).toBe('a')
  })

  it('resolves second array element', () => {
    expect(resolvePath({ items: ['a', 'b', 'c'] }, 'items[1]')).toBe('b')
  })

  it('resolves nested path with array access', () => {
    expect(resolvePath({ data: { list: [10, 20] } }, 'data.list[1]')).toBe(20)
  })

  it('returns undefined for a non-existent top-level key', () => {
    expect(resolvePath({ a: 1 }, 'b')).toBeUndefined()
  })

  it('returns undefined for a non-existent nested key', () => {
    expect(resolvePath({ a: { b: 1 } }, 'a.c')).toBeUndefined()
  })

  it('returns undefined for out-of-bounds array index', () => {
    expect(resolvePath({ items: ['a'] }, 'items[5]')).toBeUndefined()
  })

  it('returns undefined when traversing into null', () => {
    expect(resolvePath({ a: null }, 'a.b')).toBeUndefined()
  })

  it('returns undefined for null object', () => {
    expect(resolvePath(null, 'a')).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// resolveTemplate
// ---------------------------------------------------------------------------
describe('resolveTemplate', () => {
  const nodes = [
    { id: '1', data: { name: 'NodeA', output: 'hello world' } },
    { id: '2', data: { name: 'NodeB', output: '{"result": 42}' } },
    { id: '3', data: { name: 'NodeC', output: '{"user": {"name": "Jan"}}' } },
    { id: '4', data: { name: 'NodeD', output: '{"items": ["x", "y", "z"]}' } },
    { id: '5', data: { name: 'My Agent', output: 'agent output' } }
  ]

  it('replaces a simple variable with the node output string', () => {
    expect(resolveTemplate('Result: {{NodeA.output}}', nodes)).toBe('Result: hello world')
  })

  it('resolves a sub-path inside JSON output', () => {
    expect(resolveTemplate('{{NodeB.output.result}}', nodes)).toBe('42')
  })

  it('resolves a nested sub-path inside JSON output', () => {
    expect(resolveTemplate('{{NodeC.output.user.name}}', nodes)).toBe('Jan')
  })

  it('resolves an array index from JSON output', () => {
    expect(resolveTemplate('{{NodeD.output.items[1]}}', nodes)).toBe('y')
  })

  it('resolves a node name with spaces', () => {
    expect(resolveTemplate('{{My Agent.output}}', nodes)).toBe('agent output')
  })

  it('is case-insensitive for node name matching', () => {
    expect(resolveTemplate('{{nodea.output}}', nodes)).toBe('hello world')
    expect(resolveTemplate('{{NODEA.output}}', nodes)).toBe('hello world')
  })

  it('leaves token as-is when node not found', () => {
    expect(resolveTemplate('{{Unknown.output}}', nodes)).toBe('{{Unknown.output}}')
  })

  it('leaves token as-is when output is not valid JSON but a sub-path is requested', () => {
    // NodeA has non-JSON output; requesting a sub-path should leave token
    expect(resolveTemplate('{{NodeA.output.field}}', nodes)).toBe('{{NodeA.output.field}}')
  })

  it('leaves token as-is when path does not exist in JSON', () => {
    expect(resolveTemplate('{{NodeB.output.missing}}', nodes)).toBe('{{NodeB.output.missing}}')
  })

  it('stringifies object values', () => {
    const result = resolveTemplate('{{NodeC.output.user}}', nodes)
    expect(result).toBe(JSON.stringify({ name: 'Jan' }))
  })

  it('stringifies array values', () => {
    const result = resolveTemplate('{{NodeD.output.items}}', nodes)
    expect(result).toBe(JSON.stringify(['x', 'y', 'z']))
  })

  it('resolves multiple variables in one string', () => {
    const result = resolveTemplate('A={{NodeA.output}} B={{NodeB.output.result}}', nodes)
    expect(result).toBe('A=hello world B=42')
  })

  it('returns string unchanged when no variables present', () => {
    expect(resolveTemplate('no variables here', nodes)).toBe('no variables here')
  })

  it('handles node with no output field (leaves token as-is)', () => {
    const sparse = [{ id: '9', data: { name: 'Empty' } }]
    expect(resolveTemplate('{{Empty.output}}', sparse)).toBe('{{Empty.output}}')
  })
})

// ---------------------------------------------------------------------------
// validateVariables
// ---------------------------------------------------------------------------
describe('validateVariables', () => {
  const nodes = [
    { id: '1', data: { name: 'NodeA', output: 'hello' } },
    { id: '2', data: { name: 'My Node', output: 'world' } }
  ]

  it('marks a known node as valid', () => {
    const vars = extractVariables('{{NodeA.output}}')
    const result = validateVariables(vars, nodes)
    expect(result[0].valid).toBe(true)
    expect(result[0].reason).toBeUndefined()
  })

  it('marks an unknown node as invalid with reason', () => {
    const vars = extractVariables('{{Unknown.output}}')
    const result = validateVariables(vars, nodes)
    expect(result[0].valid).toBe(false)
    expect(result[0].reason).toBe('Node "Unknown" not found')
  })

  it('is case-insensitive when matching node names', () => {
    const vars = extractVariables('{{nodea.output}}')
    const result = validateVariables(vars, nodes)
    expect(result[0].valid).toBe(true)
  })

  it('handles node name with spaces', () => {
    const vars = extractVariables('{{My Node.output}}')
    const result = validateVariables(vars, nodes)
    expect(result[0].valid).toBe(true)
  })

  it('validates multiple variables, mixing valid and invalid', () => {
    const vars = extractVariables('{{NodeA.output}} {{Ghost.output}}')
    const result = validateVariables(vars, nodes)
    expect(result[0].valid).toBe(true)
    expect(result[1].valid).toBe(false)
    expect(result[1].reason).toBe('Node "Ghost" not found')
  })

  it('returns empty array for empty variables input', () => {
    expect(validateVariables([], nodes)).toEqual([])
  })

  it('preserves raw, nodeName, path on each result item', () => {
    const vars = extractVariables('{{NodeA.output.field}}')
    const result = validateVariables(vars, nodes)
    expect(result[0].raw).toBe('{{NodeA.output.field}}')
    expect(result[0].nodeName).toBe('NodeA')
    expect(result[0].path).toBe('field')
  })
})

// ---------------------------------------------------------------------------
// extractNodeVariables
// ---------------------------------------------------------------------------
describe('extractNodeVariables', () => {
  it('extracts variables from systemPrompt of an agent node', () => {
    const node = {
      type: 'agent',
      data: { systemPrompt: 'Use {{NodeA.output}} as context' }
    }
    const result = extractNodeVariables(node)
    expect(result).toHaveLength(1)
    expect(result[0].nodeName).toBe('NodeA')
  })

  it('extracts variables from systemPrompt of an orchestrator node', () => {
    const node = {
      type: 'orchestrator',
      data: { systemPrompt: 'Route based on {{Classifier.output.label}}' }
    }
    const result = extractNodeVariables(node)
    expect(result).toHaveLength(1)
    expect(result[0].path).toBe('label')
  })

  it('extracts variables from service node url', () => {
    const node = {
      type: 'service',
      data: { serviceConfig: { url: 'https://api.example.com/{{NodeA.output}}', headers: {} } }
    }
    const result = extractNodeVariables(node)
    expect(result).toHaveLength(1)
    expect(result[0].nodeName).toBe('NodeA')
  })

  it('extracts variables from service node headers (stringified)', () => {
    const node = {
      type: 'service',
      data: {
        serviceConfig: {
          url: 'https://api.example.com',
          headers: { Authorization: 'Bearer {{TokenNode.output.token}}' }
        }
      }
    }
    const result = extractNodeVariables(node)
    expect(result).toHaveLength(1)
    expect(result[0].nodeName).toBe('TokenNode')
    expect(result[0].path).toBe('token')
  })

  it('deduplicates variables with the same raw string', () => {
    const node = {
      type: 'agent',
      data: { systemPrompt: '{{NodeA.output}} plus {{NodeA.output}} again' }
    }
    const result = extractNodeVariables(node)
    expect(result).toHaveLength(1)
  })

  it('deduplicates across fields (url and headers)', () => {
    const node = {
      type: 'service',
      data: {
        serviceConfig: {
          url: 'https://api.example.com/{{NodeA.output}}',
          headers: { 'X-Token': '{{NodeA.output}}' }
        }
      }
    }
    const result = extractNodeVariables(node)
    expect(result).toHaveLength(1)
  })

  it('returns multiple unique variables', () => {
    const node = {
      type: 'agent',
      data: { systemPrompt: '{{NodeA.output}} and {{NodeB.output.field}}' }
    }
    const result = extractNodeVariables(node)
    expect(result).toHaveLength(2)
  })

  it('returns empty array when no serviceConfig on service node', () => {
    const node = { type: 'service', data: {} }
    expect(extractNodeVariables(node)).toEqual([])
  })

  it('returns empty array when systemPrompt is absent', () => {
    const node = { type: 'agent', data: {} }
    expect(extractNodeVariables(node)).toEqual([])
  })

  it('returns empty array for a node with no recognisable fields', () => {
    const node = { type: 'other', data: {} }
    expect(extractNodeVariables(node)).toEqual([])
  })
})
