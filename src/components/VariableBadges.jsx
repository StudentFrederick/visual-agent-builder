import { useState } from 'react'
import { extractNodeVariables, validateVariables } from '../utils/template.js'

const MAX_VISIBLE = 3

export function VariableBadges({ node, allNodes, onNavigateToNode }) {
  const [showTooltip, setShowTooltip] = useState(false)
  const variables = extractNodeVariables(node)
  if (variables.length === 0) return null

  const validated = validateVariables(variables, allNodes)
  const visible = validated.slice(0, MAX_VISIBLE)
  const overflow = validated.length - MAX_VISIBLE

  const handleClick = (v) => {
    if (!onNavigateToNode) return
    const target = allNodes.find(n =>
      n.data.name.toLowerCase() === v.nodeName.toLowerCase()
    )
    if (target) onNavigateToNode(target.id)
  }

  return (
    <div className="border-t border-gray-200 mt-2 pt-1.5">
      {visible.map((v, i) => (
        <button
          key={i}
          onClick={(e) => { e.stopPropagation(); handleClick(v) }}
          className={`block w-full text-left text-[10px] truncate px-0.5 py-0.5 rounded hover:bg-gray-100 cursor-pointer ${
            v.valid ? 'text-gray-400' : 'text-red-500'
          }`}
          title={v.valid ? `Click to navigate to ${v.nodeName}` : v.reason}
        >
          {v.valid ? '←' : '⚠'} {v.nodeName}.output{v.path ? `.${v.path}` : ''}
        </button>
      ))}
      {overflow > 0 && (
        <div
          className="relative inline-block"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <span className="text-[10px] text-gray-400 cursor-default">
            +{overflow} more
          </span>
          {showTooltip && (
            <div className="absolute bottom-full left-0 mb-1 bg-gray-800 text-white text-[10px] rounded px-2 py-1.5 shadow-lg z-50 whitespace-nowrap">
              {validated.slice(MAX_VISIBLE).map((v, i) => (
                <div key={i} className={v.valid ? '' : 'text-red-300'}>
                  {v.valid ? '←' : '⚠'} {v.nodeName}.output{v.path ? `.${v.path}` : ''}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
