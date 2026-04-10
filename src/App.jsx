import { useState, useCallback, useMemo } from 'react'
import { Toolbar } from './components/Toolbar.jsx'
import { FlowCanvas } from './components/FlowCanvas.jsx'
import { NodeEditorPanel } from './components/NodeEditorPanel.jsx'
import { InputBar } from './components/InputBar.jsx'
import { SettingsModal } from './components/SettingsModal.jsx'
import { useFlow } from './hooks/useFlow.js'
import { useRunner } from './hooks/useRunner.js'

const API_KEY_STORAGE = 'vab_api_key'

export default function App() {
  const [apiKey, setApiKey] = useState(
    () => localStorage.getItem(API_KEY_STORAGE) || ''
  )
  const [showSettings, setShowSettings] = useState(
    () => !localStorage.getItem(API_KEY_STORAGE)
  )
  const [selectedNodeId, setSelectedNodeId] = useState(null)

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
    clearFlow
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

      <InputBar onRun={handleRun} canRun={canRun} />
    </div>
  )
}
