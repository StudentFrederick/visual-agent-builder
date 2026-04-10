import { Handle, Position } from '@xyflow/react'
import { VariableBadges } from './VariableBadges.jsx'

const statusStyles = {
  idle: 'border-purple-300 bg-purple-50',
  thinking: 'border-purple-400 bg-purple-50',
  calling_subagent: 'border-yellow-400 bg-yellow-50',
  running: 'border-yellow-400 bg-yellow-50',
  done: 'border-green-400 bg-green-50',
  error: 'border-red-400 bg-red-50'
}

const statusBadges = {
  idle: { label: 'Idle', color: 'bg-gray-200 text-gray-600' },
  thinking: { label: 'Thinking', color: 'bg-purple-200 text-purple-700' },
  calling_subagent: { label: 'Calling agents', color: 'bg-yellow-200 text-yellow-800' },
  running: { label: 'Running', color: 'bg-yellow-200 text-yellow-800' },
  done: { label: 'Done', color: 'bg-green-200 text-green-700' },
  error: { label: 'Error', color: 'bg-red-200 text-red-700' }
}

export function OrchestratorNode({ data, selected }) {
  const style = statusStyles[data.status] ?? statusStyles.idle
  const badge = statusBadges[data.status] ?? statusBadges.idle

  return (
    <div
      className={`rounded-lg border-2 p-3 w-64 shadow-sm transition-colors ${style} ${
        selected ? 'ring-2 ring-purple-500 ring-offset-1' : ''
      }`}
    >
      <Handle type="target" position={Position.Left} />

      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-purple-600 text-sm shrink-0" title="Orchestrator">&#129504;</span>
          <span className="font-semibold text-sm text-gray-800 truncate">
            {data.name || 'Orchestrator'}
          </span>
        </div>
        <span className={`status-badge shrink-0 ${badge.color}`}>
          {badge.label}
        </span>
      </div>

      {data.currentRound > 0 && data.status !== 'done' && data.status !== 'idle' && (
        <div className="text-[10px] text-gray-500 mb-1">
          Round {data.currentRound}/{data.maxRounds || 5}
        </div>
      )}

      {data.thinking && data.status !== 'done' && (
        <div className="thinking-bubble">
          &#128173; {data.thinking}
        </div>
      )}

      {data.status === 'error' && (
        <div className="text-xs text-red-600 mt-1 max-h-24 overflow-y-auto break-words">{data.output}</div>
      )}

      {data.status === 'done' && data.output && (
        <div className="text-xs text-gray-600 mt-1 max-h-32 overflow-y-auto whitespace-pre-wrap">
          {data.output}
        </div>
      )}

      <VariableBadges
        node={{ type: 'orchestratorNode', data }}
        allNodes={data._allNodes || []}
        onNavigateToNode={data._onNavigateToNode}
      />

      <Handle type="source" position={Position.Right} />
    </div>
  )
}
