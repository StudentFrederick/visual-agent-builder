import Anthropic from '@anthropic-ai/sdk'
import { streamClaudeResponse } from './claude.js'

/**
 * Sanitize a node name into a valid Anthropic tool name.
 * Lowercase, spaces to underscores, strip non-alphanumeric, max 64 chars.
 */
export function sanitizeToolName(name) {
  const sanitized = name
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 64)
  return sanitized || 'agent'
}

/**
 * Get all AgentNode IDs that are subagents of any orchestrator node.
 * These should be skipped in the main sequential runner loop.
 */
export function getOrchestratorSubagentIds(nodes, edges) {
  const orchestratorIds = new Set(
    nodes.filter(n => n.type === 'orchestratorNode').map(n => n.id)
  )
  const subagentIds = new Set()
  for (const edge of edges) {
    if (orchestratorIds.has(edge.source)) {
      const target = nodes.find(n => n.id === edge.target)
      if (target && target.type === 'agentNode') {
        subagentIds.add(target.id)
      }
    }
  }
  return subagentIds
}

/**
 * Get the subagent nodes connected via outgoing edges from an orchestrator.
 */
export function getSubagentNodes(orchestratorId, nodes, edges) {
  const targetIds = edges
    .filter(e => e.source === orchestratorId)
    .map(e => e.target)
  return nodes.filter(n => targetIds.includes(n.id) && n.type === 'agentNode')
}

/**
 * Build Anthropic tool definitions from subagent nodes.
 * Returns array of { nodeId, name, tool } objects.
 */
export function buildTools(subagentNodes) {
  const usedNames = new Set()
  return subagentNodes.map(node => {
    let name = sanitizeToolName(node.data.name)
    if (usedNames.has(name)) {
      name = `${name}_${node.id.slice(-4)}`
    }
    usedNames.add(name)
    return {
      nodeId: node.id,
      name,
      tool: {
        name,
        description: node.data.systemPrompt || `Agent: ${node.data.name}`,
        input_schema: {
          type: 'object',
          properties: {
            task: {
              type: 'string',
              description: 'The task to delegate to this agent'
            }
          },
          required: ['task']
        }
      }
    }
  })
}

/**
 * Execute an orchestrator node with a multi-turn agentic loop.
 * The orchestrator calls Claude with subagent tools, executes tool calls,
 * and loops until Claude produces a final text response or maxRounds is hit.
 *
 * @param {object} opts
 * @param {string} opts.apiKey
 * @param {object} opts.node - the orchestrator node
 * @param {Array} opts.subagentNodes - connected AgentNodes
 * @param {string} opts.userMessage - input from previous node in the chain
 * @param {(data: object) => void} opts.onUpdate - updates orchestrator node data
 * @param {(nodeId: string, data: object) => void} opts.onSubagentUpdate - updates subagent node data
 * @returns {Promise<string>} the orchestrator's final text output
 */
export async function executeOrchestrator({
  apiKey,
  node,
  subagentNodes,
  userMessage,
  onUpdate,
  onSubagentUpdate
}) {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
  const toolDefs = buildTools(subagentNodes)
  const tools = toolDefs.map(t => t.tool)
  const maxRounds = node.data.maxRounds || 5

  const messages = [{ role: 'user', content: userMessage || 'Begin.' }]
  let round = 0
  let lastText = ''

  while (round < maxRounds) {
    round++
    onUpdate({ currentRound: round, output: lastText || `Round ${round}/${maxRounds}...` })

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      temperature: node.data.temperature,
      system: node.data.systemPrompt,
      messages,
      tools: tools.length > 0 ? tools : undefined
    })

    // Extract text from response
    const textBlocks = response.content.filter(b => b.type === 'text')
    if (textBlocks.length > 0) {
      lastText = textBlocks.map(b => b.text).join('\n')
      onUpdate({ output: lastText })
    }

    // If no tool use, we're done
    const toolUseBlocks = response.content.filter(b => b.type === 'tool_use')
    if (toolUseBlocks.length === 0 || response.stop_reason === 'end_turn') {
      return lastText
    }

    // Add assistant message to conversation history
    messages.push({ role: 'assistant', content: response.content })

    // Execute all tool calls in parallel
    const toolResults = await Promise.all(
      toolUseBlocks.map(async toolUse => {
        const toolDef = toolDefs.find(t => t.name === toolUse.name)
        if (!toolDef) {
          return {
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: `Error: Unknown tool "${toolUse.name}"`
          }
        }

        const agentNode = subagentNodes.find(n => n.id === toolDef.nodeId)

        // Update subagent node UI
        onSubagentUpdate(agentNode.id, { status: 'running', output: '' })

        try {
          const result = await streamClaudeResponse({
            apiKey,
            systemPrompt: agentNode.data.systemPrompt,
            userMessage: toolUse.input.task,
            temperature: agentNode.data.temperature,
            onChunk: text => onSubagentUpdate(agentNode.id, { output: text })
          })
          onSubagentUpdate(agentNode.id, { status: 'done', output: result })
          return {
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: result
          }
        } catch (err) {
          onSubagentUpdate(agentNode.id, { status: 'error', output: err.message })
          return {
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: `Error: ${err.message}`,
            is_error: true
          }
        }
      })
    )

    messages.push({ role: 'user', content: toolResults })
  }

  // maxRounds exceeded — return whatever we have
  return lastText || 'Max rounds reached without a final response.'
}
