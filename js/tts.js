/* ArcUI - tts.js */
/* TTS: text-to-speech voice bar component, playback logic, browser fallback */

(function () {
  'use strict';

  const ArcUI = window.ArcUI;

  // Audio context for playback
  let currentAudio = null;
  let isPlaying = false;

  /**
   * Speak text using available TTS engine.
   * Priority: Plugin TTS API > Browser SpeechSynthesis
   * @param {string} text - The text to speak
   * @param {object} [options] - TTS options like voice, speed
   */
  async function speak(text, options) {
    if (!text) return;

    // Stop any current playback
    stop();

    // Try to use the TTS plugin if available
    if (ArcUI.plugins && ArcUI.plugins.manager) {
      const ttsPlugin = ArcUI.plugins.manager.plugins.find(p => p.meta && p.meta.id === 'arcui-tts');
      if (ttsPlugin && ttsPlugin.instance && ttsPlugin.instance.config) {
        const config = ttsPlugin.instance.config;
        if (config.apiEndpoint && config.apiEndpoint.trim()) {
          try {
            await speakViaAPI(text, config);
            return;
          } catch (e) {
            console.warn('[TTS] API TTS failed, falling back to browser:', e.message);
          }
        }
      }
    }

    // Fallback to browser SpeechSynthesis
    speakBrowser(text, options);
  }

  /**
   * Speak via external TTS API through the plugin context.
   */
  async function speakViaAPI(text, config) {
    if (!ArcUI.plugins || !ArcUI.plugins.manager) {
      throw new Error('Plugin manager not available');
    }

    try {
      const result = await ArcUI.plugins.manager.context.callPython('tts_speak', {
        text: text,
        voice: config.voice || 'alloy',
        api_endpoint: config.apiEndpoint,
      });

      if (result && result.audio_base64) {
        // Play the base64 audio
        playFromBase64(result.audio_base64);
      } else if (result && result.audio_url) {
        // Play from URL
        const audio = new Audio(result.audio_url);
        currentAudio = audio;
        audio.play();
        isPlaying = true;
        audio.onended = () => { isPlaying = false; currentAudio = null; };
      }
    } catch (e) {
      throw new Error('TTS API call failed: ' + e.message);
    }
  }

  /**
   * Speak using browser's built-in SpeechSynthesis.
   */
  function speakBrowser(text, options) {
    if (!window.speechSynthesis) {
      ArcUI.utils.showToast(ArcUI.i18n.t('ttsNotSupported'), 'error');
      return;
    }

    // Cancel any existing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);

    // Apply options
    if (options) {
      if (options.voice) utterance.voice = options.voice;
      if (options.rate) utterance.rate = options.rate;
      if (options.pitch) utterance.pitch = options.pitch;
    }

    // Try to set language from current locale
    utterance.lang = ArcUI.state.currentLang === 'en' ? 'en-US' : 'zh-CN';

    utterance.onstart = () => { isPlaying = true; };
    utterance.onend = () => { isPlaying = false; };
    utterance.onerror = () => { isPlaying = false; };

    window.speechSynthesis.speak(utterance);
    currentAudio = utterance;
  }

  /**
   * Play audio from a base64 data URL.
   */
  function playFromBase64(b64) {
    if (!b64) return;

    stop();

    const audio = new Audio(b64);
    currentAudio = audio;
    audio.play().catch(e => {
      console.warn('[TTS] Audio play failed:', e);
      isPlaying = false;
    });
    isPlaying = true;
    audio.onended = () => { isPlaying = false; currentAudio = null; };
  }

  /**
   * Play audio from a Blob.
   */
  function playBlob(blob) {
    if (!blob) return;

    stop();

    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    currentAudio = audio;
    audio.play().catch(e => {
      console.warn('[TTS] Audio play failed:', e);
      isPlaying = false;
    });
    isPlaying = true;
    audio.onended = () => {
      isPlaying = false;
      currentAudio = null;
      URL.revokeObjectURL(url);
    };
  }

  /**
   * Stop current audio playback.
   */
  function stop() {
    if (currentAudio) {
      if (currentAudio instanceof SpeechSynthesisUtterance) {
        window.speechSynthesis.cancel();
      } else if (currentAudio instanceof Audio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      }
      currentAudio = null;
      isPlaying = false;
    }
  }

  /**
   * Pause/resume playback.
   */
  function togglePlayPause() {
    if (!currentAudio) return;

    if (currentAudio instanceof Audio) {
      if (isPlaying) {
        currentAudio.pause();
        isPlaying = false;
      } else {
        currentAudio.play();
        isPlaying = true;
      }
    } else if (currentAudio instanceof SpeechSynthesisUtterance) {
      if (isPlaying) {
        window.speechSynthesis.pause();
        isPlaying = false;
      } else {
        window.speechSynthesis.resume();
        isPlaying = true;
      }
    }
  }

  /**
   * Render an audio bar at the bottom of an assistant message.
   * @param {string} messageContent - The text content to speak
   * @returns {string} HTML for the audio bar
   */
  function renderAudioBar(messageContent) {
    if (!messageContent) return '';

    // Strip markdown for a rough word count
    const plainText = messageContent.replace(/[#*_`~\[\]()>|-]/g, ' ').replace(/\s+/g, ' ').trim();
    const wordCount = plainText.split(' ').filter(Boolean).length;
    const estimatedSecs = Math.max(1, Math.round(wordCount / 2.5)); // ~150 words per minute ≈ 2.5 words/sec

    const mins = Math.floor(estimatedSecs / 60);
    const secs = estimatedSecs % 60;
    const durationStr = mins > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : `0:${String(secs).padStart(2, '0')}`;

    return `
      <div class="audio-bar" data-message-text="${ArcUI.utils.escapeHtml(messageContent.substring(0, 200))}">
        <button class="audio-btn audio-play-btn" onclick="ArcUI.tts.speak(unescape('${encodeURIComponent(messageContent)}'))">▶ ${ArcUI.i18n.t('play')}</button>
        <span class="audio-duration">${durationStr}</span>
      </div>
    `;
  }

  /**
   * Inject audio bars into all assistant messages that don't have one yet.
   */
  function injectAudioBar() {
    const messages = document.querySelectorAll('.message.message-assistant');
    messages.forEach(msg => {
      if (msg.querySelector('.audio-bar')) return; // Already has one
      const contentEl = msg.querySelector('.message-content');
      if (contentEl) {
        const text = contentEl.textContent || '';
        if (text.trim()) {
          const barHtml = renderAudioBar(text);
          contentEl.insertAdjacentHTML('afterend', barHtml);
        }
      }
    });
  }

  // Expose
  ArcUI.tts = { speak, renderAudioBar, injectAudioBar, playFromBase64, playBlob, speakBrowser, stop };
})();
