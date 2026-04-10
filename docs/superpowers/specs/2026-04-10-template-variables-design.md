# Template Variables & Response Parsing — Design Spec

**Date:** 2026-04-10
**Status:** Approved

---

## Overview

Add a template variable system that lets users reference output from other nodes using `{{NodeName.output}}` syntax in any configuration field. Supports JSON dot-notation for response parsing. Nodes display their variable dependencies visually on the canvas.

---

## Template Syntax

Users reference node output with double curly braces:

```
{{Summarizer.output}}              → full output of "Summarizer" node
{{Webhook.output.user.name}}       → nested JSON field
{{Webhook.output.items[0].title}}  → array access
```

### Rules

- Node name matching is case-insensitive
- Spaces in node names are preserved in the template: `{{My Agent.output}}`
- Unresolved variables remain as literal text (no crash)
- Works in: system prompts, webhook URL, webhook body, webhook headers
- Resolution happens just before node execution, using the most recent output from earlier nodes

---

## Response Parsing via Dot-Notation

When a node's output is valid JSON, dot-notation traverses into it:

1. Retrieve `node.output` as string
2. Attempt `JSON.parse()` — if not valid JSON, return the full string (dot-path is ignored)
3. Walk the path segments (`data` → `message`) and return the value
4. If the path does not exist, return `undefined` and leave the template literal in place as a warning
5. If the final value is an object/array, convert back with `JSON.stringify()`

This works for all node types — not just ServiceNodes.

---

## Visual Indicators on Nodes

### Variable Badges

Each node card shows used variables below the output area:

```
┌──────────────────────────────┐
│ ● Summarizer                 │
│                              │
│ [streaming output preview]   │
│                              │
│ ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄ │
│ ← Webhook.output.user.name  │  ← valid: gray text
│ ⚠ Reserch.output             │  ← invalid: red text + icon
│ ○ target              source ○│
└──────────────────────────────┘
```

### Validation

- **Valid** variable (node exists, path resolves): gray text with `←` prefix
- **Invalid** variable (node not found or path doesn't exist): red text with `⚠` icon
- Validation runs at two moments: on config change and just before execution

### Interactivity

- **Click** a variable badge → canvas pans and zooms to the source node, selects it (via React Flow `setCenter` / `fitView`)
- **Max 3** badges visible; overflow shows `+N more` badge
- **Hover** on `+N more` → tooltip with full variable list

---

## Template Resolution Engine

### Parsing

Extract all `{{...}}` tokens from a string. Each token has:
- `nodeName`: everything before the first `.output`
- `path`: everything after `.output` (optional, can be empty or a dot-path like `.user.name`)

### Resolution

```
resolveTemplate(templateString, nodes) → resolvedString

For each {{...}} token:
  1. Find the node by name (case-insensitive match)
  2. If node not found → leave token as-is
  3. Get node.data.output
  4. If path is empty → substitute with full output
  5. If path exists → JSON.parse the output, traverse path
     - Path not found → leave token as-is
     - Value is primitive → substitute as string
     - Value is object/array → substitute as JSON.stringify()
  6. If output is not valid JSON but path is specified → leave token as-is
```

### Variable Extraction

```
extractVariables(templateString) → [{ raw, nodeName, path }]
```

Used by node components to render badges without resolving values.

### Variable Validation

```
validateVariables(variables, nodes) → [{ raw, nodeName, path, valid, reason }]
```

Checks whether each variable's node exists. Used for the red/gray badge rendering.

---

## Implementation Scope

### New Files

| File | Purpose |
|---|---|
| `src/utils/template.js` | Template parsing, variable extraction, resolution, JSON path traversal |
| `tests/template.test.js` | Unit tests for parsing, resolution, JSON paths, edge cases |

### Modified Files

| File | Change |
|---|---|
| `src/hooks/useRunner.js` | Call `resolveTemplate()` on node config fields before execution |
| `src/components/AgentNode.jsx` | Render variable badges from node config |
| `src/components/OrchestratorNode.jsx` | Render variable badges from node config |
| `src/components/ServiceNode.jsx` | Render variable badges from node config |

### Not In Scope

- Autocomplete / suggestions in text fields
- Visual edge lines between variable badges and source nodes
- Template variables in node name field

---

## Edge Cases

| Scenario | Behavior |
|---|---|
| Node name typo | Variable stays as literal, badge shows red with `⚠` |
| Circular reference (A refs B, B refs A) | Topological sort prevents this — if A runs before B, B's output is empty string |
| Multiple nodes with same name | First match wins (by node array order) |
| Node output is empty string | Variable resolves to empty string |
| Deeply nested JSON path | Traverses as far as possible; returns undefined if path breaks |
| Array index out of bounds | Returns undefined, leaves token as-is |
| Template in webhook URL | Resolved before HTTP call — allows dynamic URLs |

---

## Testing

- Unit: parse `{{Foo.output}}` → `{ nodeName: "Foo", path: "" }`
- Unit: parse `{{Foo.output.bar.baz}}` → `{ nodeName: "Foo", path: "bar.baz" }`
- Unit: parse `{{Foo.output.items[0]}}` → array access
- Unit: resolve with matching node → substituted string
- Unit: resolve with missing node → token left as-is
- Unit: resolve with JSON output + dot-path → correct value
- Unit: resolve with non-JSON output + dot-path → full output returned
- Unit: multiple variables in one string
- Unit: validate variables → valid/invalid with reasons
- Unit: case-insensitive node name matching
- Unit: node names with spaces
