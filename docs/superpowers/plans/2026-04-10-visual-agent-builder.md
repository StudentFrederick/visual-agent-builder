# Visual Agent Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a no-code browser app where non-technical users visually compose and run Claude agent chains via a React Flow canvas.

**Architecture:** Single-page React (Vite) app with no backend. React Flow handles the canvas; a `useFlow` hook manages state and localStorage persistence; a `useRunner` hook executes nodes in topological order via the Anthropic SDK with streaming.

**Tech Stack:** React 18, Vite, @xyflow/react (React Flow v12), @anthropic-ai/sdk, Tailwind CSS v3, Vitest

---

## File Map

| File | Responsibility |
|---|---|
| `index.html` | HTML entry point |
| `src/main.jsx` | React root mount |
| `src/App.jsx` | Root component — composes all panels, manages API key state |
| `src/index.css` | Tailwind directives |
| `src/components/Toolbar.jsx` | Add Node / Run / Clear / Settings buttons |
| `src/components/FlowCanvas.jsx` | React Flow canvas wrapper with custom node types |
| `src/components/AgentNode.jsx` | Custom React Flow node card |
| `src/components/NodeEditorPanel.jsx` | Sidebar for configuring a selected node |
| `src/components/SettingsModal.jsx` | Modal for entering/updating the Anthropic API key |
| `src/hooks/useFlow.js` | Flow state (nodes + edges) with localStorage persistence |
| `src/hooks/useRunner.js` | Topological sort + sequential Claude API execution |
| `src/utils/topology.js` | Pure topological sort (Kahn's algorithm) |
| `src/utils/claude.js` | Streaming Claude API call wrapper |
| `vite.config.js` | Vite + Vitest config |
| `tailwind.config.js` | Tailwind content paths |
| `postcss.config.js` | PostCSS for Tailwind |
| `tests/topology.test.js` | Unit tests for topological sort |

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `vite.config.js`
- Create: `tailwind.config.js`
- Create: `postcss.config.js`
- Create: `src/index.css`
- Create: `src/main.jsx`

- [ ] **Step 1: Write package.json**

```json
{
  "name": "visual-agent-builder",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.39.0",
    "@xyflow/react": "^12.3.6",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.4",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.15",
    "vite": "^6.0.5",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Write vite.config.js**

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node'
  }
})
```

- [ ] **Step 3: Write tailwind.config.js**

```js
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: { extend: {} },
  plugins: []
}
```

- [ ] **Step 4: Write postcss.config.js**

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {}
  }
}
```

- [ ] **Step 5: Write index.html**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Visual Agent Builder</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Write src/index.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 7: Write src/main.jsx**

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
```

- [ ] **Step 8: Install dependencies**

Run: `npm install`
Expected: `node_modules/` created, no errors.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json index.html vite.config.js tailwind.config.js postcss.config.js src/
git commit -m "chore: scaffold Vite + React + Tailwind + React Flow project"
```

---

## Task 2: Topology Utility (TDD)

**Files:**
- Create: `src/utils/topology.js`
- Create: `tests/topology.test.js`

- [ ] **Step 1: Create tests directory and write the failing tests**

```js
// tests/topology.test.js
import { describe, it, expect } from 'vitest'
import { topologicalSort } from '../src/utils/topology.js'

