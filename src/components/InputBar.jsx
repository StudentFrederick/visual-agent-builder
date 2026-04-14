import { useState, useRef } from 'react'
import { extractPdfText } from '../utils/pdf-reader.js'

export function InputBar({ onRun, onGenerate, canRun, canGenerate, isGenerating, generateError, hasNodes }) {
  const [input, setInput] = useState('')
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showConflict, setShowConflict] = useState(false)
  const fileRef = useRef(null)

  const handleSubmit = e => {
    e.preventDefault()
    if (canRun && input.trim()) onRun(input)
  }

  const handleKeyDown = e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (canRun && input.trim()) onRun(input)
    }
  }

  const handleGenerate = () => {
    if (!input.trim()) return
    if (hasNodes) {
      setShowConflict(true)
    } else {
      onGenerate(input, 'replace')
    }
  }

  const handleConflictChoice = mode => {
    setShowConflict(false)
    if (mode === 'cancel') return
    onGenerate(input, mode)
  }

  const handleFileChange = async e => {
    const selected = e.target.files?.[0]
    if (!selected) return

    setFile(selected)
    setLoading(true)

    try {
      if (selected.type === 'application/pdf') {
        const text = await extractPdfText(selected)
        setInput(prev =>
          prev
            ? `${prev}\n\n--- ${selected.name} ---\n${text}`
            : `--- ${selected.name} ---\n${text}`
        )
      } else {
        const text = await selected.text()
        setInput(prev =>
          prev
            ? `${prev}\n\n--- ${selected.name} ---\n${text}`
            : `--- ${selected.name} ---\n${text}`
        )
      }
    } catch (err) {
      setInput(prev =>
        prev
          ? `${prev}\n\n[Error reading ${selected.name}: ${err.message}]`
          : `[Error reading ${selected.name}: ${err.message}]`
      )
    } finally {
      setLoading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const clearFile = () => {
    setFile(null)
    setInput('')
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <>
      {showConflict && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-96 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Flow already exists</h3>
            <p className="text-sm text-gray-500 mb-4">What would you like to do?</p>
            <div className="flex gap-2">
              <button
                onClick={() => handleConflictChoice('replace')}
                className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
              >
                Replace
              </button>
              <button
                onClick={() => handleConflictChoice('append')}
                className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 text-sm rounded hover:bg-gray-200 transition-colors"
              >
                Add to existing
              </button>
              <button
                onClick={() => handleConflictChoice('cancel')}
                className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 text-sm rounded hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="border-t border-gray-200 bg-white px-4 py-3 flex flex-col gap-1 shrink-0"
      >
        {generateError && (
          <div className="text-xs text-red-600 bg-red-50 rounded px-2 py-1">
            {generateError}
          </div>
        )}

        <div className="flex gap-2 items-end">
          <div className="flex-1 flex flex-col gap-1">
            {file && (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="bg-gray-100 px-2 py-0.5 rounded">
                  {file.name} ({(file.size / 1024).toFixed(0)} KB)
                </span>
                <button
                  type="button"
                  onClick={clearFile}
                  className="text-gray-400 hover:text-red-500"
                >
                  ✕
                </button>
              </div>
            )}
            <textarea
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
              rows={input.split('\n').length > 3 ? 4 : 2}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Beschrijf een workflow om te genereren, of typ een opdracht om te runnen..."
            />
          </div>

          <div className="flex flex-col gap-1">
            <label
              className={`px-3 py-2 text-sm rounded-lg cursor-pointer transition-colors text-center ${
                loading
                  ? 'bg-gray-200 text-gray-400'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {loading ? '...' : 'PDF'}
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.txt,.csv,.json,.md"
                onChange={handleFileChange}
                className="hidden"
                disabled={loading}
              />
            </label>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!canGenerate || !input.trim()}
              className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {isGenerating ? '...' : 'Generate'}
            </button>
            <button
              type="submit"
              disabled={!canRun || !input.trim()}
              className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              &#9654; Run
            </button>
          </div>
        </div>
      </form>
    </>
  )
}
