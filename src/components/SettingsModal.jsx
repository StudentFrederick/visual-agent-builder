import { useState } from 'react'

export function SettingsModal({ onSave }) {
  const [key, setKey] = useState('')
  const isValid = key.startsWith('sk-ant-') && key.length > 20

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-96 shadow-xl">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          Anthropic API Key
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Your key is stored in your browser only and never sent anywhere else.
        </p>
        <input
          type="password"
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-400"
          placeholder="sk-ant-..."
          value={key}
          onChange={e => setKey(e.target.value)}
          autoFocus
        />
        <button
          className="w-full bg-blue-600 text-white rounded px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          disabled={!isValid}
          onClick={() => onSave(key)}
        >
          Save & Continue
        </button>
      </div>
    </div>
  )
}
