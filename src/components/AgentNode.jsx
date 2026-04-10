import { Handle, Position } from '@xyflow/react'

const statusStyles = {
  idle: 'border-gray-300 bg-white',
  running: 'border-yellow-400 bg-yellow-50',
  done: 'border-green-400 bg-green-50',
  error: 'border-red-400 bg-red-50'
}

export function AgentNode({ data, selected }) {
  const style = statusStyles[data.status] ?? statusStyles.idle

  return (
    <div
      className={`rounded-lg border-2 p-3 w-56 shadow-sm transition-colors ${style} ${
        selected ? 'ring-2 ring-blue-500 ring-offset-1' : ''
      }`}
    >
      <Handle type="target" position={Position.Left} />

      <div className="font-semibold text-sm text-gray-800 truncate mb-1">
        {data.name || 'Agent'}
      </div>

      {data.status === 'running' && (
        <div className="text-xs text-yellow-600 animate-pulse">Running…</div>
      )}

      {data.status === 'error' && (
        <div className="text-xs text-red-600 mt-1 max-h-32 overflow-y-auto break-words">{data.output}</div>
      )}

      {(data.status === 'running' || data.status === 'done') && data.output && (
        <div className="text-xs text-gray-600 mt-1 max-h-32 overflow-y-auto whitespace-pre-wrap">
          {data.output}
        </div>
      )}

      <Handle type="source" position={Position.Right} />
    </div>
  )
}
