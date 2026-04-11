# Technical Documentation — Visual Agent Builder

## Table of Contents

- [Architecture](#architecture)
- [Data Flow](#data-flow)
- [Utilities](#utilities)
  - [Topological Sort](#topological-sort-srcutilstopologyjs)
  - [Claude Streaming API](#claude-streaming-api-srcutilsclaudejs)
  - [Orchestrator](#orchestrator-srcutilsorchestratorjs)
  - [Template Engine](#template-engine-srcutilstemplatejs)
  - [Service Registry](#service-registry-srcutilsservice-registryjs)
  - [PDF Reader](#pdf-reader-srcutilspdf-readerjs)
- [Hooks](#hooks)
  - [useFlow](#useflow-srchooksuseflowjs)
  - [useRunner](#userunner-srchooksuserunnerjs)
- [Components](#components)
  - [App](#app-srcappjsx)
  - [AgentNode](#agentnode-srccomponentsagentnodejsx)
  - [OrchestratorNode](#orchestratornode-srccomponentsorchestatornodejsx)
  - [ServiceNode](#servicenode-srccomponentsservicenodejsx)
  - [FlowCanvas](#flowcanvas-srccomponentsflowcanvasjsx)
  - [NodeEditorPanel](#nodeeditorpanel-srccomponentsnodeeditorpaneljsx)
  - [Toolbar](#toolbar-srccomponentstoolbarjsx)
  - [InputBar](#inputbar-srccomponentsinputbarjsx)
  - [SettingsModal](#settingsmodal-srccomponentssettingsmodaljsx)
  - [VariableBadges](#variablebadges-srccomponentsvariablebadgesjsx)
  - [ErrorBoundary](#errorboundary-srccomponentserrorboundaryjsx)
- [Persistence Schema](#persistence-schema)
- [Error Handling](#error-handling)
- [Testing](#testing)

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                          Browser                             │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                       App.jsx                          │  │
│  │                                                        │  │
│  │  ┌──────────────────────────────────────────────────┐  │  │
│  │  │                   Toolbar                        │  │  │
│  │  │  [+Node] [+Orchestrator] [+Service] [▶Run] ...  │  │  │
│  │  └──────────────────────────────────────────────────┘  │  │
│  │                                                        │  │
│  │  ┌─────────────────────────────┬────────────────────┐  │  │
│  │  │       FlowCanvas            │  NodeEditorPanel   │  │  │
│  │  │                             │                    │  │  │
│  │  │   AgentNode ──→ AgentNode   │  Name / Prompt /   │  │  │
│  │  │       ↑                     │  Temperature /     │  │  │
│  │  │  OrchestratorNode           │  Service config    │  │  │
│  │  │    ├──→ AgentNode           │                    │  │  │
│  │  │    └──→ ServiceNode         │                    │  │  │
│  │  └─────────────────────────────┴────────────────────┘  │  │
│  │                                                        │  │
│  │  ┌──────────────────────────────────────────────────┐  │  │
│  │  │  InputBar — text input + PDF upload + Run btn    │  │  │
│  │  └──────────────────────────────────────────────────┘  │  │
│  │                                                        │  │
│  │  ┌──────────────────────────────────────────────────┐  │  │
│  │  │              useFlow (state layer)               │  │  │
│  │  │   nodes[] ←→ edges[] ←→ localStorage (vab_flow) │  │  │
│  │  └───────────────────────┬──────────────────────────┘  │  │
│  │                          │                             │  │
│  │  ┌───────────────────────▼──────────────────────────┐  │  │
│  │  │           useRunner (runtime layer)              │  │  │
│  │  │  topologicalSort → resolveTemplate →             │  │  │
│  │  │  agentNode: streamClaudeResponse                 │  │  │
│  │  │  orchestratorNode: executeOrchestrator            │  │  │
│  │  │  serviceNode: executeService                     │  │  │
│  │  └───────────────────────┬──────────────────────────┘  │  │
│  └──────────────────────────┼──────────────────────────────┘  │
│                             │                                 │
│                             ▼                                 │
│    Anthropic Claude API  |  External Services (Slack,         │
│    (streaming + tool use)|  GitHub, Email, Google Sheets)     │
└──────────────────────────────────────────────────────────────┘
```

### Three Node Types

| Node Type | Color | Purpose |
|---|---|---|
| **AgentNode** | Blue/gray | Executes a single Claude streaming call |
| **OrchestratorNode** | Purple | Multi-turn agentic loop that delegates to connected agents/services via tool use |
| **ServiceNode** | Orange | Executes external HTTP calls (webhooks, Slack, GitHub, Email, Google Sheets) |

### Three Layers

1. **Presentation Layer** — React components render the UI. FlowCanvas wraps React Flow. Three node types (Agent, Orchestrator, Service) display status and output. NodeEditorPanel adapts its fields to the selected node type.
2. **State Layer** — `useFlow` manages all node/edge state with automatic localStorage persistence. Serialization whitelists known data fields to prevent React Flow internals from leaking into storage.
3. **Runtime Layer** — `useRunner` topologically sorts nodes, resolves template variables, then executes each node based on its type. Orchestrator nodes are handled by a multi-turn agentic loop; their subagent nodes are skipped in the main loop.

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
  useEffect → cleanData() → localStorage.setItem('vab_flow', ...)
  (whitelisted fields only: no React internals persist)
```

### Execution Flow

```
User clicks "▶ Run" (Toolbar) or submits via InputBar
        │
        ▼
  App.handleRun(initialInput)
        │
        ▼
  useRunner.run(apiKey, initialInput)
        │
        ├─ topologicalSort(nodes, edges)
        ├─ getOrchestratorSubagentIds(nodes, edges) → skip set
        │
        ▼
  For each node in sorted order (skip subagent nodes):
  ┌──────────────────────────────────────────────────────┐
  │  resolveTemplate(systemPrompt, nodes)                │
  │  resolveTemplate(serviceConfig.url, nodes)           │
  │                                                      │
  │  if orchestratorNode:                                │
  │    executeOrchestrator({node, subagents, tools})     │
  │    ├─ Claude tool_use loop (up to maxRounds)         │
  │    ├─ Parallel subagent execution (Promise.all)      │
  │    ├─ Edge glow activation during calls              │
  │    └─ buildReport(finalText, callLog)                │
  │                                                      │
  │  if serviceNode:                                     │
  │    executeService(serviceType, config, prevOutput)   │
  │                                                      │
  │  if agentNode:                                       │
  │    streamClaudeResponse(prompt, prevOutput, onChunk) │
  │                                                      │
  │  updateNodeData(id, {status:'done', output})         │
  │  prevOutput = output                                 │
  └──────────────────────────────────────────────────────┘
        │
        ▼
  finally: isRunning.current = false, resetEdgeStyles()
```

### Template Variable Resolution

Before execution, template variables in `systemPrompt` and `serviceConfig` are resolved:

```
"Summarize: {{Researcher.output}}"
         │
         ▼
resolveTemplate(template, nodes)
         │
         ├─ extractVariables() → [{nodeName: "Researcher", path: ""}]
         ├─ find node by name (case-insensitive)
         ├─ get node.data.output
         ├─ if path: JSON.parse(output) → resolvePath(parsed, path)
         └─ replace {{...}} with resolved value
```

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

1. **Validation** — Builds a `Set` of valid node IDs. Checks every edge's `source` and `target` exist in the set. Throws if not.
2. **Build graph** — Creates an in-degree map and adjacency list from edges.
3. **Initialize queue** — All nodes with in-degree 0 (no incoming edges) enter the queue.
4. **Process** — Dequeue a node, add to result, decrement in-degree of its neighbors. Enqueue neighbors that reach in-degree 0.
5. **Cycle detection** — If `result.length !== nodes.length`, a cycle exists.
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
- **Browser-safe**: Uses `dangerouslyAllowBrowser: true` for client-side API calls
- **Empty message handling**: If `userMessage` is empty/falsy, sends `"Begin."` as the user message
- **Optional callbacks**: Both `onChunk` and `onDone` use optional chaining (`onChunk?.(fullText)`), safe to omit
- **Accumulation**: `onChunk` receives the full accumulated text so far (not just the delta), enabling progressive UI rendering

---

### Orchestrator (`src/utils/orchestrator.js`)

Implements the multi-turn agentic loop that allows an OrchestratorNode to autonomously delegate work to connected AgentNodes and ServiceNodes via Claude's tool use API.

#### Exported Functions

##### `sanitizeToolName(name) → string`

Converts a node name into a valid Anthropic tool name: lowercase, spaces to underscores, strip non-alphanumeric, max 64 chars. Returns `"agent"` for empty input.

##### `getOrchestratorSubagentIds(nodes, edges) → Set<string>`

Returns the IDs of all nodes that are targets of outgoing edges from any orchestrator node. Only considers `agentNode` and `serviceNode` types (defined in `TOOL_NODE_TYPES`). These nodes are skipped in the main runner loop.

##### `getSubagentNodes(orchestratorId, nodes, edges) → Node[]`

Returns the tool-capable node objects connected via outgoing edges from a specific orchestrator.

##### `buildTools(subNodes) → Array<{nodeId, nodeType, name, tool}>`

Converts an array of sub-nodes into Anthropic tool definitions:
- **Name**: sanitized node name (deduplicates by appending node ID suffix on collision)
- **Description**: for agents, the system prompt (falls back to `"Agent: {name}"`); for services, generated by `getServiceToolDescription()`
- **Input schema**: `{ task: string }` — the task to delegate

##### `executeOrchestrator(opts) → Promise<string>`

Runs the multi-turn agentic loop.

| Parameter | Type | Description |
|---|---|---|
| `opts.apiKey` | `string` | Anthropic API key |
| `opts.node` | `Node` | The orchestrator node |
| `opts.subagentNodes` | `Node[]` | Connected tool nodes (agents + services) |
| `opts.userMessage` | `string` | Input from previous node in chain |
| `opts.onUpdate` | `(data) => void` | Updates orchestrator node data (output, status, currentRound, thinking) |
| `opts.onSubagentUpdate` | `(nodeId, data) => void` | Updates subagent node data (status, output) |
| `opts.onEdgeActivate` | `(sourceId, targetIds[], active) => void` | Activates/deactivates edge glow animation |

**Loop Behavior:**

```
round = 0, messages = [{ user: prevOutput || "Begin." }]

while round < maxRounds:
  status = 'thinking'
  response = claude.messages.create({ system, messages, tools })

  if no tool_use blocks or stop_reason === "end_turn":
    return buildReport(text, callLog) → done

  status = 'calling_subagent'
  activate edge glow for called nodes

  execute all tool calls in parallel (Promise.all):
    serviceNode → executeService(serviceType, config, task)
    agentNode   → streamClaudeResponse(prompt, task, temp)

  deactivate edge glow
  append assistant + tool_result messages
  round++

if maxRounds exceeded:
  return buildReport(lastText, callLog) → done
```

- **Model**: `claude-sonnet-4-6` with `max_tokens: 4096` (higher than regular agents)
- **Parallel execution**: Multiple tool calls in a single response are executed concurrently via `Promise.all`
- **Edge animation**: Edges glow purple during active subagent calls
- **Thinking bubble**: Orchestrator's reasoning text appears as a speech bubble on the node
- **Error resilience**: If a subagent fails, the error is returned as `tool_result` with `is_error: true`
- **Report generation**: `buildReport()` appends a summary of all agent calls to the final output

---

### Template Engine (`src/utils/template.js`)

Parses and resolves `{{NodeName.output}}` template variables across node configurations.

#### Syntax

```
{{NodeName.output}}              → full output of node named "NodeName"
{{NodeName.output.user.name}}    → JSON path into output (parsed as JSON)
{{NodeName.output.items[0]}}     → array index support
```

#### Exported Functions

| Function | Signature | Description |
|---|---|---|
| `extractVariables` | `(template) → [{raw, nodeName, path}]` | Parse all `{{...}}` variables from a string |
| `resolvePath` | `(obj, path) → value` | Traverse an object by dot-notation path with array index support |
| `resolveTemplate` | `(template, nodes) → string` | Replace all variables with actual node output values |
| `validateVariables` | `(variables, nodes) → [{..., valid, reason?}]` | Check if referenced nodes exist |
| `extractNodeVariables` | `(node) → [{raw, nodeName, path}]` | Extract variables from all config fields of a node |

#### Resolution Rules

- Node name matching is **case-insensitive**
- If a node is not found, the token is left as-is (no error)
- If output is `null`/`undefined`, the token is left as-is
- If a sub-path is requested but output is not valid JSON, the token is left as-is
- Objects/arrays are stringified with `JSON.stringify()`; primitives use `String()`
- `extractNodeVariables` scans: `data.systemPrompt` (agent/orchestrator), `data.serviceConfig.url` and `data.serviceConfig.headers` (service nodes)

---

### Service Registry (`src/utils/service-registry.js`)

Pluggable registry of external service types. Each service defines its config fields, UI metadata, and async executor.

#### `SERVICE_TYPES` Map

| Key | Label | Icon | Description |
|---|---|---|---|
| `webhook` | Webhook (HTTP) | W | Generic HTTP request to any URL |
| `slack` | Slack | `\ud83d\udcac` | Send a message via incoming webhook |
| `github` | GitHub Issue | G | Create an issue on a GitHub repo |
| `email` | Email (Resend) | `\u2709` | Send email via Resend API |
| `gsheets` | Google Sheets | `\ud83d\udcca` | Append a row to a Google Sheet |

#### Service Configuration

Each service type defines:
- `configFields[]` — Array of `{key, label, type, placeholder, options?}` for the editor panel
- `defaultConfig` — Default values for new service nodes
- `execute(config, input) → Promise<string>` — Async executor

#### Token Storage

Services read credentials from localStorage:

| Service | localStorage Key | Format |
|---|---|---|
| Slack | `vab_slack_webhook` | Webhook URL |
| GitHub | `vab_github_token` | Personal access token (`ghp_...`) |
| Email | `vab_resend_key` | Resend API key (`re_...`) |
| Google Sheets | `vab_gsheets_key` | Google API key (`AIza...`) |

#### Exported Functions

| Function | Description |
|---|---|
| `executeService(serviceType, config, input)` | Look up service by type and call its executor |
| `getServiceToolDescription(node)` | Generate a human-readable tool description for the orchestrator |

---

### PDF Reader (`src/utils/pdf-reader.js`)

Extracts text from PDF files for use as input in the InputBar.

```js
extractPdfText(file: File) → Promise<string>
```

- **Lazy loading**: Imports `pdfjs-dist` only when called (keeps initial bundle small)
- **Worker**: Configures the PDF.js web worker via `import.meta.url`
- **Output format**: Pages separated by `--- Page N ---` headers
- **Usage**: Called from InputBar when user uploads a `.pdf` file

---

## Hooks

### useFlow (`src/hooks/useFlow.js`)

Central state management hook for the flow editor. Manages all node and edge state with automatic localStorage persistence.

#### Returns

```js
{
  nodes,               // Node[] — current node array
  edges,               // Edge[] — current edge array
  onNodesChange,       // (changes) => void — React Flow node change handler
  onEdgesChange,       // (changes) => void — React Flow edge change handler
  onConnect,           // (connection) => void — React Flow new connection handler
  addNode,             // () => void — adds a new AgentNode
  addOrchestratorNode, // () => void — adds a new OrchestratorNode
  addServiceNode,      // (serviceType?) => void — adds a new ServiceNode (default: 'webhook')
  updateNodeData,      // (id, data) => void — merges data into a node
  activateEdges,       // (sourceId, targetIds[], active) => void — toggles edge glow
  resetEdgeStyles,     // () => void — resets all edge styles
  clearFlow            // () => void — removes all nodes and edges
}
```

#### localStorage Persistence

- **Key**: `vab_flow`
- **Valid types**: `Set(['agentNode', 'orchestratorNode', 'serviceNode'])` — unknown types are filtered on load
- **Load**: Lazy state initializer (`() => loadFlow().nodes`). Filters invalid node types and orphaned edges. Falls back to `{ nodes: [], edges: [] }` on error.
- **Save**: `useEffect` serializes on every change with a **whitelist approach** — `cleanData()` extracts only known fields (`name`, `systemPrompt`, `temperature`, `maxRounds`, `serviceType`, `serviceConfig`, `output`, `status`, `currentRound`, `thinking`) to prevent React Flow internals or injected props from leaking into storage.
- **Edge serialization**: Only persists `id`, `source`, `target` — strips `animated`, `style`, and other runtime properties.

#### Node Schemas

**AgentNode** (created by `addNode`):
```js
{
  id: 'node-{timestamp}',
  type: 'agentNode',
  position: { x: 100 + nodeCount * 240, y: 150 },
  data: {
    name: 'New Agent',
    systemPrompt: '',
    temperature: 0.7,
    output: '',
    status: 'idle'    // 'idle' | 'running' | 'done' | 'error'
  }
}
```

**OrchestratorNode** (created by `addOrchestratorNode`):
```js
{
  id: 'node-{timestamp}',
  type: 'orchestratorNode',
  position: { x: 100 + nodeCount * 240, y: 150 },
  data: {
    name: 'Orchestrator',
    systemPrompt: '',
    temperature: 0.7,
    maxRounds: 5,         // 1–20, configurable
    output: '',
    status: 'idle',       // 'idle' | 'thinking' | 'calling_subagent' | 'running' | 'done' | 'error'
    currentRound: 0
  }
}
```

**ServiceNode** (created by `addServiceNode`):
```js
{
  id: 'node-{timestamp}',
  type: 'serviceNode',
  position: { x: 100 + nodeCount * 240, y: 150 },
  data: {
    name: 'Webhook',
    serviceType: 'webhook',  // or 'slack', 'github', 'email', 'gsheets'
    serviceConfig: {         // varies per service type
      url: '',
      method: 'POST',
      headers: '{"Content-Type": "application/json"}'
    },
    output: '',
    status: 'idle'    // 'idle' | 'running' | 'done' | 'error'
  }
}
```

#### Edge Animation

`activateEdges(sourceId, targetIds, active)` toggles animated purple glow on edges between an orchestrator and its active subagents:
- `active = true`: Sets `animated: true`, `style: { stroke: '#a855f7', strokeWidth: 2.5 }`
- `active = false`: Resets stroke styles
- `resetEdgeStyles()`: Clears all edge animations (called in `useRunner.finally`)

---

### useRunner (`src/hooks/useRunner.js`)

Orchestrates execution of the entire node graph through the Claude API and external services.

#### Parameters

```js
useRunner({ nodes, edges, updateNodeData, activateEdges, resetEdgeStyles })
```

#### Returns

```js
{
  run,        // (apiKey: string, initialInput?: string) => Promise<void>
  isRunning   // React ref — isRunning.current is true during execution
}
```

#### Execution Sequence

1. **Guard**: If `isRunning.current` is `true`, return immediately (prevents double execution)
2. **Lock**: Set `isRunning.current = true`
3. **Sort**: `topologicalSort(nodes, edges)` determines execution order
4. **Identify subagents**: `getOrchestratorSubagentIds(nodes, edges)` returns IDs of nodes managed by orchestrators — skipped in main loop
5. **Initialize**: `prevOutput = initialInput` (from InputBar or empty string)
6. **For each node** (sequentially, skipping subagent nodes):
   - **Resolve templates**: `resolveTemplate()` on `systemPrompt` and `serviceConfig` fields
   - **orchestratorNode**: `executeOrchestrator()` with connected subagents as tools, edge glow activation
   - **serviceNode**: `executeService()` with resolved config and `prevOutput`
   - **agentNode**: `streamClaudeResponse()` with resolved prompt and `prevOutput`
   - On success: set status to `'done'`, assign `prevOutput = output`
7. **On error**: set status to `'error'`, store error message, re-throw to halt chain
8. **Finally**: `isRunning.current = false`, `resetEdgeStyles()`

#### Dependency Array

`[nodes, edges, updateNodeData, activateEdges, resetEdgeStyles]`

---

## Components

### App (`src/App.jsx`)

Root component that composes all UI elements and manages application-level state.

#### State

| State | Type | Purpose |
|---|---|---|
| `apiKey` | `string` | Anthropic API key, loaded from localStorage on mount |
| `showSettings` | `boolean` | Controls SettingsModal visibility; true if no key stored |
| `selectedNodeId` | `string \| null` | ID of currently selected node |

Note: `selectedNode` is derived via `useMemo` from `nodes` + `selectedNodeId`, ensuring it always reflects current node state.

#### Wiring

- Instantiates `useFlow()` for flow state (nodes, edges, all node actions)
- Instantiates `useRunner({ nodes, edges, updateNodeData, activateEdges, resetEdgeStyles })`
- Toolbar receives `addNode`, `addOrchestratorNode`, `addServiceNode`, `handleRun`, `handleClear`, `canRun`
- `canRun = !!apiKey && nodes.length > 0 && !isRunning.current`
- InputBar at the bottom provides text input + PDF upload, calls `handleRun(initialInput)`

#### Layout

```
┌───────────────────────────────────────────────────────┐
│                      Toolbar                          │
│  [+Node] [+Orchestrator] [+Service] [▶Run] [Clear]   │
├──────────────────────────────────┬────────────────────┤
│                                  │                    │
│          FlowCanvas              │  NodeEditorPanel   │
│     (React Flow canvas)         │  (sidebar)         │
│  AgentNode, OrchestratorNode,    │                    │
│  ServiceNode                     │                    │
│                                  │                    │
├──────────────────────────────────┴────────────────────┤
│  InputBar — [textarea] [PDF] [▶ Run]                  │
└───────────────────────────────────────────────────────┘
         SettingsModal (overlay, conditional)
         ErrorBoundary (wraps entire app in main.jsx)
```

---

### AgentNode (`src/components/AgentNode.jsx`)

Custom React Flow node representing a single AI agent.

#### Props

| Prop | Type | Description |
|---|---|---|
| `data` | `object` | Node data: `name`, `systemPrompt`, `temperature`, `output`, `status` |
| `selected` | `boolean` | Whether the node is currently selected |

#### Status Styles

| Status | Border | Background | Badge |
|---|---|---|---|
| `idle` | `border-gray-300` | `bg-white` | "Idle" (gray) |
| `running` | `border-yellow-400` | `bg-yellow-50` | "Working" (yellow) |
| `done` | `border-green-400` | `bg-green-50` | "Done" (green) |
| `error` | `border-red-400` | `bg-red-50` | "Error" (red) |

#### Visual Elements

- **Robot icon** (`\ud83e\udd16`) in blue before the name
- **Status badge**: Colored pill in top-right corner
- **Selection ring**: Blue ring (`ring-2 ring-blue-500`) when selected
- **Running indicator**: "Processing..." with `animate-pulse`
- **Output preview**: Shown during both `running` and `done` states (max-h-32, scrollable)
- **VariableBadges**: Shows `{{...}}` variable references at the bottom with clickable navigation
- **Handles**: target (left), source (right)

---

### OrchestratorNode (`src/components/OrchestratorNode.jsx`)

Custom React Flow node representing an orchestrator that delegates tasks to connected nodes via tool use.

#### Props

| Prop | Type | Description |
|---|---|---|
| `data` | `object` | `name`, `systemPrompt`, `temperature`, `maxRounds`, `output`, `status`, `currentRound`, `thinking` |
| `selected` | `boolean` | Whether the node is currently selected |

#### Status Styles

| Status | Border | Background | Badge |
|---|---|---|---|
| `idle` | `border-purple-300` | `bg-purple-50` | "Idle" |
| `thinking` | `border-purple-400` | `bg-purple-50` | "Thinking" (purple) |
| `calling_subagent` | `border-yellow-400` | `bg-yellow-50` | "Calling agents" (yellow) |
| `running` | `border-yellow-400` | `bg-yellow-50` | "Running" (yellow) |
| `done` | `border-green-400` | `bg-green-50` | "Done" (green) |
| `error` | `border-red-400` | `bg-red-50` | "Error" (red) |

#### Visual Elements

- **Brain icon** (`\ud83e\udde0`) in purple before the name
- **Round counter**: Shows "Round 2/5" during active execution
- **Thinking bubble**: Shows orchestrator's reasoning text (with `\ud83d\udcad` icon)
- **Selection ring**: Purple ring when selected
- **Width**: 64 (wider than AgentNode's 56) to accommodate round counter and thinking bubble
- **VariableBadges**: Same as AgentNode

---

### ServiceNode (`src/components/ServiceNode.jsx`)

Custom React Flow node representing an external service call.

#### Props

| Prop | Type | Description |
|---|---|---|
| `data` | `object` | `name`, `serviceType`, `serviceConfig`, `output`, `status` |
| `selected` | `boolean` | Whether the node is currently selected |

#### Status Styles

| Status | Border | Background | Badge |
|---|---|---|---|
| `idle` | `border-orange-300` | `bg-orange-50` | "Idle" |
| `running` | `border-yellow-400` | `bg-yellow-50` | "Calling" (yellow) |
| `done` | `border-green-400` | `bg-green-50` | "Done" (green) |
| `error` | `border-red-400` | `bg-red-50` | "Error" (red) |

#### Visual Elements

- **Service icon**: Dynamic from `SERVICE_TYPES[serviceType].icon` (e.g., W, `\ud83d\udcac`, G, `\u2709`, `\ud83d\udcca`)
- **Service type label**: Shows type + method (e.g., "Webhook (HTTP) (POST)")
- **Selection ring**: Orange ring when selected
- **VariableBadges**: Shows variable references in URL and headers

---

### FlowCanvas (`src/components/FlowCanvas.jsx`)

Wrapper around React Flow that renders the interactive node graph.

#### Architecture

Uses `ReactFlowProvider` + inner `FlowCanvasInner` pattern to access `useReactFlow()` for canvas navigation.

#### Props

| Prop | Type | Description |
|---|---|---|
| `nodes` | `Node[]` | Nodes from useFlow |
| `edges` | `Edge[]` | Edges from useFlow |
| `onNodesChange` | `function` | Node change handler |
| `onEdgesChange` | `function` | Edge change handler |
| `onConnect` | `function` | Connection handler |
| `onNodeClick` | `(node) => void` | Callback when a node is clicked |

#### Node Types Registry

```js
{ agentNode: AgentNode, orchestratorNode: OrchestratorNode, serviceNode: ServiceNode }
```

#### Node Enrichment

All nodes are enriched via `useMemo` with:
- `data._allNodes` — reference to all nodes (for VariableBadges validation)
- `data._onNavigateToNode` — callback that uses `setCenter()` to pan/zoom to a target node

#### Configuration

- **Delete key**: `['Delete', 'Backspace']` — both keys remove selected elements
- **Fit view**: Automatically fits all nodes in view on load
- **MiniMap colors**: Indigo (`#6366f1`) for agents, Purple (`#9333ea`) for orchestrators, Orange (`#ea580c`) for services

---

### NodeEditorPanel (`src/components/NodeEditorPanel.jsx`)

Sidebar panel that adapts to the selected node type.

#### Props

| Prop | Type | Description |
|---|---|---|
| `node` | `Node \| null` | Selected node (renders nothing if null) |
| `onChange` | `(id, data) => void` | Callback to update node data |
| `onClose` | `() => void` | Callback to close the panel |

#### Adaptive Fields

| Field | Input Type | Shown For |
|---|---|---|
| Name | Text input | All nodes |
| System Prompt | Textarea (h-40) | Agent + Orchestrator |
| Temperature | Range 0.0–1.0, step 0.1 | Agent + Orchestrator |
| Max Rounds | Range 1–20, step 1 | Orchestrator only |
| Service Type | Select dropdown | Service only |
| Dynamic config fields | Per service registry | Service only |
| Output | Read-only monospace display | All (when output exists) |

Service config fields are dynamically rendered from `SERVICE_TYPES[serviceType].configFields` — supports `text`, `textarea`, and `select` input types.

---

### Toolbar (`src/components/Toolbar.jsx`)

Top bar with action buttons.

#### Props

| Prop | Type | Description |
|---|---|---|
| `onAddNode` | `() => void` | Adds a new AgentNode |
| `onAddOrchestrator` | `() => void` | Adds a new OrchestratorNode |
| `onAddService` | `() => void` | Adds a new ServiceNode |
| `onRun` | `() => void` | Starts workflow execution |
| `onClear` | `() => void` | Removes all nodes and edges |
| `onSettings` | `() => void` | Opens the settings modal |
| `canRun` | `boolean` | Enables/disables the Run button |

#### Buttons

| Button | Color | Action |
|---|---|---|
| "+ Add Node" | Blue | Adds new AgentNode |
| "+ Orchestrator" | Purple | Adds new OrchestratorNode |
| "+ Service" | Orange | Adds new ServiceNode |
| "▶ Run" | Green (disabled when `!canRun`) | Executes the flow |
| "Clear" | Gray | Clears the canvas |
| "Settings" | Gray (right-aligned) | Opens settings modal |

---

### InputBar (`src/components/InputBar.jsx`)

Bottom bar with text input, file upload, and run button. Provides an alternative way to start execution with custom initial input.

#### Props

| Prop | Type | Description |
|---|---|---|
| `onRun` | `(input: string) => void` | Callback with the text input value |
| `canRun` | `boolean` | Enables/disables the Run button |

#### Features

- **Text input**: Multi-line textarea, grows based on content (2–4 rows)
- **Enter to submit**: Enter key submits; Shift+Enter for newlines
- **File upload**: Accepts `.pdf`, `.txt`, `.csv`, `.json`, `.md` files
- **PDF extraction**: PDF files are processed by `extractPdfText()` and appended to the input with `--- filename ---` headers
- **Plain text files**: Read directly via `file.text()` and appended
- **File badge**: Shows filename and size, with clear button
- **Loading state**: Upload button shows "..." during PDF processing

---

### SettingsModal (`src/components/SettingsModal.jsx`)

Tabbed modal for configuring API keys and service tokens.

#### Props

| Prop | Type | Description |
|---|---|---|
| `onSave` | `(key: string) => void` | Callback with the Claude API key |

#### Tabs

| Tab | localStorage Key | Placeholder | Input Type |
|---|---|---|---|
| Claude | `vab_api_key` | `sk-ant-...` | password |
| Slack | `vab_slack_webhook` | `https://hooks.slack.com/services/...` | text |
| GitHub | `vab_github_token` | `ghp_...` | password |
| Email | `vab_resend_key` | `re_...` | password |
| Sheets | `vab_gsheets_key` | `AIza...` | password |

Each tab has context-specific help text with setup instructions. "Save & Continue" saves all tab values to localStorage and calls `onSave` with the Claude key if valid.

#### Validation

The button is disabled when the Claude key is invalid (must start with `sk-ant-` and be > 20 chars) **and** no key is already stored.

---

### VariableBadges (`src/components/VariableBadges.jsx`)

Displays template variable references (`{{NodeName.output}}`) at the bottom of node cards.

#### Props

| Prop | Type | Description |
|---|---|---|
| `node` | `{type, data}` | The node to extract variables from |
| `allNodes` | `Node[]` | All nodes (for validation) |
| `onNavigateToNode` | `(nodeId) => void` | Callback to pan camera to referenced node |

#### Behavior

- Extracts variables via `extractNodeVariables(node)`
- Validates each against the node list (shows red `⚠` for unresolved, gray `←` for valid)
- Shows max 3 badges inline, overflow shows "+N more" with hover tooltip
- **Clickable**: Each badge navigates the canvas to the referenced node
- Renders nothing if no variables are found

---

### ErrorBoundary (`src/components/ErrorBoundary.jsx`)

React class component that catches render errors and displays a recovery UI.

- **Catch**: `getDerivedStateFromError` + `componentDidCatch` (logs stack trace)
- **Recovery UI**: Shows error message + stack trace with a "Clear flow & reload" button
- **Recovery action**: Clears `vab_flow` from localStorage and reloads the page

### Entry Point (`src/main.jsx`)

- **BigInt polyfill**: `BigInt.prototype.toJSON = function () { return this.toString() }` — React Flow uses BigInt internally, which causes `JSON.stringify` to fail without this polyfill
- **Render tree**: `StrictMode` → `ErrorBoundary` → `App`

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
    },
    {
      "id": "node-1712345678902",
      "type": "orchestratorNode",
      "position": { "x": 340, "y": 150 },
      "data": {
        "name": "Orchestrator",
        "systemPrompt": "You are a project manager.",
        "temperature": 0.7,
        "maxRounds": 5,
        "output": "",
        "status": "idle",
        "currentRound": 0
      }
    },
    {
      "id": "node-1712345678903",
      "type": "serviceNode",
      "position": { "x": 580, "y": 150 },
      "data": {
        "name": "Webhook",
        "serviceType": "slack",
        "serviceConfig": { "message": "" },
        "output": "",
        "status": "idle"
      }
    }
  ],
  "edges": [
    { "id": "reactflow__edge-node-1-node-2", "source": "node-1", "target": "node-2" }
  ]
}
```

### Service Tokens

| Key | Service | Format |
|---|---|---|
| `vab_api_key` | Claude (Anthropic) | `sk-ant-...` |
| `vab_slack_webhook` | Slack | Webhook URL |
| `vab_github_token` | GitHub | PAT (`ghp_...`) |
| `vab_resend_key` | Email (Resend) | API key (`re_...`) |
| `vab_gsheets_key` | Google Sheets | API key (`AIza...`) |

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Missing API key | "Run" button is disabled (`canRun = false`) |
| Empty flow (no nodes) | "Run" button is disabled |
| Running while already running | `isRunning` ref guard returns immediately |
| Claude API error | Failing node turns red, error message shown on node, execution halts |
| Cycle in graph | `topologicalSort` throws before any API calls |
| Edge references missing node | `topologicalSort` throws with descriptive error |
| Corrupt localStorage | `loadFlow()` catches parse errors, returns empty state |
| Unknown node types in storage | Filtered out on load (`VALID_TYPES` check) |
| React internals in storage | Prevented by whitelist serialization (`cleanData()`) |
| Orchestrator has no subagents | Executes with no tools (Claude responds directly) |
| Subagent fails during tool call | Error returned as `tool_result` with `is_error: true`; orchestrator decides next step |
| Orchestrator hits maxRounds | Returns last text + call summary, status becomes `'done'` |
| Service missing credentials | Throws with message directing user to Settings |
| Webhook returns non-OK status | Throws `"HTTP {status}: {body}"` |
| PDF extraction fails | Error message appended to input text |
| React render crash | ErrorBoundary catches, shows recovery UI with "Clear flow & reload" |
| Template variable references unknown node | Token left as-is (graceful degradation) |

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

### Template Unit Tests (`tests/template.test.js`)

| Test | Assertion |
|---|---|
| extractVariables: parses simple reference | `{{Agent.output}}` → correct nodeName + path |
| extractVariables: parses sub-path | `{{Agent.output.user.name}}` → path = `"user.name"` |
| resolvePath: traverses objects | Nested paths resolve correctly |
| resolvePath: array index support | `items[0]` resolves to first element |
| resolveTemplate: substitutes values | Variables replaced with node output |
| resolveTemplate: case-insensitive matching | `{{agent.output}}` matches "Agent" |
| resolveTemplate: leaves unknown nodes | Token preserved when node not found |
| validateVariables: marks valid/invalid | Found nodes → valid, missing → invalid with reason |

### Service Registry Tests (`tests/service-registry.test.js`)

| Test | Assertion |
|---|---|
| executeService: throws on unknown type | `"Unknown service type"` |
| Slack: throws without webhook URL | Directs user to Settings |

Run all tests:

```bash
npm test
```
