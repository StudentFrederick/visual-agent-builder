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
    try {
      // Whitelist only the data fields we define per node type
      const cleanData = d => {
        if (!d) return {}
        const { name, systemPrompt, temperature, maxRounds, serviceType, serviceConfig,
                output, status, currentRound, thinking } = d
        const clean = { name, output, status }
        if (systemPrompt !== undefined) clean.systemPrompt = systemPrompt
        if (temperature !== undefined) clean.temperature = temperature
        if (maxRounds !== undefined) clean.maxRounds = maxRounds
        if (currentRound !== undefined) clean.currentRound = currentRound
        if (thinking !== undefined) clean.thinking = thinking
        if (serviceType !== undefined) clean.serviceType = serviceType
        if (serviceConfig !== undefined) clean.serviceConfig = { ...serviceConfig }
        return clean
      }
      const cleanNodes = nodes.map(n => ({
        id: n.id,
        type: n.type,
        position: { x: n.position?.x ?? 0, y: n.position?.y ?? 0 },
        data: cleanData(n.data)
      }))
      const cleanEdges = edges.map(e => ({
        id: e.id, source: e.source, target: e.target
      }))
      localStorage.setItem(FLOW_KEY, JSON.stringify({ nodes: cleanNodes, edges: cleanEdges }))
    } catch (err) {
      console.warn('Failed to persist flow:', err)
    }
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

  const addServiceNode = useCallback((serviceType) => {
    // Guard: if called directly from onClick, the event object is passed — ignore it
    if (!serviceType || typeof serviceType !== 'string') serviceType = 'webhook'
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
