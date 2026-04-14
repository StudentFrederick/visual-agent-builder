# AI Flow Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users type a natural-language description and generate a complete, runnable agent workflow (nodes, edges, system prompts) on the canvas via a single Claude API call.

**Architecture:** A new `flow-generator.js` utility sends the user's description to Claude with a structured system prompt that instructs it to return JSON defining the flow. The JSON is parsed, validated, and converted into React Flow nodes and edges. The InputBar gets a "Generate" button, and `useFlow` gets functions to replace or append generated flows.

**Tech Stack:** React 18, Vite, @anthropic-ai/sdk (existing), @xyflow/react v12 (existing), Vitest

---

## File Map

| File | Responsibility |
|---|---|
| `src/utils/flow-generator.js` | System prompt constant, `generateFlow()` Claude API call, JSON parsing/validation, position calculation |
| `tests/flow-generator.test.js` | Unit tests for JSON parsing, validation, and positioning |
| `src/components/InputBar.jsx` | Modified — add "Generate" button, loading/error state, conflict dialog |
| `src/hooks/useFlow.js` | Modified — add `replaceFlow()` and `appendFlow()` functions |
| `src/App.jsx` | Modified — wire `handleGenerate` callback through to InputBar |

---

## Task 1: Flow Generator Utility — Parsing & Positioning (TDD)

**Files:**
- Create: `tests/flow-generator.test.js`
- Create: `src/utils/flow-generator.js`

- [ ] **Step 1: Write the failing tests**

