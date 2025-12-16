// backend/openaiClient.js
require('dotenv').config();
const OpenAI = require('openai');

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * sendChat: wraps the chat/completions call
 * messages: [{role: 'system'|'user'|'assistant', content: '...'}]
 * opts: {model, temperature, max_tokens}
 */
async function sendChat(messages, opts = {}) {
  const model = opts.model || 'gpt-4o-mini'; // change per your access/needs
  const temperature = typeof opts.temperature === 'number' ? opts.temperature : 0.2;
  const max_tokens = opts.max_tokens || 800;

  const res = await client.chat.completions.create({
    model,
    messages,
    temperature,
    max_tokens,
  });

  // standardize return
  const text = res?.choices?.[0]?.message?.content ?? '';
  return { raw: res, text };
}

module.exports = { sendChat, client };
