import { useState, useCallback } from 'react'
import { Toolbar } from './components/Toolbar.jsx'
import { FlowCanvas } from './components/FlowCanvas.jsx'
import { NodeEditorPanel } from './components/NodeEditorPanel.jsx'
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
  const [selectedNode, setSelectedNode] = useState(null)

  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    addOrchestratorNode,
    updateNodeData,
    clearFlow
  } = useFlow()

  const { run, isRunning } = useRunner({ nodes, edges, updateNodeData })

  const handleSaveKey = useCallback(key => {
    localStorage.setItem(API_KEY_STORAGE, key)
    setApiKey(key)
    setShowSettings(false)
  }, [])

  const handleRun = useCallback(async () => {
    try {
      await run(apiKey)
    } catch (err) {
      console.error('Run failed:', err)
    }
  }, [run, apiKey])

  const handleNodeClick = useCallback(node => {
    setSelectedNode(node)
  }, [])

  const handleNodeChange = useCallback(
    (id, data) => {
      updateNodeData(id, data)
      setSelectedNode(prev =>
        prev?.id === id ? { ...prev, data: { ...prev.data, ...data } } : prev
      )
    },
    [updateNodeData]
  )

  const handleClear = useCallback(() => {
    clearFlow()
    setSelectedNode(null)
  }, [clearFlow])

  return (
    <div className="h-screen flex flex-col">
      {showSettings && <SettingsModal onSave={handleSaveKey} />}

      <Toolbar
        onAddNode={addNode}
        onAddOrchestrator={addOrchestratorNode}
        onRun={handleRun}
        onClear={handleClear}
        onSettings={() => setShowSettings(true)}
        canRun={!!apiKey && nodes.length > 0 && !isRunning.current}
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
          onClose={() => setSelectedNode(null)}
        />
      </div>
    </div>
  )
}
