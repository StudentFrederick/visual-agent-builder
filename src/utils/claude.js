import Anthropic from '@anthropic-ai/sdk'

/**
 * Calls Claude with streaming and invokes callbacks per chunk.
 * @param {object} opts
 * @param {string} opts.apiKey - Anthropic API key
 * @param {string} opts.systemPrompt - system prompt for this node
 * @param {string} opts.userMessage - output of the previous node (or empty string)
 * @param {number} opts.temperature - 0.0 – 1.0
 * @param {(text: string) => void} opts.onChunk - called with accumulated text on each delta
 * @param {(text: string) => void} opts.onDone - called with full text when stream ends
 * @returns {Promise<string>} the full response text
 */
export async function streamClaudeResponse({
  apiKey,
  systemPrompt,
  userMessage,
  temperature,
  onChunk,
  onDone,
  signal
}) {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })

  let fullText = ''

  const stream = client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    temperature,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage || 'Begin.' }]
  }, { signal })

  for await (const event of stream) {
    if (signal?.aborted) break
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta'
    ) {
      fullText += event.delta.text
      onChunk?.(fullText)
    }
  }

  onDone?.(fullText)
  return fullText
}