```js
// tests/flow-generator.test.js
import { describe, it, expect } from 'vitest'
import { parseFlowJson, layoutNodes } from '../src/utils/flow-generator.js'

describe('parseFlowJson', () => {
  it('parses a valid two-node flow', () => {
    const json = JSON.stringify({
      nodes: [
        { type: 'agentNode', name: 'Writer', systemPrompt: 'Write a poem.', temperature: 0.7 },
        { type: 'agentNode', name: 'Critic', systemPrompt: 'Critique the poem.', temperature: 0.3 }
      ],
      edges: [{ from: 0, to: 1 }]
    })
    const result = parseFlowJson(json)
    expect(result.nodes).toHaveLength(2)
    expect(result.nodes[0].name).toBe('Writer')
    expect(result.nodes[1].name).toBe('Critic')
    expect(result.edges).toEqual([{ from: 0, to: 1 }])
  })

  it('filters out nodes with invalid types', () => {
    const json = JSON.stringify({
      nodes: [
        { type: 'agentNode', name: 'Good', systemPrompt: '', temperature: 0.7 },
        { type: 'invalidType', name: 'Bad', systemPrompt: '' }
      ],
      edges: []
    })
    const result = parseFlowJson(json)
    expect(result.nodes).toHaveLength(1)
    expect(result.nodes[0].name).toBe('Good')
  })

  it('filters out edges with invalid indices', () => {
    const json = JSON.stringify({
      nodes: [
        { type: 'agentNode', name: 'A', systemPrompt: '', temperature: 0.7 }
      ],
      edges: [{ from: 0, to: 5 }]
    })
    const result = parseFlowJson(json)
    expect(result.edges).toHaveLength(0)
  })

  it('throws on invalid JSON', () => {
    expect(() => parseFlowJson('not json')).toThrow()
  })

  it('throws on missing nodes array', () => {
    expect(() => parseFlowJson(JSON.stringify({ edges: [] }))).toThrow()
  })

  it('throws when all nodes are invalid', () => {
    const json = JSON.stringify({
      nodes: [{ type: 'fake', name: 'X' }],
      edges: []
    })
    expect(() => parseFlowJson(json)).toThrow()
  })

  it('parses orchestrator nodes with maxRounds', () => {
    const json = JSON.stringify({
      nodes: [
        { type: 'orchestratorNode', name: 'Boss', systemPrompt: 'Coordinate.', temperature: 0.5, maxRounds: 8 }
      ],
      edges: []
    })
    const result = parseFlowJson(json)
    expect(result.nodes[0].type).toBe('orchestratorNode')
    expect(result.nodes[0].maxRounds).toBe(8)
  })

  it('parses service nodes with serviceType and serviceConfig', () => {
    const json = JSON.stringify({
      nodes: [
        { type: 'serviceNode', name: 'Slack', serviceType: 'slack', serviceConfig: { message: 'hello' } }
      ],
      edges: []
    })
    const result = parseFlowJson(json)
    expect(result.nodes[0].serviceType).toBe('slack')
    expect(result.nodes[0].serviceConfig).toEqual({ message: 'hello' })
  })

  it('strips markdown code fences from response', () => {
    const inner = JSON.stringify({
      nodes: [{ type: 'agentNode', name: 'A', systemPrompt: 'Do it.', temperature: 0.7 }],
      edges: []
    })
    const wrapped = '```json\n' + inner + '\n```'
    const result = parseFlowJson(wrapped)
    expect(result.nodes).toHaveLength(1)
  })
})

describe('layoutNodes', () => {
  it('positions a linear chain horizontally', () => {
    const nodes = [
      { type: 'agentNode', name: 'A' },
      { type: 'agentNode', name: 'B' },
      { type: 'agentNode', name: 'C' }
    ]
    const edges = [{ from: 0, to: 1 }, { from: 1, to: 2 }]
    const result = layoutNodes(nodes, edges, { offsetX: 0, offsetY: 0 })
    expect(result[0].position.x).toBe(100)
    expect(result[1].position.x).toBe(380)
    expect(result[2].position.x).toBe(660)
    // All same Y
    expect(result[0].position.y).toBe(150)
    expect(result[1].position.y).toBe(150)
    expect(result[2].position.y).toBe(150)
  })

  it('stacks orchestrator subagents vertically', () => {
    const nodes = [
      { type: 'orchestratorNode', name: 'Boss' },
      { type: 'agentNode', name: 'Worker1' },
      { type: 'agentNode', name: 'Worker2' }
    ]
    const edges = [{ from: 0, to: 1 }, { from: 0, to: 2 }]
    const result = layoutNodes(nodes, edges, { offsetX: 0, offsetY: 0 })
    // Orchestrator at left
    expect(result[0].position.x).toBe(100)
    // Subagents to the right, stacked vertically
    expect(result[1].position.x).toBe(380)
    expect(result[2].position.x).toBe(380)
    expect(result[1].position.y).toBeLessThan(result[2].position.y)
  })

  it('applies offsets for append mode', () => {
    const nodes = [{ type: 'agentNode', name: 'A' }]
    const edges = []
    const result = layoutNodes(nodes, edges, { offsetX: 0, offsetY: 400 })
    expect(result[0].position.y).toBe(550) // 150 + 400
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/freekvandenbosch/projects/visual-agent-builder && npx vitest run tests/flow-generator.test.js`
Expected: FAIL — "Cannot find module '../src/utils/flow-generator.js'"

- [ ] **Step 3: Write src/utils/flow-generator.js**

```js
// src/utils/flow-generator.js
import Anthropic from '@anthropic-ai/sdk'

const VALID_TYPES = new Set(['agentNode', 'orchestratorNode', 'serviceNode'])

const GENERATION_SYSTEM_PROMPT = `You are a workflow generator for the Visual Agent Builder. Given a user description, you generate a workflow as a JSON object. Return ONLY valid JSON, no markdown, no explanation, no code fences.

The JSON must follow this exact schema:

{
  "nodes": [
    {
      "type": "agentNode" | "orchestratorNode" | "serviceNode",
      "name": "descriptive name",
      "systemPrompt": "detailed system prompt for this agent",
      "temperature": 0.7,
      "maxRounds": 5,
      "serviceType": "webhook" | "slack" | "github" | "email" | "gsheets",
      "serviceConfig": { ... }
    }
  ],
  "edges": [
    { "from": 0, "to": 1 }
  ]
}

Rules:
- "type" is required for every node
- "systemPrompt" and "temperature" are for agentNode and orchestratorNode only
- "maxRounds" is for orchestratorNode only (default 5)
- "serviceType" and "serviceConfig" are for serviceNode only
- "edges" use node array indices (0-based) to define connections
- Write detailed, actionable system prompts for each agent
- Use orchestratorNode when multiple agents need to be coordinated or run in parallel
- Use serviceNode for external integrations (slack, github, email, gsheets, webhook)

