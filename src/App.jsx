import { useState, useCallback, useMemo } from 'react'
import { Toolbar } from './components/Toolbar.jsx'
import { FlowCanvas } from './components/FlowCanvas.jsx'
import { NodeEditorPanel } from './components/NodeEditorPanel.jsx'
import { InputBar } from './components/InputBar.jsx'
import { SettingsModal } from './components/SettingsModal.jsx'
import { useFlow } from './hooks/useFlow.js'
import { useRunner } from './hooks/useRunner.js'
import { generateFlow, layoutNodes } from './utils/flow-generator.js'

const API_KEY_STORAGE = 'vab_api_key'

export default function App() {
  const [apiKey, setApiKey] = useState(
    () => localStorage.getItem(API_KEY_STORAGE) || ''
  )
  const [showSettings, setShowSettings] = useState(
    () => !localStorage.getItem(API_KEY_STORAGE)
  )
  const [selectedNodeId, setSelectedNodeId] = useState(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generateError, setGenerateError] = useState('')

  const {
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
    clearFlow,
    replaceFlow,
    appendFlow
  } = useFlow()

  const { run, isRunning } = useRunner({ nodes, edges, updateNodeData, activateEdges, resetEdgeStyles })

  const selectedNode = useMemo(
    () => (selectedNodeId ? nodes.find(n => n.id === selectedNodeId) || null : null),
    [nodes, selectedNodeId]
  )

  const canRun = !!apiKey && nodes.length > 0 && !isRunning.current

  const handleSaveKey = useCallback(key => {
    localStorage.setItem(API_KEY_STORAGE, key)
    setApiKey(key)
    setShowSettings(false)
  }, [])

  const handleRun = useCallback(async (initialInput = '') => {
    try {
      await run(apiKey, initialInput)
    } catch (err) {
      console.error('Run failed:', err)
    }
  }, [run, apiKey])

  const handleNodeClick = useCallback(node => {
    setSelectedNodeId(node.id)
  }, [])

  const handleNodeChange = useCallback(
    (id, data) => {
      updateNodeData(id, data)
    },
    [updateNodeData]
  )

  const handleClear = useCallback(() => {
    clearFlow()
    setSelectedNodeId(null)
  }, [clearFlow])

  const handleGenerate = useCallback(async (description, mode) => {
    if (!apiKey) {
      setShowSettings(true)
      return
    }

    setIsGenerating(true)
    setGenerateError('')

    try {
      const { nodes: parsedNodes, edges: parsedEdges } = await generateFlow(apiKey, description)

      const offsetY = mode === 'append' && nodes.length > 0
        ? Math.max(...nodes.map(n => n.position?.y ?? 0)) + 200
        : 0

      const positioned = layoutNodes(parsedNodes, parsedEdges, { offsetX: 0, offsetY })

      const rfNodes = positioned.map((n, i) => {
        const id = `node-${Date.now()}-${i}`
        const data = { name: n.name, output: '', status: 'idle' }
        if (n.type === 'agentNode' || n.type === 'orchestratorNode') {
          data.systemPrompt = n.systemPrompt
          data.temperature = n.temperature
        }
        if (n.type === 'orchestratorNode') {
          data.maxRounds = n.maxRounds || 5
          data.currentRound = 0
        }
        if (n.type === 'serviceNode') {
          data.serviceType = n.serviceType || 'webhook'
          data.serviceConfig = n.serviceConfig || {}
        }
        return { id, type: n.type, position: n.position, data }
      })

      const rfEdges = parsedEdges.map(e => ({
        id: `edge-${rfNodes[e.from].id}-${rfNodes[e.to].id}`,
        source: rfNodes[e.from].id,
        target: rfNodes[e.to].id
      }))

      if (mode === 'append') {
        appendFlow(rfNodes, rfEdges)
      } else {
        replaceFlow(rfNodes, rfEdges)
      }
    } catch (err) {
      setGenerateError(err.message)
    } finally {
      setIsGenerating(false)
    }
  }, [apiKey, nodes, replaceFlow, appendFlow])

  return (
    <div className="h-screen flex flex-col">
      {showSettings && <SettingsModal onSave={handleSaveKey} />}

      <Toolbar
        onAddNode={addNode}
        onAddOrchestrator={addOrchestratorNode}
        onAddService={() => addServiceNode()}
        onRun={() => handleRun('')}
        onClear={handleClear}
        onSettings={() => setShowSettings(true)}
        canRun={canRun}
      />

      <div className="flex-1 flex overflow-hidden">
        <FlowCanvas
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={handleNodeClick}
        />
        <NodeEditorPanel
          node={selectedNode}
          onChange={handleNodeChange}
          onClose={() => setSelectedNodeId(null)}
        />
      </div>

      <InputBar
        onRun={handleRun}
        onGenerate={handleGenerate}
        canRun={canRun}
        canGenerate={!!apiKey && !isGenerating}
        isGenerating={isGenerating}
        generateError={generateError}
        hasNodes={nodes.length > 0}
      />
    </div>
  )
}
