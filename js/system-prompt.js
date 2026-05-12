/* ArcUI - system-prompt.js */
/* System prompt: get, save, reset, variable substitution */

(function () {
  'use strict';

  const ArcUI = window.ArcUI;

  // Default prompts per language
  const defaultPrompts = {
    zh: '你是一个知识渊博、乐于助人的AI助手。请用中文回答用户的问题。回答应准确、清晰、有条理。',
    en: 'You are a knowledgeable and helpful AI assistant. Provide accurate, clear, and well-structured responses.',
  };

  /**
   * Get the current system prompt with variable substitution applied.
   * @returns {string} The processed system prompt, or empty string to use default
   */
  function get() {
    const raw = ArcUI.state.systemPrompt || '';

    if (!raw) return '';

    // Variable substitution
    const config = ArcUI.state.config;
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD

    let processed = raw
      .replace(/\{\{model\}\}/g, config.model || '')
      .replace(/\{\{date\}\}/g, dateStr)
      .replace(/\{\{user_name\}\}/g, ArcUI.state.userName || 'User');

    return processed;
  }

  /**
   * Save a custom system prompt.
   * @param {string} value - The prompt text
   */
  function save(value) {
    ArcUI.state.systemPrompt = value || '';
    localStorage.setItem('arcui_system_prompt', ArcUI.state.systemPrompt);
    ArcUI.utils.showToast(ArcUI.i18n.t('save') + ' OK', '');
  }

  /**
   * Reset the system prompt to the default for the current language.
   * @returns {string} The default prompt
   */
  function reset() {
    const lang = ArcUI.state.currentLang || 'zh';
    const defaultPrompt = defaultPrompts[lang] || defaultPrompts['zh'];
    ArcUI.state.systemPrompt = defaultPrompt;
    localStorage.setItem('arcui_system_prompt', defaultPrompt);

    // Update the textarea in settings if visible
    const textarea = document.getElementById('system-prompt-editor');
    if (textarea) {
      textarea.value = defaultPrompt;
    }

    ArcUI.utils.showToast(ArcUI.i18n.t('restoreDefault'), '');
    return defaultPrompt;
  }

  /**
   * Load the system prompt from localStorage on startup.
   */
  function load() {
    const saved = localStorage.getItem('arcui_system_prompt');
    if (saved !== null) {
      ArcUI.state.systemPrompt = saved;
    } else {
      ArcUI.state.systemPrompt = '';
    }
  }

  // Expose
  ArcUI.systemPrompt = { get, save, reset, load, defaultPrompts };
})();
