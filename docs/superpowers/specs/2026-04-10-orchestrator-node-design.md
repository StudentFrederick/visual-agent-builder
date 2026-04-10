# OrchestratorNode — Design Spec

**Date:** 2026-04-10
**Status:** Approved

---

## Overview

Add a new `OrchestratorNode` type that can autonomously delegate work to connected AgentNodes using Claude's native tool use API. The orchestrator receives a goal, decides which subagents to call (and in what order), can run them in parallel, and combines their output into a final result via a multi-turn agentic loop.

---

## Requirements

- New `orchestratorNode` type alongside existing `agentNode`
- Visually distinct: purple border, different icon
- Same base fields as AgentNode (name, system prompt, temperature) plus `maxRounds` (1–20, default 5)
- Orchestrator connects to subagents via **outgoing** edges (orchestrator left → subagents right)
- Uses Claude tool use API: connected AgentNodes become tools the orchestrator can call
- Multi-turn agentic loop: orchestrator calls tools, receives results, can call more tools, until it produces a final text response or hits maxRounds
- Flat architecture (MVP): orchestrators only control AgentNodes, not other orchestrators

---

## Architecture

### Tool Construction

When an orchestrator node executes, the runner:
1. Finds all nodes connected via **outgoing** edges from the orchestrator
2. Converts each connected AgentNode into an Anthropic tool definition:
   - `name`: node name sanitized (lowercase, spaces → underscores, non-alphanumeric removed)
   - `description`: the node's system prompt
   - `input_schema`: `{ type: "object", properties: { task: { type: "string", description: "The task to delegate to this agent" } }, required: ["task"] }`

### Agentic Loop

```
round = 0
messages = [{ role: "user", content: prevOutput || "Begin." }]

while round < maxRounds:
  response = claude.messages.create({ system, messages, tools })

  if response has text content only (stop_reason: "end_turn"):
    → done, return text as orchestrator output

  if response has tool_use blocks:
    for each tool_use (parallel):
      find the matching AgentNode
      execute it with streamClaudeResponse({ systemPrompt: agent.systemPrompt, userMessage: tool_use.input.task })
      collect result
    append assistant message + tool_result messages to conversation
    round++

if maxRounds reached:
  return last text content from assistant, or error
```

### Execution Order in useRunner

The existing `useRunner` uses `topologicalSort` to determine execution order. The orchestrator's subagents are connected via outgoing edges, so they appear **after** the orchestrator in topological order. This means the runner must **not** execute subagent nodes independently when they are targets of an orchestrator — the orchestrator handles their execution internally.

Changes to `useRunner`:
1. Before the main loop, identify all nodes that are subagents of an orchestrator (targets of outgoing edges from any orchestrator node)
2. Skip these nodes in the main sequential loop
3. When executing an orchestrator node, use the new `executeOrchestrator()` function instead of `streamClaudeResponse()`

---

## New/Modified Files

| File | Change |
|---|---|
| `src/components/OrchestratorNode.jsx` | **New** — custom node component with purple styling |
| `src/components/FlowCanvas.jsx` | **Modify** — register `orchestratorNode` type |
| `src/components/NodeEditorPanel.jsx` | **Modify** — show maxRounds slider when node type is orchestrator |
| `src/components/Toolbar.jsx` | **Modify** — add "Add Orchestrator" button |
| `src/hooks/useFlow.js` | **Modify** — add `addOrchestratorNode()` function |
| `src/hooks/useRunner.js` | **Modify** — detect orchestrator nodes, skip subagents, call orchestrator logic |
| `src/utils/orchestrator.js` | **New** — `executeOrchestrator()` with agentic loop + tool use |
| `tests/orchestrator.test.js` | **New** — tests for tool construction and subagent identification |

---

## OrchestratorNode Component

```
┌──────────────────────────────┐
│ ◈ Orchestrator Name          │  ← purple border, icon
│                              │
│ Running… (round 2/5)         │  ← shows current round
│                              │
│ [streaming output preview]   │
│                              │
│ ○ handle(target)  handle(source) ○ │
└──────────────────────────────┘
```

- Purple border (`border-purple-500`) and purple background tints for status states
- Shows round counter during execution: "Round 2/5"
- Same handles as AgentNode: target (left), source (right)
- Source handle connects to subagent target handles

---

## NodeEditorPanel Changes

When an orchestrator node is selected, show the standard fields (name, system prompt, temperature) plus:
- **Max Rounds** slider (1–20, step 1, default 5) with label showing current value

---

## Data Shape

```js
{
  id: 'node-{timestamp}',
  type: 'orchestratorNode',
  position: { x, y },
  data: {
    name: 'Orchestrator',
    systemPrompt: 'You are a project manager that delegates tasks...',
    temperature: 0.7,
    maxRounds: 5,
    output: '',
    status: 'idle',       // idle | running | done | error
    currentRound: 0       // updated during execution for UI feedback
  }
}
```

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Orchestrator has no connected subagents | Execute as regular agent (no tools), warn in output |
| Subagent fails during tool call | Return error as tool_result, let orchestrator decide how to handle |
| maxRounds exceeded | Return last assistant text, set status to 'done' |
| Cycle involving orchestrator | topologicalSort catches it |
| Orchestrator connected to another orchestrator | Skip non-AgentNode targets (MVP: flat only) |

---

## Testing

- Unit test: `getSubagentTools(orchestratorId, nodes, edges)` correctly builds tool definitions
- Unit test: `getOrchestratorSubagentIds(nodes, edges)` correctly identifies subagent node IDs
- Unit test: tool name sanitization
- Manual test: orchestrator delegates to 2 subagents, combines results
- Manual test: maxRounds limit is respected
- Manual test: subagent error is handled gracefully
