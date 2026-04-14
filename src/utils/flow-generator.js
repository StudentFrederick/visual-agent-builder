import Anthropic from '@anthropic-ai/sdk'

const VALID_TYPES = new Set(['agentNode', 'orchestratorNode', 'serviceNode'])

const GENERATION_SYSTEM_PROMPT = `You are a workflow generator for the Visual Agent Builder. Given a user description, you generate a workflow as a JSON object. Return ONLY valid JSON, no markdown, no explanation, no code fences.

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
- Use serviceNode for external integrations (slack, github, email, gsheets, webhook)

Available service types and their serviceConfig:
- slack: { "message": "" } — sends message to Slack
- github: { "owner": "", "repo": "", "title": "", "body": "" } — creates GitHub issue
- email: { "to": "", "subject": "", "body": "" } — sends email via Resend
- gsheets: { "spreadsheetId": "", "sheetName": "Sheet1", "values": "" } — appends row to Google Sheets
- webhook: { "url": "", "method": "POST", "headers": "{}" } — HTTP request

For orchestrator nodes, connect them to their subagent nodes via edges (orchestrator → subagents). The orchestrator will automatically use these as tools.

Return the simplest workflow that accomplishes the user's goal.`

function stripCodeFences(text) {
  const trimmed = text.trim()
  const fenceMatch = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/)
  return fenceMatch ? fenceMatch[1].trim() : trimmed
}

export function parseFlowJson(raw) {
  const cleaned = stripCodeFences(raw)

  let parsed
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new Error('Could not parse flow JSON. Try rephrasing your description.')
  }

  if (!Array.isArray(parsed.nodes)) {
    throw new Error('Invalid flow: missing nodes array.')
  }

  const indexMap = new Map()
  const validNodes = []
  for (let i = 0; i < parsed.nodes.length; i++) {
    const node = parsed.nodes[i]
    if (node && VALID_TYPES.has(node.type)) {
      indexMap.set(i, validNodes.length)
      validNodes.push({
        type: node.type,
        name: node.name || 'Agent',
        systemPrompt: node.systemPrompt || '',
        temperature: typeof node.temperature === 'number' ? node.temperature : 0.7,
        maxRounds: node.type === 'orchestratorNode' ? (node.maxRounds || 5) : undefined,
        serviceType: node.type === 'serviceNode' ? (node.serviceType || 'webhook') : undefined,
        serviceConfig: node.type === 'serviceNode' ? (node.serviceConfig || {}) : undefined
      })
    }
  }

  if (validNodes.length === 0) {
    throw new Error('No valid nodes generated. Try being more specific.')
  }

  const rawEdges = Array.isArray(parsed.edges) ? parsed.edges : []
  const validEdges = rawEdges
    .filter(e => indexMap.has(e.from) && indexMap.has(e.to))
    .map(e => ({ from: indexMap.get(e.from), to: indexMap.get(e.to) }))

  return { nodes: validNodes, edges: validEdges }
}

export function layoutNodes(nodes, edges, { offsetX = 0, offsetY = 0 } = {}) {
  const BASE_X = 100
  const BASE_Y = 150
  const H_SPACING = 280
  const V_SPACING = 150

  const children = new Map()
  for (let i = 0; i < nodes.length; i++) children.set(i, [])
  for (const edge of edges) {
    children.get(edge.from)?.push(edge.to)
  }

  const orchestratorChildren = new Map()
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].type === 'orchestratorNode') {
      orchestratorChildren.set(i, children.get(i) || [])
    }
  }

  const isSubagent = new Set()
  for (const kids of orchestratorChildren.values()) {
    for (const kid of kids) isSubagent.add(kid)
  }

  const positions = new Array(nodes.length)
  let cursorX = BASE_X

  for (let i = 0; i < nodes.length; i++) {
    if (isSubagent.has(i)) continue
    if (positions[i]) continue

    if (orchestratorChildren.has(i)) {
      const kids = orchestratorChildren.get(i)
      positions[i] = { x: cursorX + offsetX, y: BASE_Y + offsetY }

      const subX = cursorX + H_SPACING
      const totalHeight = kids.length * V_SPACING
      const startY = BASE_Y - totalHeight / 2 + V_SPACING / 2
      kids.forEach((kidIdx, j) => {
        positions[kidIdx] = { x: subX + offsetX, y: startY + j * V_SPACING + offsetY }
      })

      cursorX = subX + H_SPACING
    } else {
      positions[i] = { x: cursorX + offsetX, y: BASE_Y + offsetY }
      cursorX += H_SPACING
    }
  }

  return nodes.map((node, i) => ({
    ...node,
    position: positions[i] || { x: cursorX + offsetX, y: BASE_Y + offsetY }
  }))
}

export async function generateFlow(apiKey, description) {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    temperature: 0.3,
    system: GENERATION_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: description }]
  })

  const text = response.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('')

  return parseFlowJson(text)
}