Available service types and their serviceConfig:
- slack: { "message": "" } — sends message to Slack
- github: { "owner": "", "repo": "", "title": "", "body": "" } — creates GitHub issue
- email: { "to": "", "subject": "", "body": "" } — sends email via Resend
- gsheets: { "spreadsheetId": "", "sheetName": "Sheet1", "values": "" } — appends row to Google Sheets
- webhook: { "url": "", "method": "POST", "headers": "{}" } — HTTP request

For orchestrator nodes, connect them to their subagent nodes via edges (orchestrator → subagents). The orchestrator will automatically use these as tools.

Return the simplest workflow that accomplishes the user's goal.`

/**
 * Strip markdown code fences from a string if present.
 */
function stripCodeFences(text) {
  const trimmed = text.trim()
  const fenceMatch = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/)
  return fenceMatch ? fenceMatch[1].trim() : trimmed
}

/**
 * Parse and validate a JSON string returned by Claude into a flow definition.
 *
 * @param {string} raw - raw JSON string (possibly with code fences)
 * @returns {{ nodes: Array, edges: Array<{ from: number, to: number }> }}
 * @throws {Error} if JSON is invalid or no valid nodes remain
 */
export function parseFlowJson(raw) {
  const cleaned = stripCodeFences(raw)

  let parsed
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new Error('Could not parse flow JSON. Try rephrasing your description.')
  }

  if (!Array.isArray(parsed.nodes)) {
    throw new Error('Invalid flow: missing nodes array.')
  }

  // Filter to valid node types, preserving original index mapping
  const indexMap = new Map() // old index → new index
  const validNodes = []
  for (let i = 0; i < parsed.nodes.length; i++) {
    const node = parsed.nodes[i]
    if (node && VALID_TYPES.has(node.type)) {
      indexMap.set(i, validNodes.length)
      validNodes.push({
        type: node.type,
        name: node.name || 'Agent',
        systemPrompt: node.systemPrompt || '',
        temperature: typeof node.temperature === 'number' ? node.temperature : 0.7,
        maxRounds: node.type === 'orchestratorNode' ? (node.maxRounds || 5) : undefined,
        serviceType: node.type === 'serviceNode' ? (node.serviceType || 'webhook') : undefined,
        serviceConfig: node.type === 'serviceNode' ? (node.serviceConfig || {}) : undefined
      })
    }
  }

  if (validNodes.length === 0) {
    throw new Error('No valid nodes generated. Try being more specific.')
  }

  // Remap and filter edges
  const rawEdges = Array.isArray(parsed.edges) ? parsed.edges : []
  const validEdges = rawEdges
    .filter(e => indexMap.has(e.from) && indexMap.has(e.to))
    .map(e => ({ from: indexMap.get(e.from), to: indexMap.get(e.to) }))

  return { nodes: validNodes, edges: validEdges }
}

/**
 * Calculate positions for generated nodes.
 *
 * @param {Array} nodes - parsed nodes from parseFlowJson
 * @param {Array<{ from: number, to: number }>} edges
 * @param {{ offsetX: number, offsetY: number }} offset - base offset for append mode
 * @returns {Array<{ ...node, position: { x: number, y: number } }>}
 */
