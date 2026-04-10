// src/hooks/useRunner.js
import { useCallback } from 'react'
import { topologicalSort } from '../utils/topology.js'
import { streamClaudeResponse } from '../utils/claude.js'

export function useRunner({ nodes, edges, updateNodeData }) {
  const run = useCallback(
    async apiKey => {
      const sorted = topologicalSort(nodes, edges)
      let prevOutput = ''

      for (const node of sorted) {
        updateNodeData(node.id, { status: 'running', output: '' })
        try {
          await streamClaudeResponse({
            apiKey,
            systemPrompt: node.data.systemPrompt,
            userMessage: prevOutput,
            temperature: node.data.temperature,
            onChunk: text => updateNodeData(node.id, { output: text }),
            onDone: text => {
              updateNodeData(node.id, { status: 'done', output: text })
              prevOutput = text
            }
          })
        } catch (err) {
          updateNodeData(node.id, { status: 'error', output: err.message })
          throw err
        }
      }
    },
    [nodes, edges, updateNodeData]
  )

  return { run }
}
