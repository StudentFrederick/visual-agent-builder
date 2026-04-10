export function NodeEditorPanel({ node, onChange, onClose }) {
  if (!node) return null

  return (
    <div className="w-72 bg-white border-l border-gray-200 p-4 flex flex-col gap-4 overflow-y-auto">
      <div className="flex justify-between items-center">
        <h2 className="font-semibold text-gray-800">Edit Node</h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-lg leading-none"
          aria-label="Close panel"
        >
          ✕
        </button>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
        <input
          className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          value={node.data.name}
          onChange={e => onChange(node.id, { name: e.target.value })}
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">System Prompt</label>
        <textarea
          className="w-full border border-gray-300 rounded px-2 py-1 text-sm h-40 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
          value={node.data.systemPrompt}
          onChange={e => onChange(node.id, { systemPrompt: e.target.value })}
          placeholder="You are a helpful assistant that…"
        />
      </div>

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

      {node.data.output && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Output</label>
          <div className="w-full border border-gray-200 rounded bg-gray-50 px-2 py-2 text-sm max-h-60 overflow-y-auto whitespace-pre-wrap text-gray-700 leading-relaxed">
            {node.data.output}
          </div>
        </div>
      )}
    </div>
  )
}
