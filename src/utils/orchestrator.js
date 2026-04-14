import Anthropic from '@anthropic-ai/sdk'
import { streamClaudeResponse } from './claude.js'
import { executeService, getServiceToolDescription } from './service-registry.js'

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

/** Node types that an orchestrator can control as tools. */
const TOOL_NODE_TYPES = new Set(['agentNode', 'serviceNode'])

/**
 * Get all node IDs that are sub-nodes of any orchestrator.
 * These should be skipped in the main sequential runner loop.
 */
export function getOrchestratorSubagentIds(nodes, edges) {
  const orchestratorIds = new Set(
    nodes.filter(n => n.type === 'orchestratorNode').map(n => n.id)
  )
  const subIds = new Set()
  for (const edge of edges) {
    if (orchestratorIds.has(edge.source)) {
      const target = nodes.find(n => n.id === edge.target)
      if (target && TOOL_NODE_TYPES.has(target.type)) {
        subIds.add(target.id)
      }
    }
  }
  return subIds
}

/**
 * Get all tool-capable nodes (agents + services) connected from an orchestrator.
 */
export function getSubagentNodes(orchestratorId, nodes, edges) {
  const targetIds = edges
    .filter(e => e.source === orchestratorId)
    .map(e => e.target)
  return nodes.filter(n => targetIds.includes(n.id) && TOOL_NODE_TYPES.has(n.type))
}

/**
 * Build Anthropic tool definitions from sub-nodes (agents + services).
 * Returns array of { nodeId, nodeType, name, tool } objects.
 */
export function buildTools(subNodes) {
  const usedNames = new Set()
  return subNodes.map(node => {
    let name = sanitizeToolName(node.data.name)
    if (usedNames.has(name)) {
      name = `${name}_${node.id.slice(-4)}`
    }
    usedNames.add(name)

    // Different tool schemas for agents vs services
    const isService = node.type === 'serviceNode'

    return {
      nodeId: node.id,
      nodeType: node.type,
      name,
      tool: {
        name,
        description: isService
          ? getServiceToolDescription(node)
          : (node.data.systemPrompt || `Agent: ${node.data.name}`),
        input_schema: {
          type: 'object',
          properties: {
            task: {
              type: 'string',
              description: isService
                ? 'The JSON payload or data to send to this service'
                : 'The task to delegate to this agent'
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
 * @param {Array} opts.subagentNodes - connected tool nodes (AgentNodes + ServiceNodes)
 * @param {string} opts.userMessage - input from previous node in the chain
 * @param {(data: object) => void} opts.onUpdate - updates orchestrator node data
 * @param {(nodeId: string, data: object) => void} opts.onSubagentUpdate - updates subagent node data
 * @param {(sourceId: string, targetIds: string[], active: boolean) => void} opts.onEdgeActivate - activates/deactivates edge glow
 * @returns {Promise<string>} the orchestrator's final text output
 */
export async function executeOrchestrator({
  apiKey,
  node,
  subagentNodes,
  userMessage,
  onUpdate,
  onSubagentUpdate,
  onEdgeActivate,
  signal
}) {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
  const toolDefs = buildTools(subagentNodes)
  const tools = toolDefs.map(t => t.tool)
  const maxRounds = node.data.maxRounds || 5
  const allSubagentIds = subagentNodes.map(n => n.id)

  const messages = [{ role: 'user', content: userMessage || 'Begin.' }]
  let round = 0
  let lastText = ''

  // Track tool calls for result aggregation
  const callLog = []

  while (round < maxRounds) {
    if (signal?.aborted) break
    round++
    onUpdate({
      currentRound: round,
      status: 'thinking',
      thinking: `Analyzing task (round ${round}/${maxRounds})...`
    })

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      temperature: node.data.temperature,
      system: node.data.systemPrompt,
      messages,
      tools: tools.length > 0 ? tools : undefined
    }, { signal })

    // Extract text (orchestrator's "thoughts" or final answer)
    const textBlocks = response.content.filter(b => b.type === 'text')
    if (textBlocks.length > 0) {
      lastText = textBlocks.map(b => b.text).join('\n')
    }

    // If no tool use, we're done
    const toolUseBlocks = response.content.filter(b => b.type === 'tool_use')
    if (toolUseBlocks.length === 0 || response.stop_reason === 'end_turn') {
      // Generate final report with aggregation
      const report = buildReport(lastText, callLog)
      onUpdate({ output: report, thinking: null, status: 'done' })
      return report
    }

    // Show thinking bubble with reasoning text
    if (lastText) {
      onUpdate({ thinking: lastText, output: lastText })
    }

    // Identify which subagent nodes are being called
    const calledNodeIds = toolUseBlocks
      .map(tu => toolDefs.find(t => t.name === tu.name)?.nodeId)
      .filter(Boolean)

    // Update status + activate glowing edges
    onUpdate({ status: 'calling_subagent' })
    onEdgeActivate(node.id, calledNodeIds, true)

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

        const subNode = subagentNodes.find(n => n.id === toolDef.nodeId)

        // Update sub-node UI
        onSubagentUpdate(subNode.id, { status: 'running', output: '' })

        try {
          let result

          if (subNode.type === 'serviceNode') {
            // Execute service action (webhook, etc.)
            result = await executeService(
              subNode.data.serviceType,
              subNode.data.serviceConfig,
              toolUse.input.task
            )
          } else {
            // Execute agent LLM call
            result = await streamClaudeResponse({
              apiKey,
              systemPrompt: subNode.data.systemPrompt,
              userMessage: toolUse.input.task,
              temperature: subNode.data.temperature,
              onChunk: text => onSubagentUpdate(subNode.id, { output: text }),
              signal
            })
          }

          onSubagentUpdate(subNode.id, { status: 'done', output: result })

          // Log for result aggregation
          callLog.push({
            agent: subNode.data.name,
            task: toolUse.input.task,
            result: result.slice(0, 200) + (result.length > 200 ? '...' : ''),
            success: true
          })

          return {
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: result
          }
        } catch (err) {
          onSubagentUpdate(subNode.id, { status: 'error', output: err.message })

          callLog.push({
            agent: subNode.data.name,
            task: toolUse.input.task,
            result: err.message,
            success: false
          })

          return {
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: `Error: ${err.message}`,
            is_error: true
          }
        }
      })
    )

    // Deactivate glowing edges after tool calls complete
    onEdgeActivate(node.id, calledNodeIds, false)

    messages.push({ role: 'user', content: toolResults })
  }

  // maxRounds exceeded — still build a report
  const report = buildReport(
    lastText || 'Max rounds reached without a final response.',
    callLog
  )
  onUpdate({ output: report, thinking: null })
  return report
}

/**
 * Build a final report showing the orchestrator's answer + which agents were used.
 */
function buildReport(finalText, callLog) {
  if (callLog.length === 0) return finalText

  const summary = callLog
    .map((c, i) => `${i + 1}. ${c.agent} — ${c.success ? 'OK' : 'FAILED'}: "${c.task}"`)
    .join('\n')

  return `${finalText}\n\n---\nAgents used (${callLog.length} calls):\n${summary}`
}
