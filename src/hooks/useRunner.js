// src/hooks/useRunner.js
import { useCallback, useRef } from 'react'
import { topologicalSort } from '../utils/topology.js'
import { streamClaudeResponse } from '../utils/claude.js'
import {
  getOrchestratorSubagentIds,
  getSubagentNodes,
  executeOrchestrator
} from '../utils/orchestrator.js'

export function useRunner({ nodes, edges, updateNodeData }) {
  const isRunning = useRef(false)

  const run = useCallback(
    async apiKey => {
      if (isRunning.current) return
      isRunning.current = true

      try {
        const sorted = topologicalSort(nodes, edges)

        // Identify nodes that are subagents of an orchestrator — skip them in the main loop
        const subagentIds = getOrchestratorSubagentIds(nodes, edges)

        let prevOutput = ''

        for (const node of sorted) {
          // Skip subagent nodes — they are executed by their orchestrator
          if (subagentIds.has(node.id)) continue

          updateNodeData(node.id, { status: 'running', output: '' })

          try {
            let output

            if (node.type === 'orchestratorNode') {
              // Orchestrator: use agentic loop with tool use
              const subagents = getSubagentNodes(node.id, nodes, edges)
              output = await executeOrchestrator({
                apiKey,
                node,
                subagentNodes: subagents,
                userMessage: prevOutput,
                onUpdate: data => updateNodeData(node.id, data),
                onSubagentUpdate: (id, data) => updateNodeData(id, data)
              })
            } else {
              // Regular agent: simple streaming call
              output = await streamClaudeResponse({
                apiKey,
                systemPrompt: node.data.systemPrompt,
                userMessage: prevOutput,
                temperature: node.data.temperature,
                onChunk: text => updateNodeData(node.id, { output: text })
              })
            }

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
