# Visual Agent Builder

A no-code, browser-based tool for visually designing and running AI agent workflows. Chain Claude agents together on a drag-and-drop canvas — no backend required.

## What It Does

Visual Agent Builder lets you:

- **Design workflows visually** — Drag agent nodes onto a canvas and connect them by drawing edges
- **Configure each agent** — Set a name, system prompt, and temperature per node
- **Run the chain** — Execute nodes in topological order; each node's output becomes the next node's input
- **Stream responses** — See Claude's output appear in real-time on each node
- **Persist your work** — Flows are saved to localStorage and restored on reload

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 (Vite) |
| Node Editor | React Flow (@xyflow/react v12) |
| AI | Anthropic Claude API (client-side streaming) |
| Styling | Tailwind CSS v3 |
| Persistence | localStorage |
| Testing | Vitest |

## Getting Started

### Prerequisites

- Node.js >= 18
- An [Anthropic API key](https://console.anthropic.com/)

### Installation

```bash
git clone <repo-url>
cd visual-agent-builder
npm install
```

### Development

```bash
npm run dev
```

Open `http://localhost:5173` in your browser. On first visit, a modal will prompt you for your Anthropic API key (stored locally in your browser only).

### Build

```bash
npm run build
npm run preview
```

### Tests

```bash
npm test
```

## Usage

1. **Add nodes** — Click "+ Add Node" in the toolbar to place agent nodes on the canvas
2. **Configure** — Click a node to open the editor panel. Set its name, system prompt, and temperature
3. **Connect** — Drag from the right handle of one node to the left handle of another to create a data flow
4. **Run** — Click "Run" to execute the chain. The first node receives `"Begin."` as input; subsequent nodes receive the previous node's output
5. **Observe** — Watch streaming output appear on each node in real-time. Nodes turn yellow while running, green when done, red on error

## Project Structure

```
visual-agent-builder/
├── index.html                    # HTML entry point
├── package.json                  # Dependencies and scripts
├── vite.config.js                # Vite + Vitest configuration
├── tailwind.config.js            # Tailwind CSS content paths
├── postcss.config.js             # PostCSS plugins
├── src/
│   ├── main.jsx                  # React root mount
│   ├── index.css                 # Tailwind directives
│   ├── App.jsx                   # Root component — orchestrates all panels
│   ├── components/
│   │   ├── AgentNode.jsx         # Custom React Flow node with status indicators
│   │   ├── FlowCanvas.jsx        # React Flow canvas wrapper
│   │   ├── NodeEditorPanel.jsx   # Sidebar for editing selected node
│   │   ├── SettingsModal.jsx     # API key entry modal
│   │   └── Toolbar.jsx           # Action buttons (Add, Run, Clear, Settings)
│   ├── hooks/
│   │   ├── useFlow.js            # Flow state + localStorage persistence
│   │   └── useRunner.js          # Topological execution + Claude streaming
│   └── utils/
│       ├── claude.js             # Streaming Claude API wrapper
│       └── topology.js           # Topological sort (Kahn's algorithm)
└── tests/
    └── topology.test.js          # Unit tests for topological sort
```

## Architecture Overview

The app is a **single-page React application with no backend**. All Claude API calls are made directly from the browser using the user's API key.

Three layers:

1. **Canvas Layer** — React Flow renders the node graph. Users place `AgentNode` components and connect them via edges.
2. **State Layer** — The `useFlow` hook manages nodes/edges state and persists to localStorage on every change.
3. **Runtime Layer** — The `useRunner` hook topologically sorts the graph, then executes each node sequentially via the Claude streaming API.

See [TECHNICAL_DOCS.md](./TECHNICAL_DOCS.md) for detailed technical documentation.

## API Key Handling

- Your API key is stored in `localStorage` under `vab_api_key`
- It is sent directly to the Anthropic API from your browser
- It is **never** sent to any other server
- You can update it at any time via Settings in the toolbar

## License

Private project.