describe('topologicalSort', () => {
  it('returns a single node unchanged', () => {
    const nodes = [{ id: 'a', data: {} }]
    const edges = []
    const result = topologicalSort(nodes, edges)
    expect(result.map(n => n.id)).toEqual(['a'])
  })

  it('sorts two connected nodes source-first', () => {
    const nodes = [{ id: 'b', data: {} }, { id: 'a', data: {} }]
    const edges = [{ source: 'a', target: 'b' }]
    const result = topologicalSort(nodes, edges)
    expect(result.map(n => n.id)).toEqual(['a', 'b'])
  })

  it('sorts a three-node chain in order', () => {
    const nodes = [
      { id: 'c', data: {} },
      { id: 'a', data: {} },
      { id: 'b', data: {} }
    ]
    const edges = [
      { source: 'a', target: 'b' },
      { source: 'b', target: 'c' }
    ]
    const result = topologicalSort(nodes, edges)
    expect(result.map(n => n.id)).toEqual(['a', 'b', 'c'])
  })

  it('throws on a cycle', () => {
    const nodes = [{ id: 'a', data: {} }, { id: 'b', data: {} }]
    const edges = [
      { source: 'a', target: 'b' },
      { source: 'b', target: 'a' }
    ]
    expect(() => topologicalSort(nodes, edges)).toThrow('Cycle detected in flow')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/topology.test.js`
Expected: FAIL — "Cannot find module '../src/utils/topology.js'"

- [ ] **Step 3: Write src/utils/topology.js**

```js
// src/utils/topology.js

/**
 * Topologically sorts nodes using Kahn's algorithm.
 * @param {Array<{id: string}>} nodes
 * @param {Array<{source: string, target: string}>} edges
 * @returns {Array<{id: string}>} nodes in execution order
 * @throws {Error} if a cycle is detected
 */
export function topologicalSort(nodes, edges) {
  const inDegree = {}
  const graph = {}

  for (const node of nodes) {
    inDegree[node.id] = 0
    graph[node.id] = []
  }

  for (const edge of edges) {
    graph[edge.source].push(edge.target)
    inDegree[edge.target]++
  }

  const queue = nodes.filter(n => inDegree[n.id] === 0).map(n => n.id)
  const result = []

  while (queue.length > 0) {
    const id = queue.shift()
    result.push(id)
    for (const neighbor of graph[id]) {
      inDegree[neighbor]--
      if (inDegree[neighbor] === 0) queue.push(neighbor)
    }
  }

  if (result.length !== nodes.length) {
    throw new Error('Cycle detected in flow')
  }

  return result.map(id => nodes.find(n => n.id === id))
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/topology.test.js`
Expected: PASS — 4 tests passed.

- [ ] **Step 5: Commit**

```bash
git add src/utils/topology.js tests/topology.test.js
git commit -m "feat: add topological sort utility with tests"
```

---

## Task 3: Claude Streaming Utility

**Files:**
- Create: `src/utils/claude.js`

- [ ] **Step 1: Write src/utils/claude.js**

```js
// src/utils/claude.js
import Anthropic from '@anthropic-ai/sdk'

/**
 * Calls Claude with streaming and invokes callbacks per chunk.
 * @param {object} opts
 * @param {string} opts.apiKey - Anthropic API key
 * @param {string} opts.systemPrompt - system prompt for this node
 * @param {string} opts.userMessage - output of the previous node (or empty string)
 * @param {number} opts.temperature - 0.0 – 1.0
 * @param {(text: string) => void} opts.onChunk - called with accumulated text on each delta
 * @param {(text: string) => void} opts.onDone - called with full text when stream ends
 * @returns {Promise<string>} the full response text
 */
export async function streamClaudeResponse({
  apiKey,
  systemPrompt,
  userMessage,
  temperature,
  onChunk,
  onDone
}) {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })

  let fullText = ''

  const stream = client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    temperature,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage || 'Begin.' }]
  })

  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta'
    ) {
      fullText += event.delta.text
      onChunk(fullText)
    }
  }

  onDone(fullText)
  return fullText
}
```

- [ ] **Step 2: Verify the file is syntactically correct**

Run: `node --input-type=module < src/utils/claude.js 2>&1 | head -5`
Expected: no syntax errors (empty output or "ExperimentalWarning" only).

- [ ] **Step 3: Commit**

```bash
git add src/utils/claude.js
git commit -m "feat: add streaming Claude API utility"
```

---

## Task 4: useFlow Hook

**Files:**
- Create: `src/hooks/useFlow.js`

- [ ] **Step 1: Write src/hooks/useFlow.js**

```js
// src/hooks/useFlow.js
import { useState, useEffect, useCallback } from 'react'
import { addEdge, applyNodeChanges, applyEdgeChanges } from '@xyflow/react'

const FLOW_KEY = 'vab_flow'

function loadFlow() {
  try {
    const saved = localStorage.getItem(FLOW_KEY)
    return saved ? JSON.parse(saved) : { nodes: [], edges: [] }
  } catch {
    return { nodes: [], edges: [] }
  }
}

