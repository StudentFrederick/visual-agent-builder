import { useState, useRef } from 'react'
import { extractPdfText } from '../utils/pdf-reader.js'

export function InputBar({ onRun, canRun }) {
  const [input, setInput] = useState('')
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
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
        // Plain text / CSV / JSON files
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
    <form
      onSubmit={handleSubmit}
      className="border-t border-gray-200 bg-white px-4 py-3 flex gap-2 items-end shrink-0"
    >
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
          placeholder="Typ je opdracht of upload een document..."
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
          type="submit"
          disabled={!canRun || !input.trim()}
          className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          &#9654; Run
        </button>
      </div>
    </form>
  )
}
