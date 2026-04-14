# Stop/Cancel Execution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to stop a running flow mid-execution via a Stop button that replaces the Run button during execution.

**Architecture:** An `AbortController` is created at the start of each run. The abort signal is passed through to all Claude API calls (streaming and non-streaming) and checked between node executions. The `stop()` function calls `controller.abort()`. `isRunning` becomes reactive state (useState) so the UI can toggle between Run and Stop.

**Tech Stack:** React 18, AbortController (browser native), @anthropic-ai/sdk

---

## File Map

| File | Responsibility |
|---|---|
| `src/utils/claude.js` | Modified — accept and forward `signal` to the SDK stream call |
| `src/utils/orchestrator.js` | Modified — accept and forward `signal` to API calls and subagent streaming |
| `src/hooks/useRunner.js` | Modified — create AbortController, expose `stop()`, convert `isRunning` to useState, check `signal.aborted` between nodes |
| `src/components/Toolbar.jsx` | Modified — toggle Run/Stop button based on `isRunning` |
| `src/App.jsx` | Modified — pass `stop` and `isRunning` to Toolbar |

---

## Task 1: Add signal support to claude.js

**Files:**
- Modify: `src/utils/claude.js`

- [ ] **Step 1: Add signal parameter to streamClaudeResponse**

Replace the full content of `src/utils/claude.js`:

```js
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
 * @param {AbortSignal} [opts.signal] - abort signal to cancel the request
 * @returns {Promise<string>} the full response text
 */
export async function streamClaudeResponse({
  apiKey,
  systemPrompt,
  userMessage,
  temperature,
  onChunk,
  onDone,
  signal
}) {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })

  let fullText = ''

  const stream = client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    temperature,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage || 'Begin.' }]
  }, { signal })

  for await (const event of stream) {
    if (signal?.aborted) break

    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta'
    ) {
      fullText += event.delta.text
      onChunk?.(fullText)
    }
  }

  onDone?.(fullText)
  return fullText
}
```

- [ ] **Step 2: Verify existing tests still pass**

Run: `cd /Users/freekvandenbosch/projects/visual-agent-builder && npx vitest run`
Expected: All tests pass (claude.js has no unit tests, but other tests importing it should not break).

- [ ] **Step 3: Commit**

```bash
git add src/utils/claude.js
git commit -m "feat: add abort signal support to streamClaudeResponse"
```

---

## Task 2: Add signal support to orchestrator.js

**Files:**
- Modify: `src/utils/orchestrator.js`

- [ ] **Step 1: Add signal parameter to executeOrchestrator**

Add `signal` to the function parameter destructuring (after `onEdgeActivate`):

```js
export async function executeOrchestrator({
  apiKey,
  node,
  subagentNodes,
  userMessage,
  onUpdate,
  onSubagentUpdate,
  onEdgeActivate,
  signal
}) {
```

- [ ] **Step 2: Pass signal to client.messages.create**

Change the `client.messages.create` call (around line 138) to pass signal as a request option:

```js
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      temperature: node.data.temperature,
      system: node.data.systemPrompt,
      messages,
      tools: tools.length > 0 ? tools : undefined
    }, { signal })
```

- [ ] **Step 3: Pass signal to subagent streamClaudeResponse calls**

In the `Promise.all` block where subagents are executed (around line 209), add `signal` to the `streamClaudeResponse` call:

```js
            result = await streamClaudeResponse({
              apiKey,
              systemPrompt: subNode.data.systemPrompt,
              userMessage: toolUse.input.task,
              temperature: subNode.data.temperature,
              onChunk: text => onSubagentUpdate(subNode.id, { output: text }),
              signal
            })
```

- [ ] **Step 4: Add abort check at the start of each round**

At the beginning of the `while (round < maxRounds)` loop, add:

```js
      if (signal?.aborted) break
```

- [ ] **Step 5: Verify tests still pass**

