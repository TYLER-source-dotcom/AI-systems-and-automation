const form = document.querySelector('#chat-form');
const input = document.querySelector('#prompt');
const messages = document.querySelector('#messages');
const provider = document.querySelector('#provider');
const icon = document.querySelector('#provider-icon');
const send = document.querySelector('.send');
let history = [];

function addMessage(role, text, { typing = false, error = false } = {}) {
  const row = document.createElement('div'); row.className = `message ${role}`;
  const avatar = document.createElement('div'); avatar.className = 'message-avatar'; avatar.textContent = role === 'user' ? 'T' : '✳';
  const bubble = document.createElement('div'); bubble.className = `bubble${typing ? ' typing' : ''}${error ? ' error' : ''}`; bubble.textContent = text;
  row.append(avatar, bubble); messages.append(row); messages.scrollTop = messages.scrollHeight; return bubble;
}

async function submit(text) {
  const prompt = text.trim(); if (!prompt || send.disabled) return;
  document.querySelector('.welcome')?.remove();
  addMessage('user', prompt); history.push({ role: 'user', content: prompt }); input.value = ''; input.style.height = 'auto';
  send.disabled = true; const output = addMessage('assistant', '', { typing: true });
  try {
    const response = await fetch('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ provider: provider.value, messages: history }) });
    if (!response.ok) { const issue = await response.json(); throw new Error(issue.error || 'The request could not be completed.'); }
    const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = '', answer = '';
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      buffer += decoder.decode(value, { stream: true }); const events = buffer.split('\n\n'); buffer = events.pop() || '';
      for (const event of events) for (const line of event.split('\n')) if (line.startsWith('data:')) {
        const part = JSON.parse(line.slice(5).trim()).text; answer += part; output.textContent = answer; messages.scrollTop = messages.scrollHeight;
      }
    }
    output.classList.remove('typing'); if (answer) history.push({ role: 'assistant', content: answer });
  } catch (error) { output.classList.remove('typing'); output.classList.add('error'); output.textContent = error.message; }
  finally { send.disabled = false; input.focus(); }
}

form.addEventListener('submit', event => { event.preventDefault(); submit(input.value); });
input.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); form.requestSubmit(); } });
input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = `${Math.min(input.scrollHeight, 130)}px`; });
document.querySelectorAll('.suggestion').forEach(button => button.addEventListener('click', () => { input.value = button.textContent.trim().replace(/^[✦⌘↗]\s*/, ''); input.focus(); }));
provider.addEventListener('change', () => { icon.className = `provider-icon ${provider.value}`; icon.textContent = provider.value === 'openai' ? '✳' : provider.value === 'anthropic' ? 'A' : '✦'; history = []; });
document.querySelector('#clear-chat').addEventListener('click', () => { history = []; messages.innerHTML = document.querySelector('.welcome-template')?.innerHTML || `<div class="welcome"><div class="welcome-icon">✳</div><h2>What are we working on?</h2><p>Ask a question, explore an idea, or get help with your next big thing.</p><div class="suggestions"><button class="suggestion">✦ &nbsp;Help me write something</button><button class="suggestion">⌘ &nbsp;Explain a complex topic</button><button class="suggestion">↗ &nbsp;Brainstorm ideas</button></div></div>`; document.querySelectorAll('.suggestion').forEach(button => button.addEventListener('click', () => { input.value = button.textContent.trim().replace(/^[✦⌘↗]\s*/, ''); input.focus(); })); });