export function layoutNodes(nodes, edges, { offsetX = 0, offsetY = 0 } = {}) {
  const BASE_X = 100
  const BASE_Y = 150
  const H_SPACING = 280
  const V_SPACING = 150

  // Build adjacency: which nodes does each node point to?
  const children = new Map()
  for (let i = 0; i < nodes.length; i++) children.set(i, [])
  for (const edge of edges) {
    children.get(edge.from)?.push(edge.to)
  }

  // Find orchestrator nodes and their direct children
  const orchestratorChildren = new Map()
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].type === 'orchestratorNode') {
      orchestratorChildren.set(i, children.get(i) || [])
    }
  }

  // Track which nodes are subagents of an orchestrator
  const isSubagent = new Set()
  for (const kids of orchestratorChildren.values()) {
    for (const kid of kids) isSubagent.add(kid)
  }

  // Position nodes: walk through in order, placing orchestrators with their subagents
  const positions = new Array(nodes.length)
  let cursorX = BASE_X

  for (let i = 0; i < nodes.length; i++) {
    if (isSubagent.has(i)) continue // positioned by their orchestrator
    if (positions[i]) continue // already positioned

    if (orchestratorChildren.has(i)) {
      const kids = orchestratorChildren.get(i)
      // Place orchestrator
      positions[i] = { x: cursorX + offsetX, y: BASE_Y + offsetY }

      // Place subagents stacked to the right
      const subX = cursorX + H_SPACING
      const totalHeight = kids.length * V_SPACING
      const startY = BASE_Y - totalHeight / 2 + V_SPACING / 2
      kids.forEach((kidIdx, j) => {
        positions[kidIdx] = { x: subX + offsetX, y: startY + j * V_SPACING + offsetY }
      })

      cursorX = subX + H_SPACING
    } else {
      positions[i] = { x: cursorX + offsetX, y: BASE_Y + offsetY }
      cursorX += H_SPACING
    }
  }

  return nodes.map((node, i) => ({
    ...node,
    position: positions[i] || { x: cursorX + offsetX, y: BASE_Y + offsetY }
  }))
}

/**
 * Call Claude to generate a flow from a user description.
 *
 * @param {string} apiKey
 * @param {string} description - user's natural language flow description
 * @returns {Promise<{ nodes: Array, edges: Array }>} parsed and positioned flow
 */
export async function generateFlow(apiKey, description) {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    temperature: 0.3,
    system: GENERATION_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: description }]
  })

  const text = response.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('')

  return parseFlowJson(text)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/freekvandenbosch/projects/visual-agent-builder && npx vitest run tests/flow-generator.test.js`
Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add src/utils/flow-generator.js tests/flow-generator.test.js
git commit -m "feat: add flow generator utility with parsing, validation, and layout"
```

---

## Task 2: useFlow — replaceFlow and appendFlow

**Files:**
- Modify: `src/hooks/useFlow.js`

- [ ] **Step 1: Add replaceFlow and appendFlow functions to useFlow**

Add these two functions inside `useFlow()`, before the `return` statement (after `clearFlow`):

```js
const replaceFlow = useCallback((newNodes, newEdges) => {
  setNodes(newNodes)
  setEdges(newEdges)
}, [])

const appendFlow = useCallback((newNodes, newEdges) => {
  setNodes(ns => [...ns, ...newNodes])
  setEdges(es => [...es, ...newEdges])
}, [])
```

Add both to the return object:

```js
return {
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  addNode,
  addOrchestratorNode,
  addServiceNode,
  updateNodeData,
  activateEdges,
  resetEdgeStyles,
  clearFlow,
  replaceFlow,
  appendFlow
}
```

- [ ] **Step 2: Verify the dev server still starts without errors**

