import { describe, it, expect } from 'vitest'
import { topologicalSort } from '../src/utils/topology.js'

describe('topologicalSort', () => {
  it('returns a single node unchanged', () => {
    const nodes = [{ id: 'a', data: {} }]
    const edges = []
    const result = topologicalSort(nodes, edges)
    expect(result.map(n => n.id)).toEqual(['a'])
  })

  it('sorts two connected nodes source-first', () => {
    const nodes = [{ id: 'b', data: {} }, { id: 'a', data: {} }]
    const edges = [{ source: 'a', target: 'b' }]
    const result = topologicalSort(nodes, edges)
    expect(result.map(n => n.id)).toEqual(['a', 'b'])
  })

  it('sorts a three-node chain in order', () => {
    const nodes = [
      { id: 'c', data: {} },
      { id: 'a', data: {} },
      { id: 'b', data: {} }
    ]
    const edges = [
      { source: 'a', target: 'b' },
      { source: 'b', target: 'c' }
    ]
    const result = topologicalSort(nodes, edges)
    expect(result.map(n => n.id)).toEqual(['a', 'b', 'c'])
  })

  it('throws on a cycle', () => {
    const nodes = [{ id: 'a', data: {} }, { id: 'b', data: {} }]
    const edges = [
      { source: 'a', target: 'b' },
      { source: 'b', target: 'a' }
    ]
    expect(() => topologicalSort(nodes, edges)).toThrow('Cycle detected in flow')
  })
})
