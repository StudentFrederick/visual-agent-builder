# Template Variables & Response Parsing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users reference output from other nodes using `{{NodeName.output}}` template syntax in any config field, with JSON dot-notation for response parsing, and show variable dependencies visually on node cards.

**Architecture:** A pure-function template engine (`src/utils/template.js`) handles parsing, extraction, validation, and resolution. The runner resolves templates before executing each node. Node components render variable badges by extracting variables from their config fields and validating them against the current node list.

**Tech Stack:** React, Vitest, no new dependencies

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/utils/template.js` | Create | Template parsing, variable extraction, validation, resolution, JSON path traversal |
| `tests/template.test.js` | Create | Unit tests for all template functions |
| `src/hooks/useRunner.js` | Modify | Resolve templates in node config before execution |
| `src/components/VariableBadges.jsx` | Create | Shared component for rendering variable badges on node cards |
| `src/components/AgentNode.jsx` | Modify | Add VariableBadges below output |
| `src/components/OrchestratorNode.jsx` | Modify | Add VariableBadges below output |
| `src/components/ServiceNode.jsx` | Modify | Add VariableBadges below output |
| `src/components/FlowCanvas.jsx` | Modify | Pass `setCenter` from React Flow instance to nodes via context/prop |

---

### Task 1: Template Parsing & Extraction

**Files:**
- Create: `src/utils/template.js`
- Create: `tests/template.test.js`

- [ ] **Step 1: Write failing tests for `extractVariables`**

In `tests/template.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { extractVariables } from '../src/utils/template.js'