Run: `cd /Users/freekvandenbosch/projects/visual-agent-builder && npx vite build 2>&1 | tail -5`
Expected: Build succeeds (unused exports are fine in Vite).

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useFlow.js
git commit -m "feat: add replaceFlow and appendFlow to useFlow hook"
```

---

## Task 3: App.jsx — Wire handleGenerate

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Add generateFlow import and handleGenerate callback**

Add this import at the top of `App.jsx`:

```js
import { generateFlow, layoutNodes } from './utils/flow-generator.js'
```

Destructure `replaceFlow` and `appendFlow` from `useFlow()`:

```js
const {
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  addNode,
  addOrchestratorNode,
  addServiceNode,
  updateNodeData,
  activateEdges,
  resetEdgeStyles,
  clearFlow,
  replaceFlow,
  appendFlow
} = useFlow()
```

Add state for generation:

```js
const [isGenerating, setIsGenerating] = useState(false)
const [generateError, setGenerateError] = useState('')
```

Add the `handleGenerate` callback (after `handleClear`):

```js
const handleGenerate = useCallback(async (description, mode) => {
  if (!apiKey) {
    setShowSettings(true)
    return
  }

  setIsGenerating(true)
  setGenerateError('')

  try {
    const { nodes: parsedNodes, edges: parsedEdges } = await generateFlow(apiKey, description)

    // Calculate offset for append mode
    const offsetY = mode === 'append' && nodes.length > 0
      ? Math.max(...nodes.map(n => n.position?.y ?? 0)) + 200
      : 0

    const positioned = layoutNodes(parsedNodes, parsedEdges, { offsetX: 0, offsetY })

    // Convert to React Flow format
    const rfNodes = positioned.map((n, i) => {
      const id = `node-${Date.now()}-${i}`
      const data = { name: n.name, output: '', status: 'idle' }
      if (n.type === 'agentNode' || n.type === 'orchestratorNode') {
        data.systemPrompt = n.systemPrompt
        data.temperature = n.temperature
      }
      if (n.type === 'orchestratorNode') {
        data.maxRounds = n.maxRounds || 5
        data.currentRound = 0
      }
      if (n.type === 'serviceNode') {
        data.serviceType = n.serviceType || 'webhook'
        data.serviceConfig = n.serviceConfig || {}
      }
      return { id, type: n.type, position: n.position, data }
    })

    const rfEdges = parsedEdges.map(e => ({
      id: `edge-${rfNodes[e.from].id}-${rfNodes[e.to].id}`,
      source: rfNodes[e.from].id,
      target: rfNodes[e.to].id
    }))

    if (mode === 'append') {
      appendFlow(rfNodes, rfEdges)
    } else {
      replaceFlow(rfNodes, rfEdges)
    }
  } catch (err) {
    setGenerateError(err.message)
  } finally {
    setIsGenerating(false)
  }
}, [apiKey, nodes, replaceFlow, appendFlow])
```

- [ ] **Step 2: Pass new props to InputBar**

Update the InputBar in the JSX:

```jsx
<InputBar
  onRun={handleRun}
  onGenerate={handleGenerate}
  canRun={canRun}
  canGenerate={!!apiKey && !isGenerating}
  isGenerating={isGenerating}
  generateError={generateError}
  hasNodes={nodes.length > 0}
/>
```

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat: wire handleGenerate in App with flow conversion"
```

---

## Task 4: InputBar — Generate Button & Conflict Dialog

**Files:**
- Modify: `src/components/InputBar.jsx`

- [ ] **Step 1: Rewrite InputBar with Generate button and conflict dialog**

Replace the full content of `src/components/InputBar.jsx`:

```jsx
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
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/freekvandenbosch/projects/visual-agent-builder && npx vite build 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/InputBar.jsx
git commit -m "feat: add Generate button and conflict dialog to InputBar"
```

---

## Task 5: Integration Test & Manual Verification

- [ ] **Step 1: Run all unit tests**

Run: `cd /Users/freekvandenbosch/projects/visual-agent-builder && npx vitest run`
Expected: All tests pass (topology, orchestrator, template, service-registry, flow-generator).

- [ ] **Step 2: Start dev server**

Run: `cd /Users/freekvandenbosch/projects/visual-agent-builder && npm run dev`
Expected: Vite starts on `http://localhost:5173`.

- [ ] **Step 3: Manual smoke test**

Checklist:
- [ ] InputBar shows both "Generate" and "Run" buttons
- [ ] "Generate" is disabled without text or API key
- [ ] Type "Create a flow that summarizes text and translates it to Dutch" → click Generate → nodes appear on canvas with system prompts filled in
- [ ] Nodes are connected with edges in the correct order
- [ ] Click "Run" → the generated flow executes with streaming output
- [ ] On non-empty canvas, click "Generate" → conflict dialog appears with Replace / Add to existing / Cancel
- [ ] "Replace" clears canvas and places new flow
- [ ] "Add to existing" places new nodes below existing ones
- [ ] "Cancel" closes dialog without changes
- [ ] Invalid API key → error message appears below InputBar
- [ ] PDF upload still works as before

- [ ] **Step 4: Commit**

```bash
git commit --allow-empty -m "test: verified AI Flow Generator end-to-end"
```