export function useFlow() {
  const initial = loadFlow()
  const [nodes, setNodes] = useState(initial.nodes)
  const [edges, setEdges] = useState(initial.edges)

  useEffect(() => {
    localStorage.setItem(FLOW_KEY, JSON.stringify({ nodes, edges }))
  }, [nodes, edges])

  const onNodesChange = useCallback(
    changes => setNodes(ns => applyNodeChanges(changes, ns)),
    []
  )

  const onEdgesChange = useCallback(
    changes => setEdges(es => applyEdgeChanges(changes, es)),
    []
  )

  const onConnect = useCallback(
    connection => setEdges(es => addEdge(connection, es)),
    []
  )

  const addNode = useCallback(() => {
    const id = `node-${Date.now()}`
    setNodes(ns => [
      ...ns,
      {
        id,
        type: 'agentNode',
        position: { x: 100 + ns.length * 240, y: 150 },
        data: {
          name: 'New Agent',
          systemPrompt: '',
          temperature: 0.7,
          output: '',
          status: 'idle'
        }
      }
    ])
  }, [])

  const updateNodeData = useCallback((id, data) => {
    setNodes(ns =>
      ns.map(n => (n.id === id ? { ...n, data: { ...n.data, ...data } } : n))
    )
  }, [])

  const clearFlow = useCallback(() => {
    setNodes([])
    setEdges([])
  }, [])

  return {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    updateNodeData,
    clearFlow
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useFlow.js
git commit -m "feat: add useFlow hook with localStorage persistence"
```

---

## Task 5: useRunner Hook

**Files:**
- Create: `src/hooks/useRunner.js`

- [ ] **Step 1: Write src/hooks/useRunner.js**

```js
// src/hooks/useRunner.js
import { useCallback } from 'react'
import { topologicalSort } from '../utils/topology.js'
import { streamClaudeResponse } from '../utils/claude.js'

export function useRunner({ nodes, edges, updateNodeData }) {
  const run = useCallback(
    async apiKey => {
      const sorted = topologicalSort(nodes, edges)
      let prevOutput = ''

      for (const node of sorted) {
        updateNodeData(node.id, { status: 'running', output: '' })
        try {
          await streamClaudeResponse({
            apiKey,
            systemPrompt: node.data.systemPrompt,
            userMessage: prevOutput,
            temperature: node.data.temperature,
            onChunk: text => updateNodeData(node.id, { output: text }),
            onDone: text => {
              updateNodeData(node.id, { status: 'done', output: text })
              prevOutput = text
            }
          })
        } catch (err) {
          updateNodeData(node.id, { status: 'error', output: err.message })
          throw err
        }
      }
    },
    [nodes, edges, updateNodeData]
  )

  return { run }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useRunner.js
git commit -m "feat: add useRunner hook for sequential Claude execution"
```

---

## Task 6: AgentNode Component

**Files:**
- Create: `src/components/AgentNode.jsx`

- [ ] **Step 1: Write src/components/AgentNode.jsx**

```jsx
// src/components/AgentNode.jsx
import { Handle, Position } from '@xyflow/react'

const statusStyles = {
  idle: 'border-gray-300 bg-white',
  running: 'border-yellow-400 bg-yellow-50',
  done: 'border-green-400 bg-green-50',
  error: 'border-red-400 bg-red-50'
}

export function AgentNode({ data, selected }) {
  const style = statusStyles[data.status] ?? statusStyles.idle

  return (
    <div
      className={`rounded-lg border-2 p-3 w-56 shadow-sm transition-colors ${style} ${
        selected ? 'ring-2 ring-blue-500 ring-offset-1' : ''
      }`}
    >
      <Handle type="target" position={Position.Left} />

      <div className="font-semibold text-sm text-gray-800 truncate mb-1">
        {data.name || 'Agent'}
      </div>

      {data.status === 'running' && (
        <div className="text-xs text-yellow-600 animate-pulse">Running…</div>
      )}

      {data.status === 'error' && (
        <div className="text-xs text-red-600 mt-1 break-words">{data.output}</div>
      )}

      {data.status === 'done' && data.output && (
        <div className="text-xs text-gray-600 mt-1 max-h-24 overflow-y-auto whitespace-pre-wrap">
          {data.output}
        </div>
      )}

      <Handle type="source" position={Position.Right} />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/AgentNode.jsx
git commit -m "feat: add AgentNode component with status indicators"
```

---

## Task 7: FlowCanvas Component

**Files:**
- Create: `src/components/FlowCanvas.jsx`

- [ ] **Step 1: Write src/components/FlowCanvas.jsx**

```jsx
// src/components/FlowCanvas.jsx
import { ReactFlow, Background, Controls, MiniMap } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { AgentNode } from './AgentNode.jsx'

const nodeTypes = { agentNode: AgentNode }

export function FlowCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeClick
}) {
  return (
    <div className="flex-1 h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_, node) => onNodeClick(node)}
        nodeTypes={nodeTypes}
        fitView
        deleteKeyCode="Delete"
      >
        <Background />
        <Controls />
        <MiniMap nodeColor={() => '#6366f1'} />
      </ReactFlow>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/FlowCanvas.jsx
git commit -m "feat: add FlowCanvas with React Flow, Background, Controls, MiniMap"
```

---

## Task 8: NodeEditorPanel Component

**Files:**
- Create: `src/components/NodeEditorPanel.jsx`

- [ ] **Step 1: Write src/components/NodeEditorPanel.jsx**

```jsx
// src/components/NodeEditorPanel.jsx
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
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/NodeEditorPanel.jsx
git commit -m "feat: add NodeEditorPanel sidebar for node configuration"
```

---

## Task 9: SettingsModal Component

**Files:**
- Create: `src/components/SettingsModal.jsx`

- [ ] **Step 1: Write src/components/SettingsModal.jsx**

```jsx
// src/components/SettingsModal.jsx
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/SettingsModal.jsx
git commit -m "feat: add SettingsModal for API key entry"
```

---

## Task 10: Toolbar Component

**Files:**
- Create: `src/components/Toolbar.jsx`

- [ ] **Step 1: Write src/components/Toolbar.jsx**

```jsx
// src/components/Toolbar.jsx
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Toolbar.jsx
git commit -m "feat: add Toolbar with Add Node, Run, Clear, Settings buttons"
```

---

## Task 11: Wire App.jsx

**Files:**
- Create: `src/App.jsx`

- [ ] **Step 1: Write src/App.jsx**

```jsx
// src/App.jsx
import { useState, useCallback } from 'react'
import { Toolbar } from './components/Toolbar.jsx'
import { FlowCanvas } from './components/FlowCanvas.jsx'
import { NodeEditorPanel } from './components/NodeEditorPanel.jsx'
import { SettingsModal } from './components/SettingsModal.jsx'
import { useFlow } from './hooks/useFlow.js'
import { useRunner } from './hooks/useRunner.js'

const API_KEY_STORAGE = 'vab_api_key'

export default function App() {
  const [apiKey, setApiKey] = useState(
    () => localStorage.getItem(API_KEY_STORAGE) || ''
  )
  const [showSettings, setShowSettings] = useState(
    () => !localStorage.getItem(API_KEY_STORAGE)
  )
  const [selectedNode, setSelectedNode] = useState(null)

  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    updateNodeData,
    clearFlow
  } = useFlow()

  const { run } = useRunner({ nodes, edges, updateNodeData })

  const handleSaveKey = useCallback(key => {
    localStorage.setItem(API_KEY_STORAGE, key)
    setApiKey(key)
    setShowSettings(false)
  }, [])

  const handleRun = useCallback(async () => {
    try {
      await run(apiKey)
    } catch (err) {
      console.error('Run failed:', err)
    }
  }, [run, apiKey])

  const handleNodeClick = useCallback(node => {
    setSelectedNode(node)
  }, [])

  const handleNodeChange = useCallback(
    (id, data) => {
      updateNodeData(id, data)
      setSelectedNode(prev =>
        prev?.id === id ? { ...prev, data: { ...prev.data, ...data } } : prev
      )
    },
    [updateNodeData]
  )

  const handleClear = useCallback(() => {
    clearFlow()
    setSelectedNode(null)
  }, [clearFlow])

  return (
    <div className="h-screen flex flex-col">
      {showSettings && <SettingsModal onSave={handleSaveKey} />}

      <Toolbar
        onAddNode={addNode}
        onRun={handleRun}
        onClear={handleClear}
        onSettings={() => setShowSettings(true)}
        canRun={!!apiKey && nodes.length > 0}
      />

      <div className="flex-1 flex overflow-hidden">
        <FlowCanvas
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={handleNodeClick}
        />
        <NodeEditorPanel
          node={selectedNode}
          onChange={handleNodeChange}
          onClose={() => setSelectedNode(null)}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Start the dev server and verify it renders**

Run: `npm run dev`
Expected: Vite starts on `http://localhost:5173`. Open it in the browser — you should see the Toolbar and an empty canvas. SettingsModal should appear on first load.

- [ ] **Step 3: Manual smoke test**

Checklist:
- [ ] SettingsModal appears on first load, disappears after saving a key
- [ ] "Add Node" adds a draggable node on the canvas
- [ ] Clicking a node opens the NodeEditorPanel on the right
- [ ] Editing name/prompt/temperature in the panel updates the node
- [ ] Two nodes can be connected by dragging from the right handle of one to the left handle of another
- [ ] Nodes and edges survive a page reload (localStorage persistence)
- [ ] "Run" is disabled when no nodes exist or no API key is set
- [ ] "Clear" removes all nodes and edges

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat: wire App.jsx — full visual agent builder MVP complete"
```

---

## Task 12: Run Flow End-to-End

This task verifies the actual Claude execution path works.

- [ ] **Step 1: Build a two-node test flow**

In the browser:
1. Add two nodes
2. Node 1 — Name: `Poet`, System Prompt: `Write a 2-line haiku about the ocean.`
3. Node 2 — Name: `Critic`, System Prompt: `Evaluate the haiku you received. Rate it 1-10 and explain why.`
4. Connect Node 1 → Node 2
5. Click Run

- [ ] **Step 2: Verify streaming output**

Expected:
- Node 1 shows "Running…" then fills in a haiku as it streams
- Node 1 turns green when done
- Node 2 then shows "Running…" and receives the haiku as its user message
- Node 2 turns green when done with a rating

- [ ] **Step 3: Verify error handling**

1. Open Settings, enter an invalid key (`sk-ant-fake`)
2. Click Run
Expected: Node 1 turns red, shows an API error message. Execution halts.

- [ ] **Step 4: Commit**

```bash
git commit --allow-empty -m "test: verified end-to-end Claude streaming flow"
```
