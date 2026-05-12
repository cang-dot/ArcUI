# ArcUI Plugin Development Specification v1.0

## Table of Contents

1. [Overview](#overview)
2. [Plugin File Structure](#plugin-file-structure)
3. [plugin.json — Metadata & Config Schema](#pluginjson--metadata--config-schema)
4. [plugin.js — Frontend Logic](#pluginjs--frontend-logic)
5. [capability.py — Python Capabilities](#capabilitypy--python-capabilities)
6. [Sandbox Context API](#sandbox-context-api)
7. [Hooks Reference](#hooks-reference)
8. [Plugin Lifecycle](#plugin-lifecycle)
9. [Complete Example: TTS Plugin](#complete-example-tts-plugin)
10. [Best Practices](#best-practices)
11. [Publishing](#publishing)

---

## Overview

ArcUI plugins are self-contained folders inside `plugins/`. Each plugin extends ArcUI with:

- **Frontend UI & logic** — injected via hook registration into the chat interface
- **Python capabilities** — server-side processing executed by the ArcUI backend

Plugins do NOT run in a sandbox (prototype stage). Plugin developers are trusted — review plugin code before installing.

### Plugin Capabilities at a Glance

| Capability | Where | Example |
|-----------|-------|---------|
| Modify before sending | `plugin.js` hook `message.beforeSend` | Append context, transform query |
| React to responses | `plugin.js` hook `message.afterReceive` | Log analytics, trigger notifications |
| Inject UI elements | `plugin.js` hook `message.render` | Add audio bars, action buttons |
| Add message actions | `plugin.js` hook `message.action` | Speak, copy, translate buttons |
| Server-side processing | `capability.py` async function | TTS synthesis, image generation |
| Custom API calls | `context.fetch()` through proxy | Call third-party services |
| Configuration | `plugin.json` `configSchema` | User-editable settings in Settings panel |

---

## Plugin File Structure

Each plugin lives in its own folder:

```
plugins/{plugin-id}/
├── plugin.json       # Required: metadata + config schema
├── plugin.js         # Required: frontend class
└── capability.py     # Optional: Python functions
```

### Naming Convention

- `{plugin-id}` must be lowercase alphanumeric with hyphens: `arcui-tts`, `my-translator`, `code-runner`
- Start with a descriptive prefix (e.g. `arcui-` for official plugins)

---

## plugin.json — Metadata & Config Schema

### Complete Schema

```json
{
  "id": "arcui-tts",
  "name": "语音合成",
  "name_en": "TTS",
  "version": "1.0.0",
  "author": "ArcUI",
  "description": "将 AI 回复转为语音播放",
  "description_en": "Convert AI responses to speech",
  "hooks": ["message.action", "message.render"],
  "pythonCapabilities": ["tts_speak", "tts_fetch_voices"],
  "configSchema": [
    {
      "key": "apiEndpoint",
      "label": "TTS API 地址",
      "label_en": "TTS API Endpoint",
      "type": "text",
      "placeholder": "https://api.openai.com/v1/audio/speech",
      "required": false
    },
    {
      "key": "voice",
      "label": "语音",
      "label_en": "Voice",
      "type": "select",
      "options": [
        {"value": "alloy", "label": "Alloy"},
        {"value": "echo", "label": "Echo"}
      ],
      "default": "alloy"
    },
    {
      "key": "autoPlay",
      "label": "自动播放",
      "label_en": "Auto Play",
      "type": "toggle",
      "default": false
    }
  ]
}
```

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | ✅ | Unique plugin identifier |
| `name` | string | ✅ | Display name (Chinese) |
| `name_en` | string | ✅ | Display name (English) |
| `version` | string | ✅ | SemVer version |
| `author` | string | ✅ | Author name |
| `description` | string | ✅ | Short description (Chinese) |
| `description_en` | string | ✅ | Short description (English) |
| `hooks` | string[] | ❌ | Hook names this plugin registers for |
| `pythonCapabilities` | string[] | ❌ | Python function names exposed by `capability.py` |
| `configSchema` | object[] | ❌ | User-configurable settings |

### configSchema Item Types

| `type` | Renders as | Extra fields |
|--------|-----------|-------------|
| `"text"` | Text input | `placeholder`, `required` |
| `"select"` | Dropdown | `options: [{value, label}]`, `default` |
| `"toggle"` | On/off switch | `default` (boolean) |
| `"number"` | Number input | `min`, `max`, `default` |

---

## plugin.js — Frontend Logic

### Class Contract

Every `plugin.js` must export a class with this structure:

```javascript
class PluginClass {
  // Static metadata (mirrors plugin.json)
  static meta = {
    id: 'arcui-tts',
    name: 'TTS',
    version: '1.0.0',
  };

  // Constructor receives sandbox context
  constructor(context) {
    this.context = context;
  }

  // Initialize: called once after construction, receives user config
  async init(config) {
    // config = merged values from plugin.json configSchema defaults + user overrides
    this.config = config;
  }

  // Register hooks with the PluginManager
  registerHooks(registry) {
    // registry.on('hook-name', callback)
  }

  // Cleanup when plugin is disabled or unloaded
  destroy() {
    // Remove DOM elements, listeners, etc.
  }
}
```

### Minimal Example

```javascript
class MinimalPlugin {
  static meta = { id: 'my-plugin', name: 'My Plugin', version: '1.0.0' };

  constructor(context) { this.ctx = context; }
  async init(config) { this.config = config; }
  registerHooks(registry) {
    registry.on('message.afterReceive', (data) => {
      console.log('Received:', data.response);
    });
  }
  destroy() {}
}
```

---

## capability.py — Python Capabilities

### Rules

1. **All top-level `async` functions NOT starting with `_`** are automatically exposed as capabilities.
2. Function signatures can include `api_key` — it is automatically injected by the engine from global config.
3. Return values are JSON-serialized and sent back to the frontend.
4. Raise exceptions for errors — they are caught and returned as `{error: "message"}`.

### Example

```python
# capability.py
import aiohttp

async def tts_speak(text: str, voice: str, api_key: str = "") -> dict:
    """
    Call TTS API and return base64 audio.
    api_key is auto-injected from ArcUI config.
    """
    if not api_key:
        raise ValueError("API key not configured")

    async with aiohttp.ClientSession() as session:
        async with session.post(
            "https://api.openai.com/v1/audio/speech",
            headers={"Authorization": f"Bearer {api_key}"},
            json={
                "model": "tts-1",
                "input": text,
                "voice": voice,
                "response_format": "mp3",
            },
        ) as resp:
            audio_bytes = await resp.read()
            import base64
            return {"audio_base64": base64.b64encode(audio_bytes).decode(), "format": "mp3"}


async def tts_fetch_voices(api_key: str = "") -> dict:
    """Return available voices. Static list for OpenAI TTS."""
    return {
        "voices": [
            {"id": "alloy", "name": "Alloy"},
            {"id": "echo", "name": "Echo"},
            {"id": "fable", "name": "Fable"},
            {"id": "onyx", "name": "Onyx"},
            {"id": "nova", "name": "Nova"},
            {"id": "shimmer", "name": "Shimmer"},
        ]
    }
```

### Calling from plugin.js

```javascript
// In plugin.js, using the sandbox context:
const result = await this.context.callPython('tts_speak', {
  text: 'Hello world',
  voice: 'alloy',
});
// result = { audio_base64: "...", format: "mp3" }
```

---

## Sandbox Context API

The `context` object passed to the plugin constructor provides:

### `context.fetch(url, options?)`

Proxy an HTTP request through the ArcUI backend. Returns a standard `Response` object.

```javascript
const response = await this.context.fetch('https://api.example.com/data', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ key: 'value' }),
});
const data = await response.json();
```

**Why proxy?** Avoids CORS issues and keeps API keys server-side. All requests route through `POST /api/proxy` on the ArcUI backend.

### `context.callPython(capability, params)`

Execute a Python capability function from `capability.py`.

```javascript
const result = await this.context.callPython('tts_speak', {
  text: 'Some text to speak',
  voice: 'alloy',
});
// result is the JSON return value of the Python function
```

### `context.audio`

Audio playback utilities:

```javascript
// Play from base64-encoded audio
this.context.audio.playFromBase64('base64string...');

// Play from a Blob
this.context.audio.playBlob(audioBlob);

// Use browser speech synthesis
this.context.audio.speakBrowser('Text to speak');
```

### `context.storage`

Plugin-scoped persistent storage (localStorage):

```javascript
this.context.storage.set('myKey', { some: 'data' });
const value = this.context.storage.get('myKey'); // { some: 'data' }
this.context.storage.remove('myKey');
```

Keys are scoped per-plugin (prefixed with plugin ID), so `storage.set('x', 1)` in plugin A won't collide with plugin B.

### `context.notify(message, type?)`

Show a toast notification:

```javascript
this.context.notify('Operation completed');          // neutral
this.context.notify('Something went wrong', 'error'); // error
```

### `context.getLanguage()`

Returns the current UI language: `'zh'` or `'en'`.

### `context.getConfig()`

Returns the global ArcUI config object (Base URL, API key, etc.). **Note:** API key is masked.

### `context.on(event, callback)` / `context.emit(event, data)`

Plugin-to-plugin messaging:

```javascript
// Plugin A emits
this.context.emit('custom-event', { value: 42 });

// Plugin B listens
this.context.on('custom-event', (data) => {
  console.log(data.value); // 42
});
```

---

## Hooks Reference

All hooks are registered via `registry.on(hookName, callback)` inside `registerHooks()`.

### `message.beforeSend`

**Trigger:** Just before a user message is sent to the LLM.

**Callback signature:** `function(data) → modifiedMessages`

```javascript
// data = { query: string, messages: array, config: object }
// Must return the (possibly modified) messages array

registry.on('message.beforeSend', (data) => {
  // Prepend additional context
  data.messages.unshift({
    role: 'system',
    content: 'Extra context from plugin',
  });
  return data.messages;
});
```

### `message.afterReceive`

**Trigger:** After a full response is received from the LLM.

**Callback signature:** `function(data) → void`

```javascript
// data = { response: string, rawData: object, isFactARC: boolean }

registry.on('message.afterReceive', (data) => {
  // Log analytics
  console.log('Response length:', data.response.length);
  // Trigger custom processing
  this.context.emit('response-ready', data);
});
```

### `message.render`

**Trigger:** When a message DOM element is created/updated.

**Callback signature:** `function(message, domElement) → void`

```javascript
// message = { role, content, timestamp, ... }
// domElement = the <div class="message"> element

registry.on('message.render', (message, domElement) => {
  if (message.role === 'assistant') {
    // Inject custom UI at the bottom
    const button = document.createElement('button');
    button.textContent = 'Custom Action';
    domElement.querySelector('.message-content').appendChild(button);
  }
});
```

### `message.action`

**Trigger:** When building the action button list for a message.

**Callback signature:** `function(message, actions[]) → actions[]`

```javascript
// actions = [{ id, label, label_en, onClick }]

registry.on('message.action', (message, actions) => {
  if (message.role === 'assistant') {
    actions.push({
      id: 'tts-speak',
      label: '语音播放',
      label_en: 'Speak',
      onClick: () => this.speak(message.content),
    });
  }
  return actions;
});
```

### `chat.header`

**Trigger:** When a chat header is rendered.

**Callback signature:** `function(chatInfo) → void`

```javascript
// chatInfo = { id, title, timestamp }

registry.on('chat.header', (chatInfo) => {
  // Add status indicator to chat header
});
```

### `sidebar.item`

**Trigger:** When a sidebar conversation item is rendered.

**Callback signature:** `function(chatItem) → void`

```javascript
// chatItem = { id, title, timestamp, domElement }

registry.on('sidebar.item', (chatItem) => {
  // Add a badge to certain conversations
});
```

### `api.provider`

**Trigger:** During API provider registration.

**Callback signature:** `function(providers[]) → providers[]`

```javascript
// providers = [{ name, baseUrl }]

registry.on('api.provider', (providers) => {
  providers.push({ name: 'My Provider', baseUrl: 'https://my.api.com/v1' });
  return providers;
});
```

---

## Plugin Lifecycle

```
  Plugin folder detected
         │
         ▼
  plugin.json parsed
         │
         ▼
  configSchema defaults loaded
  user overrides merged
         │
         ▼
  NEW PluginClass(context)
         │
         ▼
  await plugin.init(config)
         │
         ▼
  plugin.registerHooks(registry)
         │
         ▼
  [ Plugin is ACTIVE — hooks fire on events ]
         │
         ▼
  User disables / unloads plugin
         │
         ▼
  plugin.destroy()
         │
         ▼
  Plugin removed
```

### Enabling/Disabling

Users manage plugins in **Settings → Plugins**:
- Toggle on/off
- Configure settings (form generated from `configSchema`)
- Manually install by pasting a plugin folder

---

## Complete Example: TTS Plugin

### plugins/tts/plugin.json

```json
{
  "id": "arcui-tts",
  "name": "语音合成",
  "name_en": "TTS",
  "version": "1.0.0",
  "author": "ArcUI",
  "description": "将 AI 回复转为语音播放",
  "description_en": "Convert AI responses to speech",
  "hooks": ["message.action", "message.render"],
  "pythonCapabilities": ["tts_speak", "tts_fetch_voices"],
  "configSchema": [
    {
      "key": "apiEndpoint",
      "label": "TTS API 地址",
      "label_en": "TTS API Endpoint",
      "type": "text",
      "placeholder": "https://api.openai.com/v1/audio/speech",
      "required": false
    },
    {
      "key": "voice",
      "label": "语音",
      "label_en": "Voice",
      "type": "select",
      "options": [
        {"value": "alloy", "label": "Alloy"},
        {"value": "echo", "label": "Echo"}
      ],
      "default": "alloy"
    },
    {
      "key": "autoPlay",
      "label": "自动播放",
      "label_en": "Auto Play",
      "type": "toggle",
      "default": false
    }
  ]
}
```

### plugins/tts/plugin.js

```javascript
class TTSPlugin {
  static meta = { id: 'arcui-tts', name: 'TTS', version: '1.0.0' };

  constructor(context) {
    this.ctx = context;
    this.audioEl = null;
  }

  async init(config) {
    this.config = config;
  }

  registerHooks(registry) {
    // Add "Speak" button to each assistant message
    registry.on('message.action', (message, actions) => {
      if (message.role === 'assistant' && message.content) {
        actions.push({
          id: 'tts-speak',
          label: '播放',
          label_en: 'Speak',
          onClick: () => this.speak(message.content),
        });
      }
      return actions;
    });

    // Inject audio progress bar
    registry.on('message.render', (message, domElement) => {
      if (message.role === 'assistant') {
        this.injectAudioBar(domElement);
      }
    });

    // Auto-play if enabled
    registry.on('message.afterReceive', async (data) => {
      if (this.config.autoPlay) {
        await this.speak(data.response);
      }
    });
  }

  async speak(text) {
    const lang = this.ctx.getLanguage();
    try {
      if (this.config.apiEndpoint) {
        // Use TTS API through Python capability
        const result = await this.ctx.callPython('tts_speak', {
          text,
          voice: this.config.voice || 'alloy',
        });
        if (result.audio_base64) {
          this.ctx.audio.playFromBase64(result.audio_base64);
          return;
        }
      }
    } catch (e) {
      this.ctx.notify('TTS API failed, using browser engine', 'error');
    }
    // Fallback to browser speech
    this.ctx.audio.speakBrowser(text);
  }

  injectAudioBar(domElement) {
    const bar = document.createElement('div');
    bar.className = 'audio-bar';
    bar.innerHTML = '<button>▶ Play</button><div class="progress"></div><span>0:00</span>';
    domElement.appendChild(bar);
  }

  destroy() {
    // Clean up audio elements
  }
}
```

### plugins/tts/capability.py

```python
"""TTS capabilities for ArcUI TTS plugin."""
import aiohttp
import base64


async def tts_speak(text: str, voice: str = "alloy", api_key: str = "") -> dict:
    """Generate speech audio via OpenAI TTS API."""
    if not api_key:
        raise ValueError("API key not configured")

    async with aiohttp.ClientSession() as session:
        async with session.post(
            "https://api.openai.com/v1/audio/speech",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": "tts-1",
                "input": text,
                "voice": voice,
                "response_format": "mp3",
            },
        ) as resp:
            if resp.status != 200:
                error = await resp.text()
                raise Exception(f"TTS API error: {error}")
            audio_bytes = await resp.read()
            return {
                "audio_base64": base64.b64encode(audio_bytes).decode("utf-8"),
                "format": "mp3",
            }


async def tts_fetch_voices(api_key: str = "") -> dict:
    """Return available TTS voices."""
    return {
        "voices": [
            {"id": "alloy", "name": "Alloy"},
            {"id": "echo", "name": "Echo"},
            {"id": "fable", "name": "Fable"},
            {"id": "onyx", "name": "Onyx"},
            {"id": "nova", "name": "Nova"},
            {"id": "shimmer", "name": "Shimmer"},
        ]
    }
```

---

## Best Practices

### 1. Namespace your IDs
Use a unique prefix: `arcui-`, `mycompany-`, etc.

### 2. Always implement `destroy()`
Clean up DOM elements, event listeners, timers, and audio objects to prevent memory leaks.

### 3. Keep plugin.js small
Offload heavy processing to `capability.py` via `context.callPython()`.

### 4. Handle errors gracefully
```javascript
async speak(text) {
  try {
    const result = await this.ctx.callPython('tts_speak', { text });
    // ...
  } catch (e) {
    this.ctx.notify('Playback failed: ' + e.message, 'error');
  }
}
```

### 5. Respect language
Use `context.getLanguage()` to localize UI text:

```javascript
const label = this.ctx.getLanguage() === 'zh' ? '播放' : 'Play';
```

### 6. Use CSS variables
If your plugin injects DOM elements with styles, use ArcUI CSS variables for theme consistency:

```css
.my-plugin-button {
  background: var(--bg-elevated);
  color: var(--text-primary);
  border: 1px solid var(--border-default);
}
```

### 7. Test with and without Fact-ARC
Your plugin should work whether or not a Fact-ARC backend is detected.

### 8. Document your configSchema
Each config field should have clear `label` and `label_en`.

---

## Publishing

### For personal use
Drop the plugin folder into `ArcUI/plugins/`. It auto-loads on refresh.

### For sharing
1. Zip your plugin folder
2. Share the zip — users extract into `plugins/`
3. Users enable via Settings → Plugins

### Future: Plugin Registry
A remote plugin registry is planned for a future version where plugins can be installed from a URL.

---

## Appendix: `window.ArcUI` Quick Reference

Plugins can also access the global `window.ArcUI` namespace directly (though the context API is preferred):

```javascript
window.ArcUI.state            // Global state
window.ArcUI.i18n.t(key)      // Translate
window.ArcUI.utils.showToast(msg, type)  // Toast notification
window.ArcUI.utils.generateId()          // Unique ID
window.ArcUI.utils.scrollToBottom()      // Scroll chat
```

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-05 | Initial specification |
