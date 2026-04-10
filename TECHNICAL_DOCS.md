# Technical Documentation — Visual Agent Builder

## Table of Contents

- [Architecture](#architecture)
- [Data Flow](#data-flow)
- [Utilities](#utilities)
  - [Topological Sort](#topological-sort-srcutilstopologyjs)
  - [Claude Streaming API](#claude-streaming-api-srcutilsclaudejs)
- [Hooks](#hooks)
  - [useFlow](#useflow-srchooksuseflowjs)
  - [useRunner](#userunner-srchooksuserunnerjs)
- [Components](#components)
  - [App](#app-srcappjsx)
  - [AgentNode](#agentnode-srccomponentsagentnodejsx)
  - [FlowCanvas](#flowcanvas-srccomponentsflowcanvasjsx)
  - [NodeEditorPanel](#nodeeditorpanel-srccomponentsnodeeditorpaneljsx)
  - [Toolbar](#toolbar-srccomponentstoolbarjsx)
  - [SettingsModal](#settingsmodal-srccomponentssettingsmodaljsx)
- [Persistence Schema](#persistence-schema)
- [Error Handling](#error-handling)
- [Testing](#testing)

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                        Browser                          │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │                   App.jsx                        │    │
│  │  ┌─────────┐  ┌──────────┐  ┌───────────────┐  │    │
│  │  │ Toolbar  │  │FlowCanvas│  │NodeEditorPanel│  │    │
│  │  └────┬─────┘  │          │  └───────┬───────┘  │    │
│  │       │        │ AgentNode│          │          │    │
│  │       │        │ AgentNode│          │          │    │
│  │       │        │ AgentNode│          │          │    │
│  │       │        └─────┬────┘          │          │    │
│  │       │              │               │          │    │
│  │  ┌────▼──────────────▼───────────────▼───────┐  │    │
│  │  │              useFlow (state)               │  │    │
│  │  │   nodes[] ←→ edges[] ←→ localStorage      │  │    │
│  │  └─────────────────┬─────────────────────────┘  │    │
│  │                    │                             │    │
│  │  ┌─────────────────▼─────────────────────────┐  │    │
│  │  │            useRunner (execution)           │  │    │
│  │  │  topologicalSort → streamClaudeResponse    │  │    │
│  │  └─────────────────┬─────────────────────────┘  │    │
│  └────────────────────┼─────────────────────────────┘    │
│                       │                                   │
│                       ▼                                   │
│              Anthropic Claude API                         │
│              (client-side streaming)                      │
└─────────────────────────────────────────────────────────┘
```

The application is structured in three distinct layers:

### 1. Presentation Layer (Components)

React components that render the UI. The `FlowCanvas` wraps React Flow and renders `AgentNode` instances. The `Toolbar` provides action buttons. The `NodeEditorPanel` opens as a sidebar when a node is selected.

### 2. State Layer (useFlow hook)

All flow state (nodes and edges) is managed by the `useFlow` hook. Every state change is automatically persisted to `localStorage`. The hook exposes React Flow-compatible callbacks (`onNodesChange`, `onEdgesChange`, `onConnect`) and custom actions (`addNode`, `updateNodeData`, `clearFlow`).

### 3. Runtime Layer (useRunner hook + utilities)

When the user clicks "Run", the `useRunner` hook:
1. Resolves execution order via `topologicalSort` (Kahn's algorithm)
2. Iterates through nodes sequentially
3. Calls `streamClaudeResponse` for each node
4. Pipes each node's output as the next node's input

---

## Data Flow

### Editing Flow

```
User action (drag/connect/edit)
        │
        ▼
  React Flow callbacks
  (onNodesChange, onEdgesChange, onConnect)
        │
        ▼
  useFlow setState (setNodes/setEdges)
        │
        ▼
  useEffect → localStorage.setItem('vab_flow', ...)
```

### Execution Flow

```
User clicks "Run"
        │
        ▼
  App.handleRun(apiKey)
        │
        ▼
  useRunner.run(apiKey)
        │
        ▼
  topologicalSort(nodes, edges)
        │
        ▼
  For each node in sorted order:
  ┌─────────────────────────────────────────┐
  │  if (isRunning.current) return          │
  │  isRunning.current = true               │
  │              │                          │
  │  updateNodeData(id, {status: 'running'})│
  │              │                          │
  │              ▼                          │
  │  output = await streamClaudeResponse({  │
  │    systemPrompt: node.data.systemPrompt,│
  │    userMessage: prevOutput,             │
  │    temperature: node.data.temperature,  │
  │    onChunk: text => updateNodeData(...) │
  │  })                                     │
  │  updateNodeData(id, {status:'done'})    │
  │  prevOutput = output                    │
  │              │                          │
  │              ▼                          │
  │  On error: status='error', throw        │
  │  finally: isRunning.current = false     │
  └─────────────────────────────────────────┘
```

The first node receives an empty string as `userMessage` (the Claude utility substitutes `"Begin."` when the message is empty). Each subsequent node receives the full output of the previous node.

---

## Utilities

### Topological Sort (`src/utils/topology.js`)

Implements **Kahn's algorithm** (BFS-based) to determine node execution order.

#### Function Signature

```js
topologicalSort(nodes, edges) → sortedNodes[]
```

| Parameter | Type | Description |
|---|---|---|
| `nodes` | `Array<{id: string}>` | All nodes in the flow |
| `edges` | `Array<{source: string, target: string}>` | All edges connecting nodes |
| **Returns** | `Array<{id: string}>` | Nodes in execution order (source-to-sink) |

#### Algorithm

1. **Validation** — Builds a `Set` of valid node IDs. Checks every edge's `source` and `target` exist in the set. Throws `"Edge references unknown source/target node: {id}"` if not.
2. **Build graph** — Creates an in-degree map and adjacency list from edges.
3. **Initialize queue** — All nodes with in-degree 0 (no incoming edges) enter the queue.
4. **Process** — Dequeue a node, add to result, decrement in-degree of its neighbors. Enqueue neighbors that reach in-degree 0.
5. **Cycle detection** — If `result.length !== nodes.length`, a cycle exists. Throws `"Cycle detected in flow"`.
6. **Map back** — Converts result IDs back to original node objects via `nodes.find()`.

#### Error Cases

| Condition | Error |
|---|---|
| Edge references non-existent source | `"Edge references unknown source node: {id}"` |
| Edge references non-existent target | `"Edge references unknown target node: {id}"` |
| Circular dependency detected | `"Cycle detected in flow"` |

---

### Claude Streaming API (`src/utils/claude.js`)

Wraps the Anthropic SDK to stream Claude responses with chunk-level callbacks.

#### Function Signature

```js
streamClaudeResponse(opts) → Promise<string>
```

| Parameter | Type | Description |
|---|---|---|
| `opts.apiKey` | `string` | Anthropic API key |
| `opts.systemPrompt` | `string` | System prompt for this agent node |
| `opts.userMessage` | `string` | Output from the previous node (or `""`) |
| `opts.temperature` | `number` | Temperature setting (0.0 – 1.0) |
| `opts.onChunk` | `(text: string) => void` (optional) | Called with **accumulated** text on each stream delta |
| `opts.onDone` | `(text: string) => void` (optional) | Called with full text when stream ends |
| **Returns** | `Promise<string>` | The full response text |

#### Implementation Details

- **Model**: `claude-sonnet-4-6`
- **Max tokens**: 1024
- **Browser-safe**: Uses `dangerouslyAllowBrowser: true` to allow client-side API calls
- **Empty message handling**: If `userMessage` is empty/falsy, sends `"Begin."` as the user message
- **Streaming protocol**: Listens for `content_block_delta` events with `text_delta` type
- **Accumulation**: `onChunk` receives the full accumulated text so far (not just the delta), enabling progressive UI rendering
- **Optional callbacks**: Both `onChunk` and `onDone` use optional chaining (`onChunk?.(fullText)`), making them safe to omit

#### Stream Event Processing

```js
for await (const event of stream) {
  if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
    fullText += event.delta.text
    onChunk?.(fullText)  // accumulated, not delta; optional
  }
}
onDone?.(fullText)
```

---

### Orchestrator (`src/utils/orchestrator.js`)

Implements the multi-turn agentic loop that allows an OrchestratorNode to autonomously delegate work to connected AgentNodes via Claude's tool use API.

#### Exported Functions

##### `sanitizeToolName(name) → string`

Converts a node name into a valid Anthropic tool name: lowercase, spaces to underscores, strip non-alphanumeric, max 64 chars. Returns `"agent"` for empty input.

##### `getOrchestratorSubagentIds(nodes, edges) → Set<string>`

Returns the IDs of all AgentNodes that are targets of outgoing edges from any orchestrator node. These nodes are skipped in the main runner loop because the orchestrator handles their execution internally.

##### `getSubagentNodes(orchestratorId, nodes, edges) → Node[]`

Returns the AgentNode objects connected via outgoing edges from a specific orchestrator. Only returns nodes with `type === 'agentNode'` (flat architecture — no nested orchestrators).

##### `buildTools(subagentNodes) → Array<{nodeId, name, tool}>`

Converts an array of AgentNodes into Anthropic tool definitions:
- `name`: sanitized node name (deduplicates by appending node ID suffix on collision)
- `description`: the node's system prompt (falls back to `"Agent: {name}"` if empty)
- `input_schema`: `{ task: string }` — the task to delegate

##### `executeOrchestrator(opts) → Promise<string>`

Runs the multi-turn agentic loop.

| Parameter | Type | Description |
|---|---|---|
| `opts.apiKey` | `string` | Anthropic API key |
| `opts.node` | `Node` | The orchestrator node |
| `opts.subagentNodes` | `Node[]` | Connected AgentNodes (become tools) |
| `opts.userMessage` | `string` | Input from previous node in chain |
| `opts.onUpdate` | `(data) => void` | Updates orchestrator node data (output, currentRound) |
| `opts.onSubagentUpdate` | `(nodeId, data) => void` | Updates subagent node data (status, output) |

**Loop Behavior:**

```
round = 0, messages = [{ user: prevOutput || "Begin." }]

while round < maxRounds:
  response = claude.messages.create({ system, messages, tools })

  if stop_reason === "end_turn" (no tool calls):
    return text → done

  if tool_use blocks present:
    execute all tool calls in parallel (Promise.all)
    each tool call runs streamClaudeResponse on the matching AgentNode
    append assistant + tool_result messages to conversation
    round++

if maxRounds exceeded:
  return last text or "Max rounds reached"
```

- **Model**: `claude-sonnet-4-6` with `max_tokens: 4096` (higher than regular agents to accommodate tool reasoning)
- **Parallel execution**: Multiple tool calls in a single response are executed concurrently via `Promise.all`
- **Subagent visibility**: Subagent nodes update their status and output in real-time during execution
- **Error resilience**: If a subagent fails, the error is returned as a `tool_result` with `is_error: true`, letting the orchestrator decide how to proceed

---

## Hooks

### useFlow (`src/hooks/useFlow.js`)

Central state management hook for the flow editor. Manages all node and edge state with automatic localStorage persistence.

#### Returns

```js
{
  nodes,            // Node[] — current node array
  edges,            // Edge[] — current edge array
  onNodesChange,    // (changes) => void — React Flow node change handler
  onEdgesChange,    // (changes) => void — React Flow edge change handler
  onConnect,        // (connection) => void — React Flow new connection handler
  addNode,          // () => void — adds a new AgentNode to the canvas
  updateNodeData,   // (id, data) => void — merges data into a node
  clearFlow         // () => void — removes all nodes and edges
}
```

#### localStorage Persistence

- **Key**: `vab_flow`
- **Load**: On hook initialization, uses **lazy state initializers** (`() => loadFlow().nodes`) so localStorage is only read during the first render, not on every re-render. Falls back to `{ nodes: [], edges: [] }` on missing/corrupt data.
- **Save**: A `useEffect` watching `[nodes, edges]` serializes the full state to localStorage on every change.

#### Node Schema (as created by `addNode`)

```js
{
  id: 'node-{timestamp}',       // unique ID based on Date.now()
  type: 'agentNode',            // maps to AgentNode component in React Flow
  position: { x, y },           // x = 100 + (nodeCount * 240), y = 150
  data: {
    name: 'New Agent',           // display name
    systemPrompt: '',            // Claude system prompt
    temperature: 0.7,            // 0.0 – 1.0
    output: '',                  // Claude's response (filled during execution)
    status: 'idle'               // 'idle' | 'running' | 'done' | 'error'
  }
}
```

#### React Flow Integration

The hook uses three utilities from `@xyflow/react`:

| Function | Purpose |
|---|---|
| `applyNodeChanges(changes, nodes)` | Applies position/selection/removal changes to nodes |
| `applyEdgeChanges(changes, edges)` | Applies selection/removal changes to edges |
| `addEdge(connection, edges)` | Creates a new edge from a connection event |

All callbacks are wrapped in `useCallback` with stable dependency arrays to prevent unnecessary re-renders.

---

### useRunner (`src/hooks/useRunner.js`)

Orchestrates sequential execution of the agent chain through the Claude API.

#### Parameters

```js
useRunner({ nodes, edges, updateNodeData })
```

| Parameter | Type | Description |
|---|---|---|
| `nodes` | `Node[]` | Current nodes from useFlow |
| `edges` | `Edge[]` | Current edges from useFlow |
| `updateNodeData` | `(id, data) => void` | Callback to update node state (from useFlow) |

#### Returns

```js
{
  run,        // (apiKey: string) => Promise<void>
  isRunning   // React ref — isRunning.current is true during execution
}
```

#### Execution Sequence

1. **Guard**: If `isRunning.current` is `true`, return immediately (prevents double execution)
2. **Lock**: Set `isRunning.current = true`
3. **Sort**: `topologicalSort(nodes, edges)` determines execution order
4. **Identify subagents**: `getOrchestratorSubagentIds(nodes, edges)` returns IDs of nodes managed by orchestrators — these are skipped in the main loop
5. **Initialize**: `prevOutput = ''` (first node gets empty input)
6. **For each node** (sequentially, skipping subagent nodes):
   - If `orchestratorNode`: call `executeOrchestrator()` with connected subagents as tools
   - If `agentNode`: call `streamClaudeResponse()` with node's config and `prevOutput`
   - `onChunk`: progressively update node's output (streaming UI)
   - On success: set status to `'done'`, assign `prevOutput = output`
7. **On error**: set status to `'error'`, store error message, re-throw to halt chain
8. **Finally**: Set `isRunning.current = false` (always, even on error)

#### Error Behavior

Execution is **fail-fast**: the first node that encounters an API error turns red, and no subsequent nodes are executed. The error is re-thrown so the caller (App.jsx) can handle it. The `try/finally` block ensures `isRunning` is always reset.

#### Concurrency Protection

The `isRunning` ref (`useRef(false)`) acts as a mutex — clicking "Run" multiple times while execution is in progress is a no-op. The ref is also exposed to `App.jsx` which uses `!isRunning.current` in the `canRun` prop to disable the Run button during execution.

#### Dependency Array

The `run` callback depends on `[nodes, edges, updateNodeData]`, ensuring it always references current state when invoked.

---

## Components

### App (`src/App.jsx`)

Root component that composes all UI elements and manages application-level state.

#### State

| State | Type | Purpose |
|---|---|---|
| `apiKey` | `string` | Anthropic API key, loaded from localStorage on mount |
| `showSettings` | `boolean` | Controls SettingsModal visibility; true if no key stored |
| `selectedNode` | `Node \| null` | Currently selected node for the editor panel |

#### Wiring

- Instantiates `useFlow()` for flow state
- Instantiates `useRunner({ nodes, edges, updateNodeData })` for execution
- Passes flow callbacks to `FlowCanvas`
- Passes `selectedNode` and `updateNodeData` to `NodeEditorPanel`
- Controls "Run" button enable state: `!!apiKey && nodes.length > 0 && !isRunning.current`

#### Layout

```
┌──────────────────────────────────────────────┐
│                  Toolbar                      │
├────────────────────────────────┬──────────────┤
│                                │              │
│          FlowCanvas            │  NodeEditor  │
│     (React Flow canvas)        │   Panel      │
│                                │  (sidebar)   │
│                                │              │
└────────────────────────────────┴──────────────┘
         SettingsModal (overlay, conditional)
```

---

### OrchestratorNode (`src/components/OrchestratorNode.jsx`)

Custom React Flow node representing an orchestrator that delegates tasks to connected AgentNodes via tool use.

#### Props

| Prop | Type | Description |
|---|---|---|
| `data` | `object` | Node data: `name`, `systemPrompt`, `temperature`, `maxRounds`, `output`, `status`, `currentRound` |
| `selected` | `boolean` | Whether the node is currently selected |

#### Status Styles

| Status | Border | Background |
|---|---|---|
| `idle` | `border-purple-300` | `bg-purple-50` |
| `running` | `border-yellow-400` | `bg-yellow-50` |
| `done` | `border-green-400` | `bg-green-50` |
| `error` | `border-red-400` | `bg-red-50` |

#### Visual Elements

- **Purple diamond icon** (&#9670;) before the name to distinguish from regular agents
- **Round counter**: Shows "Running (round 2/5)" during execution
- **Selection ring**: Purple ring (`ring-2 ring-purple-500`) when selected
- Same handles as AgentNode (target left, source right)

#### Data Shape

```js
{
  id: 'node-{timestamp}',
  type: 'orchestratorNode',
  position: { x, y },
  data: {
    name: 'Orchestrator',
    systemPrompt: '',
    temperature: 0.7,
    maxRounds: 5,          // configurable 1-20
    output: '',
    status: 'idle',
    currentRound: 0        // updated during execution
  }
}
```

---

### AgentNode (`src/components/AgentNode.jsx`)

Custom React Flow node component representing a single AI agent in the workflow.

#### Props

| Prop | Type | Description |
|---|---|---|
| `data` | `object` | Node data: `name`, `systemPrompt`, `temperature`, `output`, `status` |
| `selected` | `boolean` | Whether the node is currently selected |

#### Status Styles

| Status | Border | Background |
|---|---|---|
| `idle` | `border-gray-300` | `bg-white` |
| `running` | `border-yellow-400` | `bg-yellow-50` |
| `done` | `border-green-400` | `bg-green-50` |
| `error` | `border-red-400` | `bg-red-50` |

#### Visual Elements

- **Selection ring**: Blue ring (`ring-2 ring-blue-500`) when selected
- **Name label**: Truncated, semibold text
- **Running indicator**: Animated pulse text "Running..."
- **Error display**: Red error message (word-wrapped)
- **Output preview**: Scrollable output area (max height 24, `whitespace-pre-wrap`), shown when status is `done`

#### Handles

| Handle | Type | Position |
|---|---|---|
| Input | `target` | Left side |
| Output | `source` | Right side |

Edges connect from the **source handle** (right) of one node to the **target handle** (left) of the next, creating left-to-right data flow.

---

### FlowCanvas (`src/components/FlowCanvas.jsx`)

Wrapper around React Flow that renders the node graph with controls.

#### Props

| Prop | Type | Description |
|---|---|---|
| `nodes` | `Node[]` | Nodes from useFlow |
| `edges` | `Edge[]` | Edges from useFlow |
| `onNodesChange` | `function` | Node change handler from useFlow |
| `onEdgesChange` | `function` | Edge change handler from useFlow |
| `onConnect` | `function` | Connection handler from useFlow |
| `onNodeClick` | `(node) => void` | Callback when a node is clicked |

#### Configuration

- **Node types**: Registers `{ agentNode: AgentNode, orchestratorNode: OrchestratorNode }` as custom node types
- **Fit view**: Automatically fits all nodes in view on load
- **Delete key**: `"Delete"` key removes selected nodes/edges
- **Sub-components**:
  - `Background` — dot grid background
  - `Controls` — zoom in/out/fit controls
  - `MiniMap` — overview minimap with indigo node color (`#6366f1`)

---

### NodeEditorPanel (`src/components/NodeEditorPanel.jsx`)

Sidebar panel for configuring the selected node's properties.

#### Props

| Prop | Type | Description |
|---|---|---|
| `node` | `Node \| null` | Selected node (renders nothing if null) |
| `onChange` | `(id, data) => void` | Callback to update node data |
| `onClose` | `() => void` | Callback to close the panel |

#### Fields

| Field | Input Type | Data Property | Shown for |
|---|---|---|---|
| Name | Text input | `data.name` | All nodes |
| System Prompt | Textarea (height 40) | `data.systemPrompt` | All nodes |
| Temperature | Range slider (0.0–1.0, step 0.1) | `data.temperature` | All nodes |
| Max Rounds | Range slider (1–20, step 1) | `data.maxRounds` | Orchestrator only |

The temperature slider shows labels "Precise" (0.0) and "Creative" (1.0) at the extremes. The Max Rounds slider only appears when an `orchestratorNode` is selected.

---

### Toolbar (`src/components/Toolbar.jsx`)

Top bar with action buttons and application title.

#### Props

| Prop | Type | Description |
|---|---|---|
| `onAddNode` | `() => void` | Adds a new node to the canvas |
| `onRun` | `() => void` | Starts workflow execution |
| `onClear` | `() => void` | Removes all nodes and edges |
| `onSettings` | `() => void` | Opens the settings modal |
| `canRun` | `boolean` | Enables/disables the Run button |

#### Buttons

| Button | Color | Action |
|---|---|---|
| "+ Add Node" | Blue | Adds new agent node |
| "+ Orchestrator" | Purple | Adds new orchestrator node |
| "Run" | Green (disabled when `!canRun`) | Executes the flow |
| "Clear" | Gray | Clears the canvas |
| "Settings" | Gray (right-aligned) | Opens API key modal |

---

### SettingsModal (`src/components/SettingsModal.jsx`)

Modal overlay for entering the Anthropic API key.

#### Props

| Prop | Type | Description |
|---|---|---|
| `onSave` | `(key: string) => void` | Callback with the entered API key |

#### Validation

The "Save & Continue" button is disabled until the key:
- Starts with `sk-ant-`
- Has length > 20 characters

#### Security

- Input type is `password` (masked)
- Key is stored in localStorage only
- The modal explains: "Your key is stored in your browser only and never sent anywhere else."

---

## Persistence Schema

### Flow State (`vab_flow`)

```json
{
  "nodes": [
    {
      "id": "node-1712345678901",
      "type": "agentNode",
      "position": { "x": 100, "y": 150 },
      "data": {
        "name": "Summarizer",
        "systemPrompt": "Summarize the input in 3 bullet points.",
        "temperature": 0.7,
        "output": "",
        "status": "idle"
      }
    }
  ],
  "edges": [
    {
      "id": "reactflow__edge-node-1-node-2",
      "source": "node-1",
      "target": "node-2"
    }
  ]
}
```

### API Key (`vab_api_key`)

Plain string stored directly in localStorage.

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Missing API key | "Run" button is disabled (`canRun = false`) |
| Empty flow (no nodes) | "Run" button is disabled |
| Claude API error | Failing node turns red, error message shown on node, execution halts |
| Cycle in graph | `topologicalSort` throws before any API calls |
| Edge references missing node | `topologicalSort` throws with descriptive error |
| Corrupt localStorage | `loadFlow()` catches parse errors, returns empty state |
| Orchestrator has no subagents | Executes as regular agent (no tools passed) |
| Subagent fails during tool call | Error returned as `tool_result` with `is_error: true`; orchestrator decides next step |
| Orchestrator hits maxRounds | Returns last text content, sets status to `'done'` |
| Orchestrator connected to orchestrator | Target is ignored (only `agentNode` targets become tools) |

---

## Testing

### Unit Tests (`tests/topology.test.js`)

Framework: **Vitest**

| Test | Assertion |
|---|---|
| Single node | Returns unchanged |
| Two connected nodes | Sorted source-first |
| Three-node chain | Correct execution order |
| Cycle detection | Throws `"Cycle detected in flow"` |
| Empty graph | Returns empty array |
| Disconnected nodes | Returns both (no ordering constraint) |
| Self-loop | Detected as cycle |
| Unknown source node | Throws descriptive error |
| Unknown target node | Throws descriptive error |

### Orchestrator Unit Tests (`tests/orchestrator.test.js`)

| Test | Assertion |
|---|---|
| sanitizeToolName: lowercases + underscores | `"My Agent"` → `"my_agent"` |
| sanitizeToolName: strips special chars | `"Agent #1 (test)"` → `"agent_1_test"` |
| sanitizeToolName: empty fallback | `""` → `"agent"` |
| sanitizeToolName: truncates at 64 chars | Long string → 64 chars |
| getOrchestratorSubagentIds: finds targets | Returns agent IDs, excludes standalone |
| getOrchestratorSubagentIds: empty when no orchestrators | Returns empty set |
| getOrchestratorSubagentIds: ignores orch-to-orch | Returns empty set |
| getSubagentNodes: finds connected agents | Returns correct nodes |
| buildTools: creates tool definitions | Correct name, description, schema |
| buildTools: deduplicates names | Appends ID suffix on collision |
| buildTools: fallback description | Uses `"Agent: {name}"` when prompt empty |

Run tests:

```bash
npm test
```
