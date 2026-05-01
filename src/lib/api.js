import Anthropic from '@anthropic-ai/sdk'

export const MODEL = 'claude-sonnet-4-6'

export function createClient(apiKey) {
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
}

export async function sendMessage(client, system, messages) {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system,
    messages,
  })
  return response.content[0].text
}

export function parseJSON(raw) {
  const cleaned = raw.replace(/^```(?:json)?\s*/m, '').replace(/\s*```$/m, '').trim()
  return JSON.parse(cleaned)
}
