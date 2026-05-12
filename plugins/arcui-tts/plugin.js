/* ArcUI - plugins/tts/plugin.js */
/* TTS Plugin: hook registration, audio bar injection, playback control */

class Plugin {
  static meta = {
    id: 'arcui-tts',
    name: 'TTS',
    version: '1.0.0',
  };

  constructor(context) {
    this.context = context;
    this.config = {};
  }

  async init(config) {
    this.config = { ...config };

    // If auto-play is enabled and we have an API endpoint, verify it works
    if (this.config.autoPlay && this.config.apiEndpoint) {
      try {
        // Quick validation: try to fetch voices
        await this.context.callPython('tts_fetch_voices', {});
      } catch (e) {
        console.warn('[TTS Plugin] API endpoint validation failed:', e.message);
        this.context.notify(this.context.getLanguage() === 'en' ? 'TTS API check failed' : 'TTS API 检测失败', 'error');
      }
    }
  }

  registerHooks(registry) {
    // Hook: message.render — inject audio bar into assistant messages
    registry.on('message.render', (params) => {
      const { message, domElement } = params;
      if (!message || message.role !== 'assistant') return;
      if (!message.content) return;

      // Check if audio bar already exists
      if (domElement.querySelector('.audio-bar')) return;

      // Create audio bar
      const contentText = typeof message.content === 'string'
        ? message.content
        : (Array.isArray(message.content)
          ? message.content.filter(c => c.type === 'text').map(c => c.text).join('\n')
          : '');

      if (!contentText.trim()) return;

      const audioBar = this._createAudioBar(contentText);
      const contentEl = domElement.querySelector('.message-content');
      if (contentEl) {
        contentEl.insertAdjacentHTML('afterend', audioBar);
      }
    });

    // Hook: message.action — add "Speak" action button to assistant messages
    registry.on('message.action', (params) => {
      const { message, actions } = params;
      if (!message || message.role !== 'assistant') return;

      const contentText = typeof message.content === 'string'
        ? message.content
        : (Array.isArray(message.content)
          ? message.content.filter(c => c.type === 'text').map(c => c.text).join('\n')
          : '');

      if (!contentText.trim()) return;

      const lang = this.context.getLanguage();
      actions.push({
        id: 'tts-speak',
        label: lang === 'en' ? 'Speak' : '朗读',
        callback: () => {
          if (this.config.apiEndpoint) {
            this._speakViaPython(contentText);
          } else {
            this.context.audio.speakBrowser(contentText);
          }
        },
      });
    });
  }

  /**
   * Create HTML for the audio bar.
   */
  _createAudioBar(text) {
    // Estimate duration
    const plainText = text.replace(/[#*_`~\[\]()>|-]/g, ' ').replace(/\s+/g, ' ').trim();
    const wordCount = plainText.split(' ').filter(Boolean).length;
    const estimatedSecs = Math.max(1, Math.round(wordCount / 2.5));
    const mins = Math.floor(estimatedSecs / 60);
    const secs = estimatedSecs % 60;
    const durationStr = mins > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : `0:${String(secs).padStart(2, '0')}`;

    const lang = this.context.getLanguage();
    const playLabel = lang === 'en' ? 'Play' : '播放';

    // Escape text for safe embedding in onclick attribute
    const escaped = text.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');

    return `
      <div class="audio-bar">
        <button class="audio-btn audio-play-btn" onclick="(function(){ var t = '${escaped}'; if (window.ArcUI.tts) { window.ArcUI.tts.speak(t); } })()">▶ ${playLabel}</button>
        <div class="audio-progress">
          <div class="audio-progress-bar" style="width: 0%"></div>
        </div>
        <span class="audio-duration">${durationStr}</span>
      </div>
    `;
  }

  /**
   * Speak text via the Python TTS capability.
   */
  async _speakViaPython(text) {
    try {
      const result = await this.context.callPython('tts_speak', {
        text: text,
        voice: this.config.voice || 'alloy',
      });

      if (result.audio_base64) {
        this.context.audio.playFromBase64(result.audio_base64);
      } else if (result.audio_url) {
        const resp = await this.context.fetch(result.audio_url);
        const blob = await resp.blob();
        this.context.audio.playBlob(blob);
      }
    } catch (e) {
      console.warn('[TTS Plugin] Python TTS failed, using browser fallback:', e.message);
      this.context.audio.speakBrowser(text);
    }
  }

  destroy() {
    // Clean up any audio elements
    this.config = {};
  }
}
