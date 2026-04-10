// src/hooks/useFlow.js
import { useState, useEffect, useCallback } from 'react'
import { addEdge, applyNodeChanges, applyEdgeChanges } from '@xyflow/react'

const FLOW_KEY = 'vab_flow'

const VALID_TYPES = new Set(['agentNode', 'orchestratorNode', 'serviceNode'])

function loadFlow() {
  try {
    const saved = localStorage.getItem(FLOW_KEY)
    if (!saved) return { nodes: [], edges: [] }
    const parsed = JSON.parse(saved)
    // Filter out nodes with unknown types (from old/corrupt data)
    const nodes = (parsed.nodes || []).filter(n => VALID_TYPES.has(n.type))
    const validIds = new Set(nodes.map(n => n.id))
    const edges = (parsed.edges || []).filter(
      e => validIds.has(e.source) && validIds.has(e.target)
    )
    return { nodes, edges }
  } catch {
    return { nodes: [], edges: [] }
  }
}

export function useFlow() {
  const [nodes, setNodes] = useState(() => loadFlow().nodes)
  const [edges, setEdges] = useState(() => loadFlow().edges)

  useEffect(() => {
    // Strip React Flow internal properties to avoid cyclic JSON errors
    const cleanNodes = nodes.map(({ id, type, position, data }) => ({ id, type, position, data }))
    const cleanEdges = edges.map(({ id, source, target, animated, style }) => ({ id, source, target, animated, style }))
    localStorage.setItem(FLOW_KEY, JSON.stringify({ nodes: cleanNodes, edges: cleanEdges }))
  }, [nodes, edges])

  const onNodesChange = useCallback(
    changes => setNodes(ns => applyNodeChanges(changes, ns)),
    []
  )

  const onEdgesChange = useCallback(
    changes => setEdges(es => applyEdgeChanges(changes, es)),
    []
  )

  const onConnect = useCallback(
    connection => setEdges(es => addEdge(connection, es)),
    []
  )

  const addNode = useCallback(() => {
    const id = `node-${Date.now()}`
    setNodes(ns => [
      ...ns,
      {
        id,
        type: 'agentNode',
        position: { x: 100 + ns.length * 240, y: 150 },
        data: {
          name: 'New Agent',
          systemPrompt: '',
          temperature: 0.7,
          output: '',
          status: 'idle'
        }
      }
    ])
  }, [])

  const addOrchestratorNode = useCallback(() => {
    const id = `node-${Date.now()}`
    setNodes(ns => [
      ...ns,
      {
        id,
        type: 'orchestratorNode',
        position: { x: 100 + ns.length * 240, y: 150 },
        data: {
          name: 'Orchestrator',
          systemPrompt: '',
          temperature: 0.7,
          maxRounds: 5,
          output: '',
          status: 'idle',
          currentRound: 0
        }
      }
    ])
  }, [])

  const addServiceNode = useCallback((serviceType = 'webhook') => {
    const id = `node-${Date.now()}`
    setNodes(ns => [
      ...ns,
      {
        id,
        type: 'serviceNode',
        position: { x: 100 + ns.length * 240, y: 150 },
        data: {
          name: 'Webhook',
          serviceType,
          serviceConfig: {
            url: '',
            method: 'POST',
            headers: '{"Content-Type": "application/json"}'
          },
          output: '',
          status: 'idle'
        }
      }
    ])
  }, [])

  const updateNodeData = useCallback((id, data) => {
    setNodes(ns =>
      ns.map(n => (n.id === id ? { ...n, data: { ...n.data, ...data } } : n))
    )
  }, [])

  const activateEdges = useCallback((sourceId, targetIds, active) => {
    setEdges(es =>
      es.map(e => {
        if (e.source === sourceId && targetIds.includes(e.target)) {
          return {
            ...e,
            animated: active,
            style: active
              ? { stroke: '#a855f7', strokeWidth: 2.5 }
              : { stroke: undefined, strokeWidth: undefined }
          }
        }
        return e
      })
    )
  }, [])

  const resetEdgeStyles = useCallback(() => {
    setEdges(es =>
      es.map(e => ({ ...e, animated: false, style: {} }))
    )
  }, [])

  const clearFlow = useCallback(() => {
    setNodes([])
    setEdges([])
  }, [])

  return {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    addOrchestratorNode,
    addServiceNode,
    updateNodeData,
    activateEdges,
    resetEdgeStyles,
    clearFlow
  }
}
