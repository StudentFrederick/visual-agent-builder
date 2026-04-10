/**
 * Topologically sorts nodes using Kahn's algorithm.
 * @param {Array<{id: string}>} nodes
 * @param {Array<{source: string, target: string}>} edges
 * @returns {Array<{id: string}>} nodes in execution order
 * @throws {Error} if a cycle is detected
 */
export function topologicalSort(nodes, edges) {
  const inDegree = {}
  const graph = {}

  for (const node of nodes) {
    inDegree[node.id] = 0
    graph[node.id] = []
  }

  for (const edge of edges) {
    graph[edge.source].push(edge.target)
    inDegree[edge.target]++
  }

  const queue = nodes.filter(n => inDegree[n.id] === 0).map(n => n.id)
  const result = []

  while (queue.length > 0) {
    const id = queue.shift()
    result.push(id)
    for (const neighbor of graph[id]) {
      inDegree[neighbor]--
      if (inDegree[neighbor] === 0) queue.push(neighbor)
    }
  }

  if (result.length !== nodes.length) {
    throw new Error('Cycle detected in flow')
  }

  return result.map(id => nodes.find(n => n.id === id))
}
