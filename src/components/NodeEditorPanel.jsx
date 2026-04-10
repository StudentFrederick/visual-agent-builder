import { SERVICE_TYPES } from '../utils/service-registry.js'

export function NodeEditorPanel({ node, onChange, onClose }) {
  if (!node) return null

  const isService = node.type === 'serviceNode'
  const isOrchestrator = node.type === 'orchestratorNode'
  const service = isService ? SERVICE_TYPES[node.data.serviceType] : null

  const updateConfig = (key, value) => {
    onChange(node.id, {
      serviceConfig: { ...node.data.serviceConfig, [key]: value }
    })
  }

  return (
    <div className="w-80 bg-white border-l border-gray-200 p-4 flex flex-col gap-4 overflow-y-auto">
      <div className="flex justify-between items-center">
        <h2 className="font-semibold text-gray-800">
          {isService ? 'Edit Service' : isOrchestrator ? 'Edit Orchestrator' : 'Edit Node'}
        </h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-lg leading-none"
          aria-label="Close panel"
        >
          ✕
        </button>
      </div>

      {/* Name — all node types */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
        <input
          className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          value={node.data.name}
          onChange={e => onChange(node.id, { name: e.target.value })}
        />
      </div>

      {/* System Prompt — agents and orchestrators only */}
      {!isService && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">System Prompt</label>
          <textarea
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm h-40 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
            value={node.data.systemPrompt}
            onChange={e => onChange(node.id, { systemPrompt: e.target.value })}
            placeholder="You are a helpful assistant that…"
          />
        </div>
      )}

      {/* Temperature — agents and orchestrators only */}
      {!isService && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Temperature: {node.data.temperature.toFixed(1)}
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            className="w-full accent-blue-500"
            value={node.data.temperature}
            onChange={e => onChange(node.id, { temperature: parseFloat(e.target.value) })}
          />
          <div className="flex justify-between text-xs text-gray-400 mt-0.5">
            <span>Precise</span>
            <span>Creative</span>
          </div>
        </div>
      )}

      {/* Max Rounds — orchestrators only */}
      {isOrchestrator && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Max Rounds: {node.data.maxRounds || 5}
          </label>
          <input
            type="range"
            min="1"
            max="20"
            step="1"
            className="w-full accent-purple-500"
            value={node.data.maxRounds || 5}
            onChange={e => onChange(node.id, { maxRounds: parseInt(e.target.value) })}
          />
          <div className="flex justify-between text-xs text-gray-400 mt-0.5">
            <span>1</span>
            <span>20</span>
          </div>
        </div>
      )}

      {/* Service type selector */}
      {isService && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Service Type</label>
          <select
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            value={node.data.serviceType}
            onChange={e => onChange(node.id, {
              serviceType: e.target.value,
              serviceConfig: SERVICE_TYPES[e.target.value]?.defaultConfig || {}
            })}
          >
            {Object.entries(SERVICE_TYPES).map(([key, svc]) => (
              <option key={key} value={key}>{svc.icon} {svc.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Dynamic service config fields from registry */}
      {isService && service?.configFields?.map(field => (
        <div key={field.key}>
          <label className="block text-xs font-medium text-gray-600 mb-1">{field.label}</label>
          {field.type === 'select' ? (
            <select
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              value={node.data.serviceConfig?.[field.key] || ''}
              onChange={e => updateConfig(field.key, e.target.value)}
            >
              {field.options.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          ) : field.type === 'textarea' ? (
            <textarea
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm h-20 resize-none font-mono text-xs focus:outline-none focus:ring-2 focus:ring-orange-400"
              value={node.data.serviceConfig?.[field.key] || ''}
              onChange={e => updateConfig(field.key, e.target.value)}
              placeholder={field.placeholder}
            />
          ) : (
            <input
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              value={node.data.serviceConfig?.[field.key] || ''}
              onChange={e => updateConfig(field.key, e.target.value)}
              placeholder={field.placeholder}
            />
          )}
        </div>
      ))}

      {/* Output — all node types */}
      {node.data.output && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Output</label>
          <div className="w-full border border-gray-200 rounded bg-gray-50 px-2 py-2 text-sm max-h-60 overflow-y-auto whitespace-pre-wrap text-gray-700 leading-relaxed font-mono text-xs">
            {node.data.output}
          </div>
        </div>
      )}
    </div>
  )
}
