// src/hooks/useRunner.js
import { useCallback, useRef } from 'react'
import { topologicalSort } from '../utils/topology.js'
import { streamClaudeResponse } from '../utils/claude.js'

export function useRunner({ nodes, edges, updateNodeData }) {
  const isRunning = useRef(false)

  const run = useCallback(
    async apiKey => {
      if (isRunning.current) return
      isRunning.current = true

      try {
        const sorted = topologicalSort(nodes, edges)
        let prevOutput = ''

        for (const node of sorted) {
          updateNodeData(node.id, { status: 'running', output: '' })
          try {
            const output = await streamClaudeResponse({
              apiKey,
              systemPrompt: node.data.systemPrompt,
              userMessage: prevOutput,
              temperature: node.data.temperature,
              onChunk: text => updateNodeData(node.id, { output: text })
            })
            updateNodeData(node.id, { status: 'done', output })
            prevOutput = output
          } catch (err) {
            updateNodeData(node.id, { status: 'error', output: err.message })
            throw err
          }
        }
      } finally {
        isRunning.current = false
      }
    },
    [nodes, edges, updateNodeData]
  )

  return { run, isRunning }
}
