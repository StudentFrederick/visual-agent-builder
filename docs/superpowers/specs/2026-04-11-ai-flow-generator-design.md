# AI Flow Generator — Design Spec

**Date:** 2026-04-11
**Status:** Approved

---

## Overview

Users type a natural language description in the InputBar (e.g., "Create a workflow that researches AI trends, writes a summary, and sends it to Slack") and the app generates a complete, runnable workflow — nodes, edges, system prompts, and service configuration — on the canvas.

---

## How It Works

1. User types a flow description in the InputBar
2. User clicks "Generate" button (new, next to existing "Run")
3. App sends the description to Claude with a flow-generation system prompt
4. Claude returns a JSON flow definition
5. App parses the JSON and creates React Flow nodes and edges on the canvas
6. If canvas is not empty: a confirmation dialog asks "Replace existing flow or add to it?"
7. Flow is ready to run

---

## Flow Generation via Claude API

### Request

The generator calls Claude with:
- **System prompt:** A carefully crafted prompt (see below) that instructs Claude to return valid JSON describing a workflow
- **User message:** The user's flow description
- **Temperature:** 0.3 (low creativity, high reliability for structured output)
- **Max tokens:** 4096

### System Prompt

Stored as a constant in `flow-generator.js`:

```
You are a workflow generator for the Visual Agent Builder. Given a user description, you generate a workflow as a JSON object. Return ONLY valid JSON, no markdown, no explanation, no code fences.

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
- Use serviceNode for external integrations

Available service types and their serviceConfig:
- slack: { "message": "" } — sends message to Slack
- github: { "owner": "", "repo": "", "title": "", "body": "" } — creates GitHub issue
- email: { "to": "", "subject": "", "body": "" } — sends email via Resend
- gsheets: { "spreadsheetId": "", "sheetName": "Sheet1", "values": "" } — appends row to Google Sheets
- webhook: { "url": "", "method": "POST", "headers": "{}" } — HTTP request

For orchestrator nodes, connect them to their subagent nodes via edges (orchestrator → subagents). The orchestrator will automatically use these as tools.

Return the simplest workflow that accomplishes the user's goal.
```

### Response Parsing

1. Parse the response as JSON
2. Validate: must have `nodes` array and `edges` array
3. Each node must have a valid `type`
4. Edges must reference valid node indices
5. Invalid nodes are skipped; invalid edges are skipped
6. If JSON parsing fails entirely, show error message to user

---

## Node Positioning

Generated nodes are automatically positioned on the canvas:

### Linear chains
Nodes placed left-to-right with 280px horizontal spacing:
```
Node 0          Node 1          Node 2
(100, 150)      (380, 150)      (660, 150)
```

### Orchestrator with subagents
Orchestrator placed left, subagents stacked to its right:
```
                    Subagent A (380, 100)
Orchestrator   →   
(100, 150)         Subagent B (380, 250)
```

### When adding to existing flow
New nodes are placed below the existing nodes with a 200px vertical offset.

---

## InputBar Changes

The InputBar gets a second button:

```
┌──────────────────────────────────────────────────────────┐
│ [text input field                              ] [Generate] [Run] │
└──────────────────────────────────────────────────────────┘
```

- **Generate** — sends input to flow generator, creates nodes on canvas
- **Run** — existing behavior, executes the flow

The Generate button:
- Shows a loading spinner while Claude is generating
- Is disabled while generating or while a flow is running
- Shows error text below the InputBar if generation fails

---

## Canvas Replacement/Addition Dialog

When the user clicks "Generate" and the canvas already has nodes:

```
┌────────────────────────────────────────┐
│  Flow already exists                   │
│                                        │
│  What would you like to do?            │
│                                        │
│  [Replace]  [Add to existing]  [Cancel]│
└────────────────────────────────────────┘
```

- **Replace:** clears the canvas, then generates
- **Add to existing:** generates and positions new nodes below existing ones
- **Cancel:** does nothing

---

## Implementation Scope

### New Files

| File | Purpose |
|---|---|
| `src/utils/flow-generator.js` | Claude API call with generation prompt, JSON parsing, node/edge conversion to React Flow format |

### Modified Files

| File | Change |
|---|---|
| `src/components/InputBar.jsx` | Add "Generate" button, loading state, error display |
| `src/hooks/useFlow.js` | Add `setFlow(nodes, edges)` and `addToFlow(nodes, edges)` functions |
| `src/App.jsx` | Wire generate handler to flow state |

### Not In Scope

- Editing existing flows via text ("add a Slack node to my flow")
- Streaming the generation
- Multiple generation suggestions to choose from
- Undo/redo for generation

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Claude returns invalid JSON | Show "Could not generate flow. Try rephrasing your description." below InputBar |
| Claude returns empty nodes array | Show "No nodes generated. Try being more specific." |
| Missing API key | Show "API key required. Open Settings first." |
| Network error | Show error message below InputBar |
| Node with unknown type | Skip that node, generate the rest |
| Edge with invalid index | Skip that edge |

---

## Testing

- Unit: parse valid JSON → correct React Flow nodes and edges
- Unit: parse JSON with invalid nodes → skips them
- Unit: parse JSON with invalid edges → skips them
- Unit: parse invalid JSON → returns error
- Unit: node positioning for linear chain
- Unit: node positioning for orchestrator pattern
- Unit: node positioning for add-to-existing (vertical offset)
- Manual: type description → flow appears on canvas
- Manual: generate on non-empty canvas → dialog appears
- Manual: run generated flow → executes correctly
