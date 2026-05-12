# ArcUI User Guide

## Table of Contents

1. [Getting Started](#getting-started)
2. [Interface Overview](#interface-overview)
3. [Chatting](#chatting)
4. [Multimodal (Images & Audio)](#multimodal-images--audio)
5. [Settings](#settings)
6. [Model Switching](#model-switching)
7. [System Prompts](#system-prompts)
8. [TTS (Text-to-Speech)](#tts-text-to-speech)
9. [Verification Trails (Fact-ARC)](#verification-trails-fact-arc)
10. [Keyboard Shortcuts](#keyboard-shortcuts)
11. [Theme & Language](#theme--language)
12. [Troubleshooting](#troubleshooting)

---

## Getting Started

### Prerequisites

- An API key for an OpenAI-compatible LLM service (e.g. OpenAI, DeepSeek, etc.)
- Python 3.9+ with `pip`

### Setup

1. **Install dependencies**
   ```bash
   cd ArcUI/backend
   pip install -r requirements.txt
   ```

2. **Start the backend**
   ```bash
   python server.py
   ```
   The ArcUI backend runs at `http://localhost:1011`.

3. **Open the frontend**
   Open `index.html` in your browser. Chrome, Edge, or Firefox recommended.

4. **Configure your API**
   - The first launch shows a setup screen.
   - Enter your **Base URL** (e.g. `https://api.openai.com/v1` or `https://api.deepseek.com/v1`).
   - Enter your **API Key**.
   - Click **Test Connection** to verify, then **Save**.

5. **Start chatting**
   The input area appears once configuration is saved. Pick a model from the dropdown and type your first message.

---

## Interface Overview

```
┌─────────────────────────────────────────────────┐
│  [☰]  ArcUI      AI 对话前端      [EN] [◐] [⚙] │ ← Topbar
├──────────┬──────────────────────────────────────┤
│          │                                      │
│ Sidebar  │        Chat Messages                 │
│          │                                      │
│ [+ 新对话]│  ┌─────────────────────────┐        │
│          │  │ User message bubble     │        │
│ [搜索...]│  └─────────────────────────┘        │
│          │  ┌─────────────────────────┐        │
│ 对话1    │  │ Assistant message       │        │
│ 对话2    │  │ with markdown, trails   │        │
│ 对话3    │  │ [▶ Play] [━━━━] 0:32    │        │
│          │  └─────────────────────────┘        │
│          ├──────────────────────────────────────┤
│          │ [📎 preview1] [preview2]             │
│          │ [_____________________] [↑] [■]     │
│          │ 纠错轮次[3▾] 模型[deepseek▾] Ctrl+N  │
└──────────┴──────────────────────────────────────┘
```

### Topbar
- **☰ (hamburger)** — toggle sidebar visibility
- **ArcUI** — app brand
- **EN/中文** — toggle language
- **◐** — toggle dark/light theme
- **⚙** — open settings

### Sidebar
- **+ 新对话** — start a fresh conversation
- **Search** — filter conversations by title / content
- **Conversation list** — click to switch; highlighted = current

### Main Area
- **Messages** — scrollable chat history
- **Input area** — text input with multimodal toolbar above
- **Model dropdown** — switch models on the fly
- **Correction rounds** — number of self-correction passes (for backends that support it)

---

## Chatting

### Sending a message
- Type in the input box, press **Enter** (or click the **↑** button).
- Use **Shift+Enter** for a newline within your message.
- The send button is disabled while a response is being generated.

### Streaming
- Responses stream in real time with a typewriter effect.
- A blinking cursor appears at the end of the stream.
- Click **■ (Stop)** to abort mid-generation.

### Code blocks
- Code blocks are syntax-highlighted and have a dark background.
- While streaming, unclosed code blocks render as plain text first, then format when the block closes.

### Actions per message
Each assistant message shows action buttons below it when available:
- **TTS Speak** — read the message aloud

---

## Multimodal (Images & Audio)

### How it works
ArcUI auto-detects whether the selected model supports vision and/or audio. When the model supports images, the multimodal toolbar appears above the input.

### Uploading images
- **Click 📎** — opens the file picker
- **Drag & drop** — drag images onto the chat area
- **Paste from clipboard** — Ctrl+V with an image on the clipboard

### Managing attachments
- Thumbnails appear in the toolbar above the input.
- Click a thumbnail to **remove** it.
- All attachments are sent with your next message.

### Image processing
- Images are resized to max 2048px width before sending (handled by the backend).
- Sent as `content` arrays: `[{type:"image_url", image_url:{url:"data:image/..."}}, {type:"text", text:"..."}]`

### Audio (placeholder)
Audio recording is reserved for future versions.

---

## Settings

Open settings via the ⚙ button in the topbar.

### API Configuration
| Field | Description |
|-------|-------------|
| **Base URL** | Your LLM API endpoint (e.g. `https://api.openai.com/v1`) |
| **API Key** | Your secret key. Stored in localStorage; never sent to third parties |
| **ArcUI Backend URL** | Defaults to `http://localhost:1011`. Change if you deploy the backend elsewhere |

- Click **Test Connection** to verify the API responds.
- Click **Save** to persist.

### System Prompt
Customize the system prompt sent to the model. Leave empty to use the default (a helpful assistant in your current language).

**Available variables:**
- `{{model}}` — replaced with the current model name
- `{{date}}` — replaced with today's date (YYYY-MM-DD)
- `{{user_name}}` — replaced with your configured name ("User" by default)

Click **恢复默认** to reset to the default prompt.

### TTS Settings
| Field | Description |
|-------|-------------|
| **TTS API Endpoint** | The TTS API URL. Defaults to OpenAI TTS if left empty |
| **Voice** | Voice selection (Alloy, Echo, Fable, Onyx, Nova, Shimmer) |
| **Auto Play** | Automatically speak assistant responses |

If no TTS API is configured, ArcUI falls back to the browser's built-in speech synthesis.

### Appearance
- **Theme** — Dark or Light
- **Language** — 中文 or English

Both are persisted and restored on next visit.

### Danger Zone
- **Clear All** — removes all saved config, chat history, and system prompts. Use with caution.

---

## Model Switching

The model dropdown sits below the chat input. After saving your API config:

1. ArcUI fetches available models from your API's `/models` endpoint.
2. The dropdown populates automatically.
3. Select any model to switch.
4. Multimodal capabilities are re-detected for the new model.

If the model list fails to load, you can still type a model name manually in the dropdown.

---

## System Prompts

### Default prompts

| Language | Default |
|----------|---------|
| Chinese | 你是一个知识渊博、乐于助人的AI助手。请用中文回答用户的问题。回答应准确、清晰、有条理。 |
| English | You are a knowledgeable and helpful AI assistant. Provide accurate, clear, and well-structured responses. |

### Custom prompt flow
1. Edit in **Settings → System Prompt**
2. Click **Save** (or **Save Prompt**)
3. Sent as the `system` role message with every request

---

## TTS (Text-to-Speech)

### Audio bar
Every assistant message includes an audio bar at the bottom:

```
[▶ Play] [━━━━━━━━━━] 0:32
```

- **▶ Play** — play the message as speech
- **Progress bar** — visual playback progress
- **Duration** — estimated reading time

### Playback priority
1. Configured TTS API (OpenAI TTS or compatible)
2. Browser's `window.speechSynthesis` fallback

### Languages
The browser engine automatically detects and speaks in the appropriate language based on the content.

---

## Verification Trails (Fact-ARC)

When ArcUI detects a [Fact-ARC](https://github.com/cang-dot/Fact-ARC) backend:

1. A token is obtained from `/api/identity`.
2. All requests carry `X-FactARC-Token` header.
3. Responses may include `verification_trail` data.
4. Verification trails appear below assistant messages as expandable sections showing fact-checking steps and sources.

If no Fact-ARC backend is detected, all features work normally — just without trails.

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Enter` | Send message |
| `Shift+Enter` | New line in message |
| `Ctrl+N` | New conversation |
| `Escape` | Close sidebar / close settings |

---

## Theme & Language

- Toggle from the topbar or Settings → Appearance.
- Settings are persisted in `localStorage`.
- Dark theme is the default.

---

## Troubleshooting

### "请先配置 API" (Configure API first)
Open Settings → fill in Base URL and API Key → Save.

### No models appear in the dropdown
- Verify your Base URL is correct.
- Click **Test Connection** to confirm.
- Ensure your API key has access to list models (`/models` endpoint).

### Streaming stops or freezes
- Click **■ (Stop)** to abort, then try again.
- Check your network connection.
- Some proxies may buffer SSE; try connecting directly.

### Images don't upload
- Ensure the selected model supports vision (check the model name contains `vision`, `vl`, `gpt-4o`, etc.).
- The multimodal toolbar only appears for vision-capable models.
- Supported formats: JPEG, PNG, WebP, GIF.

### TTS doesn't work
- Without an API endpoint, ArcUI uses the browser engine.
- Chrome/Edge have the best speech synthesis support.
- Firefox / Safari may have limited voice options.

### Backend won't start
- Ensure Python 3.9+ is installed: `python --version`
- Install dependencies: `pip install -r requirements.txt`
- Check port 1011 is not in use: `netstat -ano | findstr 1011`

---

## Support

- **Fact-ARC project**: [github.com/cang-dot/Fact-ARC](https://github.com/cang-dot/Fact-ARC)
- **ArcUI** is part of the Fact-ARC ecosystem
