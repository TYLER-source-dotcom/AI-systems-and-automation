import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 3000);
const configs = {
  openai: { key: 'OPENAI_API_KEY', url: 'https://api.openai.com/v1/chat/completions', model: process.env.OPENAI_MODEL || 'gpt-4o-mini' },
  anthropic: { key: 'ANTHROPIC_API_KEY', url: 'https://api.anthropic.com/v1/messages', model: process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-latest' },
  gemini: { key: 'GEMINI_API_KEY', url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', model: process.env.GEMINI_MODEL || 'gemini-2.0-flash' },
};

const server = http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/api/chat') {
    let body = '';
    for await (const chunk of req) body += chunk;
    try {
      const { provider, messages } = JSON.parse(body);
      const cfg = configs[provider];
      if (!cfg) return sendJson(res, 400, { error: 'Choose a supported provider.' });
      const key = process.env[cfg.key];
      if (!key) return sendJson(res, 400, { error: `Add ${cfg.key} to your environment, then restart the server.` });
      if (!Array.isArray(messages) || !messages.length) return sendJson(res, 400, { error: 'Enter a message to get started.' });

      const anthropic = provider === 'anthropic';
      const upstream = await fetch(cfg.url, {
        method: 'POST',
        headers: anthropic
          ? { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' }
          : { 'content-type': 'application/json', authorization: `Bearer ${key}` },
        body: JSON.stringify(anthropic
          ? { model: cfg.model, max_tokens: 1200, stream: true, messages }
          : { model: cfg.model, stream: true, messages }),
      });
      if (!upstream.ok) {
        const detail = await upstream.text();
        return sendJson(res, upstream.status, { error: detail.slice(0, 500) || 'The provider request failed.' });
      }
      res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache', connection: 'keep-alive' });
      const reader = upstream.body.getReader();
      const decoder = new TextDecoder();
      let pending = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        pending += decoder.decode(value, { stream: true });
        const lines = pending.split('\n'); pending = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (!data || data === '[DONE]') continue;
          try {
            const event = JSON.parse(data);
            const text = anthropic ? (event.type === 'content_block_delta' ? event.delta?.text : '') : event.choices?.[0]?.delta?.content;
            if (typeof text === 'string' && text) res.write(`data: ${JSON.stringify({ text })}\n\n`);
          } catch { /* Ignore provider events that are not JSON content deltas. */ }
        }
      }
      res.end();
    } catch (error) {
      if (!res.headersSent) sendJson(res, 500, { error: error.message || 'Unable to connect to the AI provider.' });
      else res.end();
    }
    return;
  }

  const requested = req.url === '/' ? '/index.html' : decodeURIComponent((req.url || '/').split('?')[0]);
  const file = path.resolve(root, `.${requested}`);
  if (!file.startsWith(root + path.sep)) return sendJson(res, 403, { error: 'Forbidden' });
  try {
    const data = await readFile(file);
    const type = file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'text/javascript' : 'text/html';
    res.writeHead(200, { 'content-type': `${type}; charset=utf-8` }); res.end(data);
  } catch { sendJson(res, 404, { error: 'Not found' }); }
});

function sendJson(res, status, value) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(value));
}

server.listen(port, () => console.log(`AI Orchestrator ready at http://localhost:${port}`));
