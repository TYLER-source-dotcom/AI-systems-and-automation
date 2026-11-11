# Orbit AI workspace

A small, responsive AI chat app with OpenAI, Anthropic Claude, and Gemini streaming support. Provider keys stay on the server and are read from environment variables.

## Run

Requires Node.js 18 or newer. Set one provider key, then start the app:

```powershell
$env:OPENAI_API_KEY="your-key"
npm start
```

Open http://localhost:3000. Use `ANTHROPIC_API_KEY` or `GEMINI_API_KEY` for the other providers. Optional model overrides: `OPENAI_MODEL`, `ANTHROPIC_MODEL`, and `GEMINI_MODEL`. No dependencies to install.
