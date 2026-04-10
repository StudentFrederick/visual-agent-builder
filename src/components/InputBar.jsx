import { useState } from 'react'

export function InputBar({ onRun, canRun }) {
  const [input, setInput] = useState('')

  const handleSubmit = e => {
    e.preventDefault()
    if (canRun) onRun(input)
  }

  const handleKeyDown = e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (canRun) onRun(input)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-t border-gray-200 bg-white px-4 py-3 flex gap-2 items-end shrink-0"
    >
      <textarea
        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 min-h-[40px] max-h-[120px]"
        rows={1}
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Typ je opdracht... (bijv. 'Maak een offerte voor 50 laptops')"
      />
      <button
        type="submit"
        disabled={!canRun}
        className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
      >
        &#9654; Run
      </button>
    </form>
  )
}
