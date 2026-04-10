export function Toolbar({ onAddNode, onRun, onClear, onSettings, canRun }) {
  return (
    <div className="h-12 bg-white border-b border-gray-200 flex items-center px-4 gap-2 shrink-0">
      <span className="font-semibold text-gray-800 mr-4 text-sm">
        Visual Agent Builder
      </span>

      <button
        onClick={onAddNode}
        className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
      >
        + Add Node
      </button>

      <button
        onClick={onRun}
        disabled={!canRun}
        className="px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        ▶ Run
      </button>

      <button
        onClick={onClear}
        className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded hover:bg-gray-200 transition-colors"
      >
        Clear
      </button>

      <div className="ml-auto">
        <button
          onClick={onSettings}
          className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded hover:bg-gray-200 transition-colors"
          aria-label="Settings"
        >
          ⚙ Settings
        </button>
      </div>
    </div>
  )
}