describe('extractVariables', () => {
  it('extracts a simple variable', () => {
    const result = extractVariables('Hello {{Summarizer.output}}')
    expect(result).toEqual([
      { raw: '{{Summarizer.output}}', nodeName: 'Summarizer', path: '' }
    ])
  })

  it('extracts a variable with dot-path', () => {
    const result = extractVariables('Data: {{Webhook.output.user.name}}')
    expect(result).toEqual([
      { raw: '{{Webhook.output.user.name}}', nodeName: 'Webhook', path: 'user.name' }
    ])
  })

  it('extracts a variable with array access', () => {
    const result = extractVariables('{{API.output.items[0].title}}')
    expect(result).toEqual([
      { raw: '{{API.output.items[0].title}}', nodeName: 'API', path: 'items[0].title' }
    ])
  })

  it('extracts multiple variables', () => {
    const result = extractVariables('{{A.output}} and {{B.output.x}}')
    expect(result).toHaveLength(2)
    expect(result[0].nodeName).toBe('A')
    expect(result[1].nodeName).toBe('B')
    expect(result[1].path).toBe('x')
  })

  it('returns empty array for no variables', () => {
    expect(extractVariables('no variables here')).toEqual([])
  })

  it('handles node names with spaces', () => {
    const result = extractVariables('{{My Agent.output}}')
    expect(result).toEqual([
      { raw: '{{My Agent.output}}', nodeName: 'My Agent', path: '' }
    ])
  })

  it('returns empty array for empty string', () => {
    expect(extractVariables('')).toEqual([])
  })

  it('handles malformed template gracefully', () => {
    expect(extractVariables('{{broken')).toEqual([])
    expect(extractVariables('no .output}}')).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/template.test.js`
Expected: FAIL — `extractVariables` is not exported

- [ ] **Step 3: Implement `extractVariables`**

In `src/utils/template.js`:

```js
/**
 * Extract all {{NodeName.output...}} template variables from a string.
 * @param {string} template
 * @returns {Array<{ raw: string, nodeName: string, path: string }>}
 */
export function extractVariables(template) {
  if (!template) return []
  const regex = /\{\{(.+?\.output(?:\..+?)?)\}\}/g
  const results = []
  let match
  while ((match = regex.exec(template)) !== null) {
    const inner = match[1]
    const outputIndex = inner.indexOf('.output')
    const nodeName = inner.slice(0, outputIndex)
    const rest = inner.slice(outputIndex + '.output'.length)
    const path = rest.startsWith('.') ? rest.slice(1) : ''
    results.push({ raw: match[0], nodeName, path })
  }
  return results
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/template.test.js`
Expected: All 8 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/template.js tests/template.test.js
git commit -m "feat: add template variable extraction with tests"
```

---

### Task 2: JSON Path Traversal

**Files:**
- Modify: `src/utils/template.js`
- Modify: `tests/template.test.js`

- [ ] **Step 1: Write failing tests for `resolvePath`**

Append to `tests/template.test.js`:

```js
import { resolvePath } from '../src/utils/template.js'

describe('resolvePath', () => {
  const obj = { user: { name: 'Jan', tags: ['admin', 'dev'] }, count: 42 }

  it('resolves a nested path', () => {
    expect(resolvePath(obj, 'user.name')).toBe('Jan')
  })

  it('resolves a top-level path', () => {
    expect(resolvePath(obj, 'count')).toBe(42)
  })

  it('resolves array index', () => {
    expect(resolvePath(obj, 'user.tags[0]')).toBe('admin')
    expect(resolvePath(obj, 'user.tags[1]')).toBe('dev')
  })

  it('returns undefined for non-existent path', () => {
    expect(resolvePath(obj, 'user.email')).toBeUndefined()
  })

  it('returns undefined for out-of-bounds index', () => {
    expect(resolvePath(obj, 'user.tags[99]')).toBeUndefined()
  })

  it('returns the whole object for empty path', () => {
    expect(resolvePath(obj, '')).toEqual(obj)
  })

  it('returns object for partial path', () => {
    expect(resolvePath(obj, 'user')).toEqual({ name: 'Jan', tags: ['admin', 'dev'] })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/template.test.js`
Expected: FAIL — `resolvePath` is not exported

- [ ] **Step 3: Implement `resolvePath`**

Add to `src/utils/template.js`:

```js
/**
 * Traverse an object by dot-notation path with array index support.
 * @param {any} obj
 * @param {string} path - e.g. "user.name" or "items[0].title"
 * @returns {any} the value at the path, or undefined if not found
 */
export function resolvePath(obj, path) {
  if (!path) return obj
  // Split "items[0].title" into ["items", "0", "title"]
  const segments = path.replace(/\[(\d+)\]/g, '.$1').split('.')
  let current = obj
  for (const seg of segments) {
    if (current == null || typeof current !== 'object') return undefined
    current = current[seg]
  }
  return current
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/template.test.js`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/template.js tests/template.test.js
git commit -m "feat: add JSON path traversal for template variables"
```

---

### Task 3: Template Resolution

**Files:**
- Modify: `src/utils/template.js`
- Modify: `tests/template.test.js`

- [ ] **Step 1: Write failing tests for `resolveTemplate`**

Append to `tests/template.test.js`:

```js
import { resolveTemplate } from '../src/utils/template.js'

describe('resolveTemplate', () => {
  const nodes = [
    { id: '1', data: { name: 'Summarizer', output: 'Three bullet points here.' } },
    { id: '2', data: { name: 'Webhook', output: '{"user":{"name":"Jan","id":42},"items":[{"title":"First"}]}' } },
    { id: '3', data: { name: 'My Agent', output: 'hello world' } }
  ]

  it('resolves a simple variable', () => {
    expect(resolveTemplate('Result: {{Summarizer.output}}', nodes))
      .toBe('Result: Three bullet points here.')
  })

  it('resolves a JSON dot-path', () => {
    expect(resolveTemplate('Hi {{Webhook.output.user.name}}', nodes))
      .toBe('Hi Jan')
  })

  it('resolves array access', () => {
    expect(resolveTemplate('{{Webhook.output.items[0].title}}', nodes))
      .toBe('First')
  })

  it('leaves unknown node as literal', () => {
    expect(resolveTemplate('{{Unknown.output}}', nodes))
      .toBe('{{Unknown.output}}')
  })

  it('leaves bad path as literal', () => {
    expect(resolveTemplate('{{Webhook.output.nope.bad}}', nodes))
      .toBe('{{Webhook.output.nope.bad}}')
  })

  it('is case-insensitive on node name', () => {
    expect(resolveTemplate('{{summarizer.output}}', nodes))
      .toBe('Three bullet points here.')
  })

  it('handles node names with spaces', () => {
    expect(resolveTemplate('{{My Agent.output}}', nodes))
      .toBe('hello world')
  })

  it('resolves multiple variables', () => {
    expect(resolveTemplate('{{Summarizer.output}} - {{Webhook.output.user.id}}', nodes))
      .toBe('Three bullet points here. - 42')
  })

  it('stringifies object results', () => {
    const result = resolveTemplate('{{Webhook.output.user}}', nodes)
    expect(JSON.parse(result)).toEqual({ name: 'Jan', id: 42 })
  })

  it('returns original string if no variables', () => {
    expect(resolveTemplate('plain text', nodes)).toBe('plain text')
  })

  it('handles non-JSON output with dot-path gracefully', () => {
    expect(resolveTemplate('{{Summarizer.output.foo}}', nodes))
      .toBe('{{Summarizer.output.foo}}')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/template.test.js`
Expected: FAIL — `resolveTemplate` is not exported

- [ ] **Step 3: Implement `resolveTemplate`**

Add to `src/utils/template.js`:

```js
/**
 * Resolve all {{NodeName.output...}} variables in a template string.
 * @param {string} template
 * @param {Array<{ id: string, data: { name: string, output: string } }>} nodes
 * @returns {string} resolved string
 */
export function resolveTemplate(template, nodes) {
  if (!template) return template
  const variables = extractVariables(template)
  if (variables.length === 0) return template

  let result = template
  for (const v of variables) {
    const node = nodes.find(n =>
      n.data.name.toLowerCase() === v.nodeName.toLowerCase()
    )
    if (!node) continue

    const output = node.data.output
    if (output == null) continue

    if (!v.path) {
      result = result.replace(v.raw, String(output))
      continue
    }

    // Try to parse as JSON and traverse path
    let parsed
    try {
      parsed = JSON.parse(output)
    } catch {
      continue // non-JSON with dot-path → leave as-is
    }

    const value = resolvePath(parsed, v.path)
    if (value === undefined) continue

    const replacement = typeof value === 'object' ? JSON.stringify(value) : String(value)
    result = result.replace(v.raw, replacement)
  }
  return result
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/template.test.js`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/template.js tests/template.test.js
git commit -m "feat: add template variable resolution with JSON path support"
```

---

### Task 4: Variable Validation

**Files:**
- Modify: `src/utils/template.js`
- Modify: `tests/template.test.js`

- [ ] **Step 1: Write failing tests for `validateVariables`**

Append to `tests/template.test.js`:

```js
import { validateVariables } from '../src/utils/template.js'

describe('validateVariables', () => {
  const nodes = [
    { id: '1', data: { name: 'Summarizer', output: '' } },
    { id: '2', data: { name: 'Webhook', output: '' } }
  ]

  it('marks existing node as valid', () => {
    const vars = [{ raw: '{{Summarizer.output}}', nodeName: 'Summarizer', path: '' }]
    const result = validateVariables(vars, nodes)
    expect(result[0].valid).toBe(true)
  })

  it('marks missing node as invalid', () => {
    const vars = [{ raw: '{{Nope.output}}', nodeName: 'Nope', path: '' }]
    const result = validateVariables(vars, nodes)
    expect(result[0].valid).toBe(false)
    expect(result[0].reason).toBe('Node "Nope" not found')
  })

  it('validates case-insensitively', () => {
    const vars = [{ raw: '{{summarizer.output}}', nodeName: 'summarizer', path: '' }]
    const result = validateVariables(vars, nodes)
    expect(result[0].valid).toBe(true)
  })

  it('validates multiple variables', () => {
    const vars = [
      { raw: '{{Summarizer.output}}', nodeName: 'Summarizer', path: '' },
      { raw: '{{Missing.output}}', nodeName: 'Missing', path: '' }
    ]
    const result = validateVariables(vars, nodes)
    expect(result[0].valid).toBe(true)
    expect(result[1].valid).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/template.test.js`
Expected: FAIL — `validateVariables` is not exported

- [ ] **Step 3: Implement `validateVariables`**

Add to `src/utils/template.js`:

```js
/**
 * Validate extracted variables against current node list.
 * @param {Array<{ raw: string, nodeName: string, path: string }>} variables
 * @param {Array<{ id: string, data: { name: string } }>} nodes
 * @returns {Array<{ raw: string, nodeName: string, path: string, valid: boolean, reason?: string }>}
 */
export function validateVariables(variables, nodes) {
  return variables.map(v => {
    const found = nodes.find(n =>
      n.data.name.toLowerCase() === v.nodeName.toLowerCase()
    )
    if (!found) {
      return { ...v, valid: false, reason: `Node "${v.nodeName}" not found` }
    }
    return { ...v, valid: true }
  })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/template.test.js`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/template.js tests/template.test.js
git commit -m "feat: add template variable validation"
```

---

### Task 5: Config Field Extraction Helper

**Files:**
- Modify: `src/utils/template.js`
- Modify: `tests/template.test.js`

- [ ] **Step 1: Write failing tests for `extractNodeVariables`**

Append to `tests/template.test.js`:

```js
import { extractNodeVariables } from '../src/utils/template.js'

describe('extractNodeVariables', () => {
  it('extracts from agent node system prompt', () => {
    const node = {
      type: 'agentNode',
      data: { systemPrompt: 'Use {{Source.output}} as context', name: 'Test' }
    }
    const result = extractNodeVariables(node)
    expect(result).toHaveLength(1)
    expect(result[0].nodeName).toBe('Source')
  })

  it('extracts from service node config fields', () => {
    const node = {
      type: 'serviceNode',
      data: {
        name: 'Webhook',
        serviceConfig: {
          url: 'https://api.example.com/{{Config.output.endpoint}}',
          headers: '{"Auth": "{{Auth.output}}"}',
          method: 'POST'
        }
      }
    }
    const result = extractNodeVariables(node)
    expect(result).toHaveLength(2)
    expect(result.map(v => v.nodeName).sort()).toEqual(['Auth', 'Config'])
  })

  it('deduplicates variables by raw string', () => {
    const node = {
      type: 'agentNode',
      data: { systemPrompt: '{{A.output}} and {{A.output}}', name: 'Test' }
    }
    const result = extractNodeVariables(node)
    expect(result).toHaveLength(1)
  })

  it('returns empty for node with no variables', () => {
    const node = {
      type: 'agentNode',
      data: { systemPrompt: 'No variables here', name: 'Test' }
    }
    expect(extractNodeVariables(node)).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/template.test.js`
Expected: FAIL — `extractNodeVariables` is not exported

- [ ] **Step 3: Implement `extractNodeVariables`**

Add to `src/utils/template.js`:

```js
/**
 * Extract all unique template variables from a node's config fields.
 * Checks systemPrompt for agent/orchestrator nodes, and serviceConfig fields for service nodes.
 * @param {{ type: string, data: object }} node
 * @returns {Array<{ raw: string, nodeName: string, path: string }>}
 */
export function extractNodeVariables(node) {
  const fields = []
  if (node.data.systemPrompt) fields.push(node.data.systemPrompt)
  if (node.data.serviceConfig) {
    const cfg = node.data.serviceConfig
    if (cfg.url) fields.push(cfg.url)
    if (cfg.headers) fields.push(cfg.headers)
  }

  const all = fields.flatMap(extractVariables)
  // Deduplicate by raw string
  const seen = new Set()
  return all.filter(v => {
    if (seen.has(v.raw)) return false
    seen.add(v.raw)
    return true
  })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/template.test.js`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/template.js tests/template.test.js
git commit -m "feat: add config field variable extraction for nodes"
```

---

### Task 6: VariableBadges Component

**Files:**
- Create: `src/components/VariableBadges.jsx`

- [ ] **Step 1: Create the VariableBadges component**

In `src/components/VariableBadges.jsx`:

```jsx
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/VariableBadges.jsx
git commit -m "feat: add VariableBadges component for node variable display"
```

---

### Task 7: Add VariableBadges to Node Components

**Files:**
- Modify: `src/components/AgentNode.jsx`
- Modify: `src/components/OrchestratorNode.jsx`
- Modify: `src/components/ServiceNode.jsx`

- [ ] **Step 1: Update AgentNode**

In `src/components/AgentNode.jsx`, add import at top:

```jsx
import { VariableBadges } from './VariableBadges.jsx'
```

Add the badges inside the outer `<div>`, just before the source `<Handle>`:

```jsx
      <VariableBadges
        node={{ type: 'agentNode', data }}
        allNodes={data._allNodes || []}
        onNavigateToNode={data._onNavigateToNode}
      />

      <Handle type="source" position={Position.Right} />
```

- [ ] **Step 2: Update OrchestratorNode**

In `src/components/OrchestratorNode.jsx`, add import at top:

```jsx
import { VariableBadges } from './VariableBadges.jsx'
```

Add the badges inside the outer `<div>`, just before the source `<Handle>`:

```jsx
      <VariableBadges
        node={{ type: 'orchestratorNode', data }}
        allNodes={data._allNodes || []}
        onNavigateToNode={data._onNavigateToNode}
      />

      <Handle type="source" position={Position.Right} />
```

- [ ] **Step 3: Update ServiceNode**

In `src/components/ServiceNode.jsx`, add import at top:

```jsx
import { VariableBadges } from './VariableBadges.jsx'
```

Add the badges inside the outer `<div>`, just before the source `<Handle>`:

```jsx
      <VariableBadges
        node={{ type: 'serviceNode', data }}
        allNodes={data._allNodes || []}
        onNavigateToNode={data._onNavigateToNode}
      />

      <Handle type="source" position={Position.Right} />
```

- [ ] **Step 4: Commit**

```bash
git add src/components/AgentNode.jsx src/components/OrchestratorNode.jsx src/components/ServiceNode.jsx
git commit -m "feat: add variable badges to all node components"
```

---

### Task 8: Pass Node List and Navigation to Nodes

**Files:**
- Modify: `src/components/FlowCanvas.jsx`
- Modify: `src/hooks/useFlow.js`

- [ ] **Step 1: Add React Flow instance ref to FlowCanvas**

In `src/components/FlowCanvas.jsx`, update to use `useReactFlow`:

```jsx
import { ReactFlow, Background, Controls, MiniMap, useReactFlow } from '@xyflow/react'
```

The issue is that `useReactFlow` must be called inside a `<ReactFlowProvider>`. Since `FlowCanvas` is already rendered inside `<ReactFlow>`, we need a wrapper. Instead, expose a navigate callback via `onNavigateToNode` prop and inject data into nodes.

Update `FlowCanvas` to accept `onNavigateToNode` prop and inject `_allNodes` and `_onNavigateToNode` into each node's data:

```jsx
import { ReactFlow, Background, Controls, MiniMap } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useMemo } from 'react'
import { AgentNode } from './AgentNode.jsx'
import { OrchestratorNode } from './OrchestratorNode.jsx'
import { ServiceNode } from './ServiceNode.jsx'

const nodeTypes = {
  agentNode: AgentNode,
  orchestratorNode: OrchestratorNode,
  serviceNode: ServiceNode
}

const miniMapColor = node => {
  if (node.type === 'orchestratorNode') return '#9333ea'
  if (node.type === 'serviceNode') return '#ea580c'
  return '#6366f1'
}

export function FlowCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeClick,
  onNavigateToNode
}) {
  // Inject allNodes and navigation callback into each node's data
  // so VariableBadges can access them without context
  const enrichedNodes = useMemo(() =>
    nodes.map(n => ({
      ...n,
      data: { ...n.data, _allNodes: nodes, _onNavigateToNode: onNavigateToNode }
    })),
    [nodes, onNavigateToNode]
  )

  return (
    <div className="flex-1 h-full">
      <ReactFlow
        nodes={enrichedNodes}
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
        <MiniMap nodeColor={miniMapColor} />
      </ReactFlow>
    </div>
  )
}
```

- [ ] **Step 2: Exclude internal props from localStorage persistence**

In `src/hooks/useFlow.js`, update the `cleanData` function to strip `_allNodes` and `_onNavigateToNode`:

Find the line:
```js
const { name, systemPrompt, temperature, maxRounds, serviceType, serviceConfig,
```

The existing whitelist approach already handles this — only whitelisted fields are persisted, so `_allNodes` and `_onNavigateToNode` are automatically excluded. No change needed here.

- [ ] **Step 3: Add navigation handler in App.jsx**

In `src/App.jsx`, add a `useRef` for the React Flow instance. However, since `ReactFlow` is inside `FlowCanvas`, we need `FlowCanvas` to expose a way to navigate. The simpler approach: add `onNavigateToNode` to `FlowCanvas` props and use an inner component with `useReactFlow`.

Update `FlowCanvas` to use an inner component:

Replace the full `FlowCanvas` component in `src/components/FlowCanvas.jsx`:

```jsx
import { ReactFlow, ReactFlowProvider, Background, Controls, MiniMap, useReactFlow } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useMemo, useCallback } from 'react'
import { AgentNode } from './AgentNode.jsx'
import { OrchestratorNode } from './OrchestratorNode.jsx'
import { ServiceNode } from './ServiceNode.jsx'

const nodeTypes = {
  agentNode: AgentNode,
  orchestratorNode: OrchestratorNode,
  serviceNode: ServiceNode
}

const miniMapColor = node => {
  if (node.type === 'orchestratorNode') return '#9333ea'
  if (node.type === 'serviceNode') return '#ea580c'
  return '#6366f1'
}

function FlowCanvasInner({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeClick
}) {
  const { setCenter } = useReactFlow()

  const handleNavigateToNode = useCallback((nodeId) => {
    const node = nodes.find(n => n.id === nodeId)
    if (!node) return
    setCenter(node.position.x + 112, node.position.y + 50, { zoom: 1.5, duration: 500 })
  }, [nodes, setCenter])

  const enrichedNodes = useMemo(() =>
    nodes.map(n => ({
      ...n,
      data: { ...n.data, _allNodes: nodes, _onNavigateToNode: handleNavigateToNode }
    })),
    [nodes, handleNavigateToNode]
  )

  return (
    <ReactFlow
      nodes={enrichedNodes}
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
      <MiniMap nodeColor={miniMapColor} />
    </ReactFlow>
  )
}

export function FlowCanvas(props) {
  return (
    <div className="flex-1 h-full">
      <ReactFlowProvider>
        <FlowCanvasInner {...props} />
      </ReactFlowProvider>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/FlowCanvas.jsx
git commit -m "feat: inject node list and navigation into node components for variable badges"
```

---

### Task 9: Integrate Template Resolution in Runner

**Files:**
- Modify: `src/hooks/useRunner.js`

- [ ] **Step 1: Add template resolution before node execution**

In `src/hooks/useRunner.js`, add import at top:

```js
import { resolveTemplate } from '../utils/template.js'
```

Inside the `for (const node of sorted)` loop, after the `updateNodeData` call that sets status to `running`, add template resolution before the execution branches:

```js
          // Resolve template variables in node config
          const resolvedPrompt = resolveTemplate(node.data.systemPrompt || '', nodes)
          const resolvedConfig = node.data.serviceConfig
            ? {
                ...node.data.serviceConfig,
                url: resolveTemplate(node.data.serviceConfig.url || '', nodes),
                headers: resolveTemplate(node.data.serviceConfig.headers || '', nodes)
              }
            : null
```

Then update the three execution branches to use the resolved values:

For the orchestrator branch, pass `resolvedPrompt` as a modified node:
```js
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
                  activateEdges(sourceId, targetIds, active)
              })
```

For the service branch, use `resolvedConfig`:
```js
            } else if (node.type === 'serviceNode') {
              output = await executeService(
                node.data.serviceType,
                resolvedConfig,
                prevOutput
              )
```

For the agent branch, use `resolvedPrompt`:
```js
            } else {
              output = await streamClaudeResponse({
                apiKey,
                systemPrompt: resolvedPrompt,
                userMessage: prevOutput,
                temperature: node.data.temperature,
                onChunk: text => updateNodeData(node.id, { output: text })
              })
            }
```

- [ ] **Step 2: Run all existing tests to make sure nothing broke**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useRunner.js
git commit -m "feat: resolve template variables in node config before execution"
```

---

### Task 10: Manual Testing & Polish

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

- [ ] **Step 2: Test template resolution**

1. Add two agent nodes: "Researcher" and "Writer"
2. Connect Researcher → Writer
3. Set Writer's system prompt to: `Rewrite the following: {{Researcher.output}}`
4. Run the flow — Writer should receive the resolved template

- [ ] **Step 3: Test variable badges**

1. Verify "Writer" node shows `← Researcher.output` badge in gray
2. Add a typo: `{{Resercher.output}}` — verify badge shows `⚠ Resercher.output` in red
3. Click the valid badge — canvas should pan to Researcher node

- [ ] **Step 4: Test JSON path parsing**

1. Add a service node (webhook) and an agent node
2. Set the agent's system prompt to `{{Webhook.output.data.message}}`
3. Verify the badge shows correctly
4. Run with a webhook that returns JSON — verify the path resolves

- [ ] **Step 5: Test overflow tooltip**

1. Create a node with 4+ variable references in its system prompt
2. Verify max 3 badges shown, `+N more` badge appears
3. Hover over `+N more` — tooltip shows remaining variables

- [ ] **Step 6: Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: template variables and response parsing complete"
```
