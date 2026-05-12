<p align="center">
  <img src="images/logo.png" alt="ArcUI" width="120">
</p>

# ArcUI — Universal AI Chat Frontend

> A standalone, plugin-extensible AI conversation frontend. Connect any OpenAI-format API, and it just works.

ArcUI automatically detects [Fact-ARC](https://github.com/ZhouYvChongShan/Fact-ARC) backends to display real-time verification trails and fact sources — turning AI chat from blind trust into verifiable confidence.

---

## Features

### Chat & Interaction
- **Standalone** — connect any OpenAI-compatible API (OpenAI, DeepSeek, Claude, etc.)
- **Streaming SSE** — typewriter rendering with throttled DOM updates, stop anytime
- **Native multimodal** — image upload (drag & drop / paste / file picker), audio recording (auto-enabled per model)
- **Model dropdown** — live model switching below the input, auto-fetches from API
- **Editable system prompt** — with `{{model}}`, `{{date}}`, `{{user_name}}` variables
- **Correction Engine** — LLM self-review & iterative correction loop (configurable rounds & threshold)

### Fact-ARC Integration
- **Auto-detect** Fact-ARC backend via `/health` identity check
- **X-FactARC-Token** header on every request
- **Verification trails** — expandable per-message fact-checking steps with source citations
- **Fallback gracefully** — works fully without Fact-ARC, enhanced when present

### Plugin Ecosystem
- Each plugin: `plugin.json` + `plugin.js` + optional `capability.py`
- 7 hook points: `message.beforeSend`, `message.afterReceive`, `message.render`, `message.action`, `chat.header`, `sidebar.item`, `api.provider`
- Sandbox context API: `fetch()`, `callPython()`, `audio`, `storage`, `notify`, `i18n`, inter-plugin events
- Built-in plugins: **TTS** (OpenAI API + browser speech fallback), **Fact-ARC Integration**

### UI & UX
- **Monochrome aesthetic** — black/white/gray, no icon fonts (except hamburger SVG)
- **i18n** — Chinese / English one-click toggle, persisted
- **Dark / Light theme** — persists to localStorage, respects `prefers-color-scheme`
- **Chat history sidebar** — search, switch, new conversation
- **Keyboard shortcuts** — `Enter` send, `Shift+Enter` newline, `Ctrl+N` new chat, `Esc` close sidebar
- **`prefers-reduced-motion`** supported

### Technical
- **Zero frameworks** — vanilla HTML + CSS + JS, no build step
- **CSS variables** — all colors themable, no hard-coded values
- **`window.ArcUI` namespace** — all modules communicate through a shared global
- **localStorage persistence** — config, theme, language, chat history, system prompt
- **Backward compatible** — every feature works without Fact-ARC

---

## Quick Start

### 1. Install backend dependencies

```bash
cd ArcUI/backend
pip install -r requirements.txt
```

### 2. Start the backend

```bash
python server.py
```

The ArcUI backend runs at `http://localhost:1011`.

### 3. Open the frontend

Open `index.html` in your browser (Chrome / Edge / Firefox recommended).

1. Click **Settings** (⚙) in the top bar.
2. Enter your **Base URL** (e.g. `https://api.openai.com/v1` or `https://api.deepseek.com/v1`) and **API Key**.
3. Click **Save**. The model dropdown populates automatically.
4. Start chatting.

> **Windows users**: double-click `RUN-ArcUI.bat` to auto-install deps and start both backend & frontend.

---

## Project Structure

```
ArcUI/
├── index.html                     # Entry: topbar + sidebar + chat + settings
├── css/ (6 files)
│   ├── base.css                   # CSS variables (dark/light), reset, animations
│   ├── components.css             # Buttons, inputs, selects, toggles, toasts
│   ├── layout.css                 # Topbar, sidebar, main area, responsive
│   ├── chat.css                   # Message bubbles, trails, audio bars
│   ├── settings.css               # Settings panel, prompt editor, ad card
│   └── plugins.css                # Plugin management panel
├── js/ (17 files)
│   ├── init.js                    # Bootstrap (loaded first)
│   ├── app.js                     # Entry: global state, init, DOM wiring
│   ├── i18n.js                    # Chinese/English dictionaries, t()
│   ├── theme.js                   # Dark/light theme toggle
│   ├── sidebar.js                 # Chat history sidebar
│   ├── chat.js                    # Send/receive messages, rendering
│   ├── stream.js                  # SSE streaming, typewriter render
│   ├── markdown.js                # Markdown via marked.js CDN
│   ├── api.js                     # API calls (non-stream, stream, models)
│   ├── identity.js                # Fact-ARC backend detection
│   ├── multimodal.js              # Image upload/preview/drag-drop/paste
│   ├── system-prompt.js           # System prompt editor logic
│   ├── model-selector.js          # Model dropdown
│   ├── settings.js                # Settings panel logic
│   ├── tts.js                     # TTS audio bar component
│   ├── correction.js              # Self-correction engine
│   └── plugins.js                 # Plugin runtime (PluginManager)
├── plugins/
│   ├── arcui-tts/                 # TTS plugin
│   │   ├── plugin.json
│   │   ├── plugin.js
│   │   └── capability.py
│   └── arcui-factarc/             # Fact-ARC integration plugin
│       ├── plugin.json
│       └── plugin.js
├── backend/
│   ├── server.py                  # FastAPI entry (port 1011)
│   ├── proxy.py                   # API proxy + SSE streaming
│   ├── plugin_engine.py           # Python capability executor
│   ├── multimodal_handler.py      # Image/audio processing
│   ├── models.py                  # Pydantic models
│   └── requirements.txt           # Python dependencies
├── 手册-ZH/                       # Chinese documentation
├── PLUGIN_SPEC.md                 # Plugin development specification v1.0
├── USER_GUIDE.md                  # User guide
├── RUN-ArcUI.bat                  # Windows one-click launcher
└── README.md
```

---

## Backend API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check; returns `has_identity` for Fact-ARC detection |
| `/api/proxy` | POST | Generic API proxy (non-streaming) |
| `/api/proxy/stream` | POST | SSE streaming proxy |
| `/api/proxy/models` | POST | Proxy model list fetch |
| `/api/plugin/{plugin_id}/{capability}` | POST | Execute a plugin Python capability |
| `/api/plugins` | GET | List all loaded plugins |
| `/api/multimodal/image-to-base64` | POST | Resize & re-encode an image |
| `/api/multimodal/transcribe` | POST | Audio transcription (placeholder) |

---

## Fact-ARC Integration

ArcUI is the official frontend companion for [Fact-ARC](https://github.com/ZhouYvChongShan/Fact-ARC) — a fact-based auto-regressive correction system that fights AI hallucinations.

### How it works

```
User Query → LLM → Answer

                  ↓
        Fact-ARC Verification
    ┌─────────────────────────┐
    │ 1. Extract keywords     │
    │ 2. Bocha API search     │
    │ 3. Verifier LLM checks  │
    │ 4. Confidence ≥ 90%?    │
    └─────────────────────────┘
           ↓          ↓
        Pass?       Fail?
      Display    Auto-correct
      sources    & re-verify
```

When connected:
1. ArcUI detects the Fact-ARC backend and obtains an identity token
2. All requests carry `X-FactARC-Token` header
3. Responses include `verification_trail` data
4. Expandable per-message verification trails show fact-checking steps, confidence scores, and source links

---

## Plugin Development

ArcUI has a full plugin system. See [PLUGIN_SPEC.md](PLUGIN_SPEC.md) for the complete specification.

```javascript
class MyPlugin {
  static meta = { id: 'my-plugin', name: 'My Plugin', version: '1.0.0' };

  constructor(context) { this.ctx = context; }
  async init(config) { this.config = config; }

  registerHooks(registry) {
    registry.on('message.action', (message, actions) => {
      actions.push({
        id: 'custom-action',
        label: 'Custom',
        label_en: 'Custom',
        onClick: () => this.doSomething(message.content),
      });
      return actions;
    });
  }

  destroy() {}
}
```

---

## Design Principles

1. **All colors via CSS variables** — no hard-coded color values
2. **No icon fonts / emoji as UI** — except for the 🙏 in the promotional card
3. **No CSS/JS frameworks** — vanilla HTML + CSS + JS only
4. **Markdown via marked.js CDN** — no bundled dependency
5. **`window.ArcUI` namespace** — all modules communicate through a shared global
6. **localStorage persistence** — config, theme, language, chat history, system prompt
7. **`prefers-reduced-motion`** supported
8. **Code comments in English**; user-facing text via `t()` with zh/en
9. **Backward compatible** — works fully without Fact-ARC
10. **Plugin Python files are NOT sandboxed** (prototype stage; security risk acknowledged)

---

## License

MIT
