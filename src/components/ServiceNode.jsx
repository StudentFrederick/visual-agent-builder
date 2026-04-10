import { Handle, Position } from '@xyflow/react'
import { VariableBadges } from './VariableBadges.jsx'
import { SERVICE_TYPES } from '../utils/service-registry.js'

const statusStyles = {
  idle: 'border-orange-300 bg-orange-50',
  running: 'border-yellow-400 bg-yellow-50',
  done: 'border-green-400 bg-green-50',
  error: 'border-red-400 bg-red-50'
}

const statusBadges = {
  idle: { label: 'Idle', color: 'bg-gray-200 text-gray-600' },
  running: { label: 'Calling', color: 'bg-yellow-200 text-yellow-800' },
  done: { label: 'Done', color: 'bg-green-200 text-green-700' },
  error: { label: 'Error', color: 'bg-red-200 text-red-700' }
}

export function ServiceNode({ data, selected }) {
  const style = statusStyles[data.status] ?? statusStyles.idle
  const badge = statusBadges[data.status] ?? statusBadges.idle
  const service = SERVICE_TYPES[data.serviceType]

  return (
    <div
      className={`rounded-lg border-2 p-3 w-56 shadow-sm transition-colors ${style} ${
        selected ? 'ring-2 ring-orange-500 ring-offset-1' : ''
      }`}
    >
      <Handle type="target" position={Position.Left} />

      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-orange-500 text-sm shrink-0" title="Service">
            {service?.icon || 'S'}
          </span>
          <span className="font-semibold text-sm text-gray-800 truncate">
            {data.name || 'Service'}
          </span>
        </div>
        <span className={`status-badge shrink-0 ${badge.color}`}>
          {badge.label}
        </span>
      </div>

      <div className="text-[10px] text-orange-600 font-medium mb-1">
        {service?.label || data.serviceType}
        {data.serviceConfig?.method && ` (${data.serviceConfig.method})`}
      </div>

      {data.status === 'running' && (
        <div className="text-xs text-yellow-600 animate-pulse">Executing…</div>
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
        node={{ type: 'serviceNode', data }}
        allNodes={data._allNodes || []}
        onNavigateToNode={data._onNavigateToNode}
      />

      <Handle type="source" position={Position.Right} />
    </div>
  )
}
