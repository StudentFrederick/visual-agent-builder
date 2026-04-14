// src/hooks/useRunner.js
import { useCallback, useRef, useState } from 'react'
import { topologicalSort } from '../utils/topology.js'
import { streamClaudeResponse } from '../utils/claude.js'
import { executeService } from '../utils/service-registry.js'
import {
  getOrchestratorSubagentIds,
  getSubagentNodes,
  executeOrchestrator
} from '../utils/orchestrator.js'
import { resolveTemplate } from '../utils/template.js'

export function useRunner({ nodes, edges, updateNodeData, activateEdges, resetEdgeStyles }) {
  const [isRunning, setIsRunning] = useState(false)
  const controllerRef = useRef(null)

  const stop = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.abort()
      controllerRef.current = null
    }
  }, [])

  const run = useCallback(
    async (apiKey, initialInput = '') => {
      if (isRunning) return
      const controller = new AbortController()
      controllerRef.current = controller
      setIsRunning(true)

      try {
        const sorted = topologicalSort(nodes, edges)
        const subagentIds = getOrchestratorSubagentIds(nodes, edges)
        let prevOutput = initialInput

        for (const node of sorted) {
          if (controller.signal.aborted) break
          if (subagentIds.has(node.id)) continue

          updateNodeData(node.id, { status: 'running', output: '' })

          const resolvedPrompt = resolveTemplate(node.data.systemPrompt || '', nodes)
          const resolvedConfig = node.data.serviceConfig
            ? {
                ...node.data.serviceConfig,
                url: resolveTemplate(node.data.serviceConfig.url || '', nodes),
                headers: resolveTemplate(node.data.serviceConfig.headers || '', nodes)
              }
            : null

          try {
            let output

            if (node.type === 'orchestratorNode') {
              const subagents = getSubagentNodes(node.id, nodes, edges)
              const resolvedNode = { ...node, data: { ...node.data, systemPrompt: resolvedPrompt } }
              output = await executeOrchestrator({
                apiKey,
                node: resolvedNode,
                subagentNodes: subagents,
                userMessage: prevOutput,
                onUpdate: data => updateNodeData(node.id, data),
                onSubagentUpdate: (id, data) => updateNodeData(id, data),
                onEdgeActivate: (sourceId, targetIds, active) =>
                  activateEdges(sourceId, targetIds, active),
                signal: controller.signal
              })
            } else if (node.type === 'serviceNode') {
              output = await executeService(node.data.serviceType, resolvedConfig, prevOutput)
            } else {
              output = await streamClaudeResponse({
                apiKey,
                systemPrompt: resolvedPrompt,
                userMessage: prevOutput,
                temperature: node.data.temperature,
                onChunk: text => updateNodeData(node.id, { output: text }),
                signal: controller.signal
              })
            }

            if (controller.signal.aborted) {
              updateNodeData(node.id, { status: 'cancelled', output: output || 'Cancelled' })
              break
            }

            updateNodeData(node.id, { status: 'done', output })
            prevOutput = output
          } catch (err) {
            if (controller.signal.aborted) {
              updateNodeData(node.id, { status: 'cancelled', output: 'Cancelled' })
              break
            }
            updateNodeData(node.id, { status: 'error', output: err.message })
            throw err
          }
        }
      } finally {
        controllerRef.current = null
        setIsRunning(false)
        resetEdgeStyles()
      }
    },
    [nodes, edges, updateNodeData, activateEdges, resetEdgeStyles, isRunning]
  )

  return { run, stop, isRunning }
}
