import { ReactFlow, ReactFlowProvider, Background, Controls, MiniMap, useReactFlow } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useMemo, useCallback } from 'react'
import { AgentNode } from './AgentNode.jsx'
import { OrchestratorNode } from './OrchestratorNode.jsx'
import { ServiceNode } from './ServiceNode.jsx'

const nodeTypes = {
  agentNode: AgentNode,
  orchestratorNode: OrchestratorNode,
  serviceNode: ServiceNode
}

const miniMapColor = node => {
  if (node.type === 'orchestratorNode') return '#9333ea'
  if (node.type === 'serviceNode') return '#ea580c'
  return '#6366f1'
}

function FlowCanvasInner({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeClick
}) {
  const { setCenter } = useReactFlow()

  const handleNavigateToNode = useCallback((nodeId) => {
    const node = nodes.find(n => n.id === nodeId)
    if (!node) return
    setCenter(node.position.x + 112, node.position.y + 50, { zoom: 1.5, duration: 500 })
  }, [nodes, setCenter])

  const enrichedNodes = useMemo(() =>
    nodes.map(n => ({
      ...n,
      data: { ...n.data, _allNodes: nodes, _onNavigateToNode: handleNavigateToNode }
    })),
    [nodes, handleNavigateToNode]
  )

  return (
    <ReactFlow
      nodes={enrichedNodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onNodeClick={(_, node) => onNodeClick(node)}
      nodeTypes={nodeTypes}
      fitView
      deleteKeyCode="Delete"
    >
      <Background />
      <Controls />
      <MiniMap nodeColor={miniMapColor} />
    </ReactFlow>
  )
}

export function FlowCanvas(props) {
  return (
    <div className="flex-1 h-full">
      <ReactFlowProvider>
        <FlowCanvasInner {...props} />
      </ReactFlowProvider>
    </div>
  )
}
