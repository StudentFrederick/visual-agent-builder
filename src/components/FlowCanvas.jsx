import { ReactFlow, Background, Controls, MiniMap } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
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

export function FlowCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeClick
}) {
  return (
    <div className="flex-1 h-full">
      <ReactFlow
        nodes={nodes}
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
    </div>
  )
}
