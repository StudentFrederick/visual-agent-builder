# Visual Agent Builder

A no-code, browser-based tool for visually designing and running AI agent workflows. Chain Claude agents together on a drag-and-drop canvas — no backend required.

## What It Does

Visual Agent Builder lets you:

- **Design workflows visually** — Drag agent nodes onto a canvas and connect them by drawing edges
- **Configure each agent** — Set a name, system prompt, and temperature per node
- **Run the chain** — Execute nodes in topological order; each node's output becomes the next node's input
- **Stream responses** — See Claude's output appear in real-time on each node
- **Persist your work** — Flows are saved to localStorage and restored on reload
- **Orchestrate multi-agent workflows** — Use Orchestrator nodes that autonomously delegate tasks to connected agents via Claude's tool use API, with configurable multi-turn agentic loops
- **Connect external services** — Add Service nodes for Slack, GitHub Issues, Email (Resend), Google Sheets, or generic webhooks
- **Use template variables** — Reference other nodes' output with `{{NodeName.output}}` syntax, with JSON path support
- **Upload documents** — Attach PDF, TXT, CSV, JSON, or Markdown files as input via the InputBar

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

### Basic Agent Chain
1. **Add nodes** — Click "+ Add Node" in the toolbar to place agent nodes on the canvas
2. **Configure** — Click a node to open the editor panel. Set its name, system prompt, and temperature
3. **Connect** — Drag from the right handle of one node to the left handle of another to create a data flow
4. **Run** — Click "Run" to execute the chain. The first node receives `"Begin."` as input; subsequent nodes receive the previous node's output
5. **Observe** — Watch streaming output appear on each node in real-time. Nodes turn yellow while running, green when done, red on error

### Multi-Agent Orchestration
1. **Add an orchestrator** — Click "+ Orchestrator" to place a purple orchestrator node
2. **Add subagents** — Add regular agent nodes or service nodes and connect them **from** the orchestrator's right handle **to** each node's left handle
3. **Configure the orchestrator** — Give it a system prompt describing its goal (e.g., "You are a project manager. Research the topic, then write a report."). Set Max Rounds (1–20) to control how many turns it can take
4. **Configure subagents** — Each agent/service gets its own config and acts as a tool the orchestrator can call
5. **Run** — The orchestrator uses Claude's tool use API to decide which tools to call, can run them in parallel, receives their results, and can call more in subsequent rounds until it produces a final answer

### External Services
1. **Add a service node** — Click "+ Service" to place an orange service node
2. **Choose a service type** — Select from Webhook, Slack, GitHub Issue, Email (Resend), or Google Sheets
3. **Configure credentials** — Open Settings and add the required token/key for the service
4. **Configure the node** — Set service-specific fields (URL, message, repo, etc.)
5. **Run** — Service nodes execute HTTP calls and pass results to the next node

### Template Variables
Reference any node's output in system prompts or service config:
- `{{Researcher.output}}` — full output of the "Researcher" node
- `{{Analyzer.output.score}}` — JSON path into the output
- `{{Data.output.items[0]}}` — array index support

Variable badges on each node show which nodes it references, with clickable navigation.

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
│   │   ├── OrchestratorNode.jsx  # Orchestrator node with purple styling + round counter
│   │   ├── ServiceNode.jsx       # Service node for external API calls (orange)
│   │   ├── FlowCanvas.jsx        # React Flow canvas wrapper with node enrichment
│   │   ├── InputBar.jsx          # Bottom input bar with text input + PDF upload
│   │   ├── NodeEditorPanel.jsx   # Adaptive sidebar for editing selected node
│   │   ├── SettingsModal.jsx     # Tabbed settings for API keys + service tokens
│   │   ├── VariableBadges.jsx    # Template variable display + navigation
│   │   ├── ErrorBoundary.jsx     # React error boundary with recovery UI
│   │   └── Toolbar.jsx           # Action buttons (Add, Orchestrator, Service, Run, Clear, Settings)
│   ├── hooks/
│   │   ├── useFlow.js            # Flow state + localStorage persistence + edge animation
│   │   └── useRunner.js          # Topological execution + template resolution + multi-type dispatch
│   └── utils/
│       ├── claude.js             # Streaming Claude API wrapper
│       ├── orchestrator.js       # Orchestrator agentic loop + tool construction
│       ├── service-registry.js   # Pluggable service types (Slack, GitHub, Email, Sheets, Webhook)
│       ├── template.js           # Template variable engine ({{Node.output.path}})
│       ├── pdf-reader.js         # PDF text extraction (lazy-loaded pdfjs-dist)
│       └── topology.js           # Topological sort (Kahn's algorithm)
└── tests/
    ├── orchestrator.test.js      # Unit tests for orchestrator utilities
    ├── service-registry.test.js  # Unit tests for service registry
    ├── template.test.js          # Unit tests for template engine
    └── topology.test.js          # Unit tests for topological sort
```

## Architecture Overview

The app is a **single-page React application with no backend**. All Claude API calls are made directly from the browser using the user's API key.

Three layers:

1. **Canvas Layer** — React Flow renders the node graph with three node types: AgentNode (blue), OrchestratorNode (purple), and ServiceNode (orange).
2. **State Layer** — The `useFlow` hook manages nodes/edges state and persists to localStorage on every change, with whitelist serialization to prevent data leaks.
3. **Runtime Layer** — The `useRunner` hook topologically sorts the graph, resolves template variables, then dispatches each node by type: streaming Claude calls for agents, multi-turn agentic loops for orchestrators, and HTTP calls for services.

See [TECHNICAL_DOCS.md](./TECHNICAL_DOCS.md) for detailed technical documentation.

## API Keys & Service Tokens

All credentials are stored in `localStorage` in your browser only — never sent to any server other than the intended API.

| Service | Settings Tab | localStorage Key |
|---|---|---|
| Claude (Anthropic) | Claude | `vab_api_key` |
| Slack | Slack | `vab_slack_webhook` |
| GitHub | GitHub | `vab_github_token` |
| Email (Resend) | Email | `vab_resend_key` |
| Google Sheets | Sheets | `vab_gsheets_key` |

Configure all tokens in the tabbed Settings modal (gear icon in the toolbar).

## License

Private project.