Run: `cd /Users/freekvandenbosch/projects/visual-agent-builder && npx vitest run tests/orchestrator.test.js`
Expected: All orchestrator tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/utils/orchestrator.js
git commit -m "feat: add abort signal support to orchestrator"
```

---

## Task 3: Update useRunner with AbortController and stop()

**Files:**
- Modify: `src/hooks/useRunner.js`

- [ ] **Step 1: Replace the full content of useRunner.js**

```js
// src/hooks/useRunner.js
import { useCallback, useRef, useState } from 'react'
import { topologicalSort } from '../utils/topology.js'
import { streamClaudeResponse } from '../utils/claude.js'
import { executeService } from '../utils/service-registry.js'
import {
  getOrchestratorSubagentIds,
  getSubagentNodes,
  executeOrchestrator
} from '../utils/orchestrator.js'
import { resolveTemplate } from '../utils/template.js'

export function useRunner({ nodes, edges, updateNodeData, activateEdges, resetEdgeStyles }) {
  const [isRunning, setIsRunning] = useState(false)
  const controllerRef = useRef(null)

  const stop = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.abort()
      controllerRef.current = null
    }
  }, [])

  const run = useCallback(
    async (apiKey, initialInput = '') => {
      if (isRunning) return
      const controller = new AbortController()
      controllerRef.current = controller
      setIsRunning(true)

      try {
        const sorted = topologicalSort(nodes, edges)
        const subagentIds = getOrchestratorSubagentIds(nodes, edges)
        let prevOutput = initialInput

        for (const node of sorted) {
          if (controller.signal.aborted) break
          if (subagentIds.has(node.id)) continue

          updateNodeData(node.id, { status: 'running', output: '' })

          const resolvedPrompt = resolveTemplate(node.data.systemPrompt || '', nodes)
          const resolvedConfig = node.data.serviceConfig
            ? {
                ...node.data.serviceConfig,
                url: resolveTemplate(node.data.serviceConfig.url || '', nodes),
                headers: resolveTemplate(node.data.serviceConfig.headers || '', nodes)
              }
            : null

          try {
            let output

            if (node.type === 'orchestratorNode') {
              const subagents = getSubagentNodes(node.id, nodes, edges)
              const resolvedNode = { ...node, data: { ...node.data, systemPrompt: resolvedPrompt } }
              output = await executeOrchestrator({
                apiKey,
                node: resolvedNode,
                subagentNodes: subagents,
                userMessage: prevOutput,
                onUpdate: data => updateNodeData(node.id, data),
                onSubagentUpdate: (id, data) => updateNodeData(id, data),
                onEdgeActivate: (sourceId, targetIds, active) =>
                  activateEdges(sourceId, targetIds, active),
                signal: controller.signal
              })
            } else if (node.type === 'serviceNode') {
              output = await executeService(node.data.serviceType, resolvedConfig, prevOutput)
            } else {
              output = await streamClaudeResponse({
                apiKey,
                systemPrompt: resolvedPrompt,
                userMessage: prevOutput,
                temperature: node.data.temperature,
                onChunk: text => updateNodeData(node.id, { output: text }),
                signal: controller.signal
              })
            }

            if (controller.signal.aborted) {
              updateNodeData(node.id, { status: 'cancelled', output: output || 'Cancelled' })
              break
            }

            updateNodeData(node.id, { status: 'done', output })
            prevOutput = output
          } catch (err) {
            if (controller.signal.aborted) {
              updateNodeData(node.id, { status: 'cancelled', output: 'Cancelled' })
              break
            }
            updateNodeData(node.id, { status: 'error', output: err.message })
            throw err
          }
        }
      } finally {
        controllerRef.current = null
        setIsRunning(false)
        resetEdgeStyles()
      }
    },
    [nodes, edges, updateNodeData, activateEdges, resetEdgeStyles, isRunning]
  )

  return { run, stop, isRunning }
}
```

- [ ] **Step 2: Verify build succeeds**

Run: `cd /Users/freekvandenbosch/projects/visual-agent-builder && npx vite build 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useRunner.js
git commit -m "feat: add AbortController and stop() to useRunner"
```

---

## Task 4: Update Toolbar with Run/Stop toggle

**Files:**
- Modify: `src/components/Toolbar.jsx`

- [ ] **Step 1: Replace the full content of Toolbar.jsx**

```jsx
export function Toolbar({ onAddNode, onAddOrchestrator, onAddService, onRun, onStop, onClear, onSettings, canRun, isRunning }) {
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
        onClick={onAddOrchestrator}
        className="px-3 py-1.5 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 transition-colors"
      >
        + Orchestrator
      </button>

      <button
        onClick={onAddService}
        className="px-3 py-1.5 bg-orange-500 text-white text-sm rounded hover:bg-orange-600 transition-colors"
      >
        + Service
      </button>

      {isRunning ? (
        <button
          onClick={onStop}
          className="px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
        >
          ■ Stop
        </button>
      ) : (
        <button
          onClick={onRun}
          disabled={!canRun}
          className="px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          ▶ Run
        </button>
      )}

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
git commit -m "feat: toggle Run/Stop button in Toolbar based on isRunning"
```

---

## Task 5: Wire stop and isRunning in App.jsx

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Update useRunner destructuring**

Change:
```js
const { run, isRunning } = useRunner({ nodes, edges, updateNodeData, activateEdges, resetEdgeStyles })
```

To:
```js
const { run, stop, isRunning } = useRunner({ nodes, edges, updateNodeData, activateEdges, resetEdgeStyles })
```

- [ ] **Step 2: Update canRun to use isRunning (now a boolean, not a ref)**

Change:
```js
const canRun = !!apiKey && nodes.length > 0 && !isRunning.current
```

To:
```js
const canRun = !!apiKey && nodes.length > 0 && !isRunning
```

- [ ] **Step 3: Pass onStop and isRunning to Toolbar**

Change the Toolbar JSX:
```jsx
<Toolbar
  onAddNode={addNode}
  onAddOrchestrator={addOrchestratorNode}
  onAddService={() => addServiceNode()}
  onRun={() => handleRun('')}
  onStop={stop}
  onClear={handleClear}
  onSettings={() => setShowSettings(true)}
  canRun={canRun}
  isRunning={isRunning}
/>
```

- [ ] **Step 4: Add 'cancelled' status styling to AgentNode and OrchestratorNode**

In `src/components/AgentNode.jsx`, add to `statusStyles`:
```js
cancelled: 'border-gray-400 bg-gray-100'
```

And to `statusBadges`:
```js
cancelled: { label: 'Cancelled', color: 'bg-gray-300 text-gray-700' }
```

In `src/components/OrchestratorNode.jsx`, add to `statusStyles`:
```js
cancelled: 'border-gray-400 bg-gray-100'
```

And to `statusBadges`:
```js
cancelled: { label: 'Cancelled', color: 'bg-gray-300 text-gray-700' }
```

- [ ] **Step 5: Verify build succeeds**

Run: `cd /Users/freekvandenbosch/projects/visual-agent-builder && npx vite build 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 6: Run all tests**

Run: `cd /Users/freekvandenbosch/projects/visual-agent-builder && npx vitest run`
Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/App.jsx src/components/AgentNode.jsx src/components/OrchestratorNode.jsx
git commit -m "feat: wire stop/cancel in App, add cancelled status to nodes"
```

---

## Task 6: Manual Verification

- [ ] **Step 1: Start dev server**

Run: `cd /Users/freekvandenbosch/projects/visual-agent-builder && npm run dev`

- [ ] **Step 2: Smoke test**

Checklist:
- [ ] With no flow running, Toolbar shows green "Run" button
- [ ] Generate a flow with 3+ nodes, click Run
- [ ] While running, "Run" button changes to red "Stop" button
- [ ] Click "Stop" — current node gets "Cancelled" status (gray), remaining nodes stay idle
- [ ] After stopping, button returns to green "Run"
- [ ] Running a new flow after stopping works normally
- [ ] InputBar "Run" button still works as before

- [ ] **Step 3: Commit**

```bash
git commit --allow-empty -m "test: verified stop/cancel execution end-to-end"
```
