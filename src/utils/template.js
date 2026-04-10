/**
 * Template variable engine for the Visual Agent Builder.
 *
 * Variables use the syntax {{NodeName.output}} or {{NodeName.output.some.path}}.
 * Node names may contain spaces.
 */

// Matches {{<anything>.output}} or {{<anything>.output.<path>}}
// Group 1: full content inside braces
// We'll parse the capture manually to separate nodeName from path.
const TEMPLATE_REGEX = /\{\{([^}]+\.output(?:\.[^}]+)?)\}\}/g

/**
 * Parse a raw inner string like "My Node.output.user.name" into
 * { nodeName, path }.
 *
 * @param {string} inner - content between the outer braces (without {{ }})
 * @returns {{ nodeName: string, path: string } | null}
 */
function parseInner(inner) {
  // Must contain ".output" somewhere after a non-empty node name
  const outputIdx = inner.indexOf('.output')
  if (outputIdx <= 0) return null

  const nodeName = inner.slice(0, outputIdx)
  const afterOutput = inner.slice(outputIdx + '.output'.length)

  // afterOutput is either '' or starts with '.'
  const path = afterOutput.startsWith('.') ? afterOutput.slice(1) : ''

  return { nodeName, path }
}

/**
 * Extract all {{...}} template variables from a string.
 *
 * @param {string|null|undefined} template
 * @returns {Array<{ raw: string, nodeName: string, path: string }>}
 */
export function extractVariables(template) {
  if (!template) return []

  const results = []
  const regex = /\{\{([^}]+)\}\}/g
  let match

  while ((match = regex.exec(template)) !== null) {
    const raw = match[0]
    const inner = match[1]
    const parsed = parseInner(inner)
    if (parsed) {
      results.push({ raw, ...parsed })
    }
  }

  return results
}

/**
 * Traverse an object by a dot-notation path with optional array index support.
 *
 * @param {*} obj
 * @param {string} path  - e.g. "user.name" or "items[0]" or ""
 * @returns {*} resolved value or undefined
 */
export function resolvePath(obj, path) {
  if (obj === null || obj === undefined) return undefined
  if (path === '' || path === undefined) return obj

  // Split on dots, but keep bracket segments attached to their preceding key
  // e.g. "data.list[1]" -> ["data", "list[1]"]
  // We normalise bracket notation by converting "key[n]" -> ["key", n]
  const segments = []
  for (const part of path.split('.')) {
    const bracketMatch = part.match(/^([^\[]*)\[(\d+)\]$/)
    if (bracketMatch) {
      if (bracketMatch[1]) segments.push(bracketMatch[1])
      segments.push(Number(bracketMatch[2]))
    } else {
      segments.push(part)
    }
  }

  let current = obj
  for (const seg of segments) {
    if (current === null || current === undefined) return undefined
    current = current[seg]
  }
  return current
}

/**
 * Resolve all template variables in a string using node data.
 *
 * @param {string} template
 * @param {Array<{ id: string, data: { name: string, output?: string } }>} nodes
 * @returns {string}
 */
export function resolveTemplate(template, nodes) {
  if (!template) return template

  const variables = extractVariables(template)
  if (variables.length === 0) return template

  let result = template

  for (const { raw, nodeName, path } of variables) {
    const node = nodes.find(
      n => n.data?.name?.toLowerCase() === nodeName.toLowerCase()
    )

    // Node not found — leave token as-is
    if (!node) continue

    const output = node.data?.output

    // No output field on the node — leave token as-is
    if (output === undefined || output === null) continue

    let resolved

    if (path === '') {
      // No sub-path: use raw output string directly
      resolved = output
    } else {
      // Sub-path requested: output must be valid JSON
      let parsed
      try {
        parsed = JSON.parse(output)
      } catch {
        // Not valid JSON — leave token as-is
        continue
      }

      resolved = resolvePath(parsed, path)

      // Path didn't resolve — leave token as-is
      if (resolved === undefined) continue
    }

    // Stringify objects/arrays; coerce primitives with String()
    const stringified =
      typeof resolved === 'object' && resolved !== null
        ? JSON.stringify(resolved)
        : String(resolved)

    result = result.replace(raw, stringified)
  }

  return result
}

/**
 * Validate extracted variables against a node list.
 *
 * @param {Array<{ raw: string, nodeName: string, path: string }>} variables
 * @param {Array<{ id: string, data: { name: string } }>} nodes
 * @returns {Array<{ raw: string, nodeName: string, path: string, valid: boolean, reason?: string }>}
 */
export function validateVariables(variables, nodes) {
  return variables.map(variable => {
    const found = nodes.some(
      n => n.data?.name?.toLowerCase() === variable.nodeName.toLowerCase()
    )

    if (found) {
      return { ...variable, valid: true }
    }

    return {
      ...variable,
      valid: false,
      reason: `Node "${variable.nodeName}" not found`
    }
  })
}

/**
 * Extract all unique template variables from a node's config fields.
 *
 * Checks:
 *   - node.data.systemPrompt   (agent / orchestrator nodes)
 *   - node.data.serviceConfig.url and node.data.serviceConfig.headers (service nodes)
 *
 * @param {{ type?: string, data: object }} node
 * @returns {Array<{ raw: string, nodeName: string, path: string }>}
 */
export function extractNodeVariables(node) {
  const allVars = []
  const data = node?.data ?? {}

  // Agent / orchestrator nodes
  if (data.systemPrompt) {
    allVars.push(...extractVariables(data.systemPrompt))
  }

  // Service nodes
  if (data.serviceConfig) {
    const { url, headers } = data.serviceConfig

    if (url) {
      allVars.push(...extractVariables(url))
    }

    if (headers) {
      // headers can be an object; stringify it to scan all values
      const headersStr =
        typeof headers === 'string' ? headers : JSON.stringify(headers)
      allVars.push(...extractVariables(headersStr))
    }
  }

  // Deduplicate by raw string
  const seen = new Set()
  return allVars.filter(v => {
    if (seen.has(v.raw)) return false
    seen.add(v.raw)
    return true
  })
}
