# CLAUDE.md — Visual Agent Builder

## Quick Start

```bash
npm install
npm run dev        # Start dev server → http://localhost:5173
npm test           # Run Vitest unit tests
npm run build      # Production build
```

Requires Node.js >= 18 and an Anthropic API key (entered in-browser on first visit, stored in localStorage under `vab_api_key`).

## Architecture

Single-page React app (Vite), no backend. All Claude API calls happen client-side.

### Three layers

1. **Canvas** — React Flow (@xyflow/react v12) renders the node graph
2. **State** — `useFlow` hook manages nodes/edges with localStorage persistence (`vab_flow`)
3. **Runtime** — `useRunner` topologically sorts the graph and executes nodes sequentially

### Node types

| Type | Component | Purpose |
|---|---|---|
| `agentNode` | `AgentNode.jsx` | Claude agent with system prompt, temperature |
| `orchestratorNode` | `OrchestratorNode.jsx` | Multi-turn agentic loop using Claude tool use to delegate to connected subagents |
| `serviceNode` | `ServiceNode.jsx` | HTTP/webhook calls to external services |

### Execution model

- `useRunner` calls `topologicalSort()` (Kahn's algorithm) to determine execution order
- Subagent nodes (targets of orchestrator edges) are skipped in the main loop — the orchestrator executes them internally via tool use
- Each node's output becomes the next node's `userMessage`
- Service nodes use `executeService()` from the pluggable service registry

### Key files

```
src/
├── App.jsx                    # Root — wires Toolbar, FlowCanvas, NodeEditorPanel, InputBar
├── components/
│   ├── AgentNode.jsx          # Agent node card with status indicator
│   ├── OrchestratorNode.jsx   # Purple-themed orchestrator with round counter
│   ├── ServiceNode.jsx        # Service node with type icon
│   ├── FlowCanvas.jsx         # React Flow canvas wrapper, registers all node types
│   ├── NodeEditorPanel.jsx    # Sidebar editor (dynamic fields per node type)
│   ├── Toolbar.jsx            # Top bar actions
│   ├── InputBar.jsx           # Bottom input with file upload + PDF extraction
│   ├── SettingsModal.jsx      # API key modal
│   └── ErrorBoundary.jsx      # Crash recovery
├── hooks/
│   ├── useFlow.js             # Nodes/edges state + localStorage persistence
│   └── useRunner.js           # Topological execution engine
└── utils/
    ├── claude.js              # Streaming Claude API wrapper (claude-sonnet-4-6, max 1024 tokens)
    ├── orchestrator.js        # Orchestrator agentic loop (max 4096 tokens)
    ├── topology.js            # Kahn's topological sort with cycle detection
    ├── service-registry.js    # Pluggable service type registry (webhook implemented)
    └── pdf-reader.js          # PDF text extraction (pdfjs-dist, lazy-loaded)
```

## Conventions

- **React 18** with function components and hooks only, no class components
- **Tailwind CSS v3** for all styling — no CSS modules, no styled-components
- **JSX extension** — all component files use `.jsx`
- **Named exports** for components (`export function Toolbar`) and utilities
- **Default export** only for `App.jsx`
- **Hooks** start with `use` and live in `src/hooks/`
- **Utils** are pure functions in `src/utils/` — no React dependencies
- **Tests** in `tests/` directory at project root, using Vitest, file pattern `*.test.js`
- **localStorage** keys prefixed with `vab_`
- **Node data whitelist** — `useFlow.js` explicitly whitelists persisted data fields per node type. New fields must be added to the `cleanData` function
- **Service registry** pattern — new service types go in `SERVICE_TYPES` object in `service-registry.js` with `label`, `icon`, `color`, `configFields`, `defaultConfig`, and `execute`

## Do Not Change

- **No backend** — the app runs entirely in the browser. All API calls are client-side
- **React Flow (@xyflow/react v12)** — do not switch to a different node editor library
- **Anthropic SDK client-side** — uses `dangerouslyAllowBrowser: true` by design
- **localStorage for persistence** — no databases, no cloud storage
- **Topological sort execution model** — Kahn's algorithm in `topology.js` determines run order
- **Orchestrator tool-use pattern** — subagent nodes become Claude tools; the agentic loop in `orchestrator.js` handles multi-turn delegation
- **Tailwind for styling** — do not introduce other CSS frameworks
- **Vite as bundler** — do not switch to webpack or other bundlers
