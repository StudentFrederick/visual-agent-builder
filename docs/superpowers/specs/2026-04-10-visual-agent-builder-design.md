# Visual Agent Builder — Design Spec

**Date:** 2026-04-10  
**Status:** Approved

---

## Overview

A no-code, browser-based tool that lets non-technical users visually design and run AI agent workflows. Users place agent nodes on a canvas, connect them, configure each node with a system prompt, and execute the chain — all without writing code.

---

## Goals

- Make complex AI workflows visual and understandable for non-technical users
- Allow users to chain Claude agents together in a node-based flow editor
- Run workflows directly in the browser with no backend required
- Persist flows between sessions using localStorage

---

## Non-Goals

- Multi-provider LLM support (Claude only for now)
- User accounts or cloud storage
- Non-agent node types (conditions, branching, etc.) — MVP only
- Mobile support

---

## Tech Stack

| Concern | Choice |
|---|---|
| Framework | React (Vite) |
| Node editor | React Flow |
| AI backend | Anthropic Claude API (client-side) |
| Styling | Tailwind CSS |
| Persistence | localStorage |

---

## Architecture

A single-page React app with no backend. Three main layers:

1. **Canvas layer** — React Flow renders the node graph. Users drag agent nodes onto the canvas and connect them by drawing edges between handles.
2. **Node editor panel** — when a node is selected, a sidebar opens to configure it: name, system prompt, temperature.
3. **Runtime layer** — clicking "Run" walks the graph from source to sink, calling the Claude API sequentially. The output of each node is passed as the user message to the next node.

---

## Components

```
App
├── SettingsModal        — API key input, stored in localStorage
├── Toolbar              — "Add Node", "Run", "Clear" buttons
├── FlowCanvas           — React Flow canvas (nodes + edges)
│   └── AgentNode        — node card: name label + run status indicator
└── NodeEditorPanel      — sidebar for the selected node
    ├── Name field
    ├── System prompt textarea
    └── Temperature slider (0.0 – 1.0)
```

---

## Data Flow

### Editing
- User adds a node via the Toolbar → a new `AgentNode` appears on the canvas
- User selects a node → `NodeEditorPanel` opens with that node's config
- User connects nodes by dragging from one handle to another
- Every state change triggers a `useEffect` that serializes the full flow to `localStorage`
- On page load, the last saved flow is restored from `localStorage`

### Running
1. User clicks "Run"
2. App resolves the execution order by topologically sorting the graph
3. For each node in order:
   - Call Claude API with the node's system prompt as `system` and the previous node's output as the `user` message (first node receives an empty string as user message — its system prompt defines the full task)
   - Stream the response and display it inline on the node
4. When all nodes complete, execution is done

---

## API Key Handling

- First visit: a `SettingsModal` prompts the user to enter their Anthropic API key
- Key is stored in `localStorage` under `vab_api_key`
- All Claude API calls are made directly from the browser using this key
- A settings icon in the Toolbar lets users update the key at any time

---

## Persistence Schema

```json
{
  "nodes": [
    {
      "id": "node-1",
      "position": { "x": 100, "y": 150 },
      "data": {
        "name": "Summarizer",
        "systemPrompt": "Summarize the input in 3 bullet points.",
        "temperature": 0.7
      }
    }
  ],
  "edges": [
    { "id": "e1-2", "source": "node-1", "target": "node-2" }
  ]
}
```

Stored under `vab_flow` in `localStorage`.

---

## Error Handling

- Missing API key: block "Run" and show a prompt to open Settings
- Claude API error: display the error message on the failing node, halt execution
- Empty flow: "Run" is disabled if there are no nodes

---

## Testing

- Manual testing of the full edit → run loop in the browser
- Verify localStorage persistence across page reloads
- Verify streaming output displays correctly on nodes
- Verify error states (invalid key, API error) are shown gracefully
