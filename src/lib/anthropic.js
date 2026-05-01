import Anthropic from '@anthropic-ai/sdk'

// Note: In production, API calls should go through your own backend.
// For local dev this calls the API directly from the browser.
const client = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true,
})

export default client
