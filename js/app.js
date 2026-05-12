/* ArcUI - app.js */
/* Entry point: global state, initialization, namespace wiring */

(function () {
  'use strict';

  // ---- Global State ----
  // window.ArcUI is already pre-built by init.js

  const ArcUI = window.ArcUI;
  const { utils } = ArcUI;

  // ---- Utils (defined early since other modules may need them) ----
  // Note: init.js already creates ArcUI.utils stubs, but we overwrite them here with real implementations.
  // The toggleWebSearch function is exposed on ArcUI directly (not on utils) so it's callable from onclick handlers.
  if (!ArcUI.utils) {
    ArcUI.utils = {};
  }

  ArcUI.utils.generateId = function () {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  };

  ArcUI.utils.escapeHtml = function (str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  };

  ArcUI.utils.showToast = function (message, type, duration) {
    var container = document.getElementById('toast-container');
    if (!container) return;
    var toast = document.createElement('div');
    toast.className = 'toast' + (type ? ' toast-' + type : '');
    toast.textContent = message;
    container.appendChild(toast);
    void toast.offsetWidth;
    toast.classList.add('toast-visible');
    setTimeout(function () {
      toast.classList.remove('toast-visible');
      setTimeout(function () { toast.remove(); }, 300);
    }, duration || 3000);
  };

  ArcUI.utils.scrollToBottom = function () {
    var container = document.getElementById('chat-messages');
    if (container) container.scrollTop = container.scrollHeight;
  };

  ArcUI.utils.debounce = function (fn, delay) {
    var timer;
    return function () {
      var args = arguments;
      var ctx = this;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(ctx, args); }, delay);
    };
  };

  ArcUI.utils.highlightText = function (text, query) {
    if (!query) return ArcUI.utils.escapeHtml(text);
    var escaped = ArcUI.utils.escapeHtml(text);
    var q = ArcUI.utils.escapeHtml(query);
    var regex = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
    return escaped.replace(regex, '<mark>$1</mark>');
  };

  ArcUI.utils.escapeAttr = function (str) {
    if (!str) return '';
    return str.replace(/&/g, '&').replace(/"/g, '"').replace(/'/g, '&#39;').replace(/</g, '<').replace(/>/g, '>');
  };

  ArcUI.utils.copyToClipboard = function (text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        ArcUI.utils.showToast(ArcUI.i18n.t('copied'), '');
      });
    } else {
      var textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        ArcUI.utils.showToast(ArcUI.i18n.t('copied'), '');
      } catch (e) {
        ArcUI.utils.showToast('Copy failed', 'error');
      }
      document.body.removeChild(textarea);
    }
  };

  // toggleWebSearch is exposed on ArcUI (not utils) so onclick can call ArcUI.toggleWebSearch()
  ArcUI.toggleWebSearch = function () {
    ArcUI.state.webSearchEnabled = !ArcUI.state.webSearchEnabled;
    localStorage.setItem('arcui_web_search', ArcUI.state.webSearchEnabled ? '1' : '0');
    var btn = document.getElementById('web-search-btn');
    if (btn) {
      if (ArcUI.state.webSearchEnabled) {
        btn.innerHTML = '\u{1F310} ' + ArcUI.i18n.t('webSearch') + '\uFF1A' + ArcUI.i18n.t('on');
        btn.classList.add('active');
        btn.setAttribute('data-i18n', 'webSearchOn');
        btn.title = ArcUI.i18n.t('webSearch');
      } else {
        btn.innerHTML = '\u{1F310} ' + ArcUI.i18n.t('webSearchOff');
        btn.classList.remove('active');
        btn.setAttribute('data-i18n', 'webSearchOff');
        btn.title = ArcUI.i18n.t('webSearchOff');
      }
    }
    var status = ArcUI.state.webSearchEnabled ? ArcUI.i18n.t('webSearchOn') : ArcUI.i18n.t('webSearchOff');
    ArcUI.utils.showToast(status, '');
  };

  // ---- State Initialization ----
  function initState() {
    // Load saved config
    let savedConfig = {};
    try {
      const raw = localStorage.getItem('arcui_config');
      if (raw) savedConfig = JSON.parse(raw);
    } catch (e) { /* ignore */ }

    // Load saved theme
    let savedTheme = localStorage.getItem('arcui_theme') || 'dark';
    if (savedTheme !== 'dark' && savedTheme !== 'light') savedTheme = 'dark';

    // Load saved language
    let savedLang = localStorage.getItem('arcui_lang') || 'zh';
    if (savedLang !== 'zh' && savedLang !== 'en') savedLang = 'zh';

    // Load saved model
    const savedModel = localStorage.getItem('arcui_model') || '';

    // Load saved system prompt
    const savedSystemPrompt = localStorage.getItem('arcui_system_prompt') || '';

    // Load chat history
    let chatHistory = {};
    try {
      const raw = localStorage.getItem('arcui_chat_history');
      if (raw) chatHistory = JSON.parse(raw);
    } catch (e) { /* ignore */ }

    // Load current chat ID
    const savedChatId = localStorage.getItem('arcui_current_chat_id') || '';

    // Load additional state
    const savedBochaKey = localStorage.getItem('arcui_bocha_key') || '';
    const savedWebSearch = localStorage.getItem('arcui_web_search') === '1';
    const savedAiNameFollow = localStorage.getItem('arcui_ai_name_follow_model') === '1';
    const savedUserName = localStorage.getItem('arcui_user_name') || 'User';
    const savedAssistantName = localStorage.getItem('arcui_assistant_name') || 'ArcUI';

    ArcUI.state = {
      currentChatId: savedChatId,
      chatHistory: chatHistory,
      isProcessing: false,
      currentLang: savedLang,
      theme: savedTheme,
      config: {
        backendUrl: savedConfig.backendUrl || 'http://localhost:1011',
        baseUrl: savedConfig.baseUrl || '',
        apiKey: savedConfig.apiKey || '',
        model: savedConfig.model || savedModel || '',
      },
      systemPrompt: savedSystemPrompt,
      availableModels: [],
      currentAttachments: [],
      backendType: 'generic',
      factARCToken: null,
      isStreaming: false,
      userName: savedUserName,
      assistantName: savedAssistantName,
      aiNameFollowModel: savedAiNameFollow,
      webSearchEnabled: savedWebSearch,
      bochaKey: savedBochaKey,
      correctionEnabled: localStorage.getItem('arcui_correction_enabled') === '1',
      correctionMaxRounds: parseInt(localStorage.getItem('arcui_correction_rounds') || '2', 10),
      correctionThreshold: parseInt(localStorage.getItem('arcui_correction_threshold') || '70', 10),
    };
  }

  // ---- DOM Event Wiring ----
  function setupEventListeners() {
    // Sidebar toggle (hamburger button)
    const hamburgerBtn = document.getElementById('hamburger-btn');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');

    if (hamburgerBtn) {
      hamburgerBtn.addEventListener('click', () => {
        ArcUI.sidebar.toggle();
      });
    }

    if (sidebarOverlay) {
      sidebarOverlay.addEventListener('click', () => {
        ArcUI.sidebar.close();
      });
    }

    // Settings button
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
        ArcUI.settings.show();
      });
    }

    // Settings close button
    const settingsClose = document.getElementById('settings-close-btn');
    if (settingsClose) {
      settingsClose.addEventListener('click', () => {
        const panel = document.getElementById('settings-panel');
        if (panel) panel.classList.remove('open');
      });
    }

    // Settings save button
    const settingsSave = document.getElementById('settings-save-btn');
    if (settingsSave) {
      settingsSave.addEventListener('click', () => {
        ArcUI.settings.save();
      });
    }

    // Test connection button
    const testConnBtn = document.getElementById('test-connection-btn');
    if (testConnBtn) {
      testConnBtn.addEventListener('click', () => {
        ArcUI.settings.testConnection();
      });
    }

    // System prompt save button
    const savePromptBtn = document.getElementById('save-prompt-btn');
    if (savePromptBtn) {
      savePromptBtn.addEventListener('click', () => {
        ArcUI.systemPrompt.save();
      });
    }

    // System prompt reset button
    const resetPromptBtn = document.getElementById('reset-prompt-btn');
    if (resetPromptBtn) {
      resetPromptBtn.addEventListener('click', () => {
        ArcUI.systemPrompt.reset();
      });
    }

    // Settings theme buttons
    const themeDarkBtn = document.getElementById('settings-theme-dark');
    const themeLightBtn = document.getElementById('settings-theme-light');
    if (themeDarkBtn) {
      themeDarkBtn.addEventListener('click', () => {
        ArcUI.theme.applyTheme('dark');
      });
    }
    if (themeLightBtn) {
      themeLightBtn.addEventListener('click', () => {
        ArcUI.theme.applyTheme('light');
      });
    }

    // Settings language buttons
    const langZhBtn = document.getElementById('settings-lang-zh');
    const langEnBtn = document.getElementById('settings-lang-en');
    if (langZhBtn) {
      langZhBtn.addEventListener('click', () => {
        ArcUI.i18n.setLanguage('zh');
      });
    }
    if (langEnBtn) {
      langEnBtn.addEventListener('click', () => {
        ArcUI.i18n.setLanguage('en');
      });
    }

    // Clear config button (danger zone)
    const clearConfigBtn = document.getElementById('clear-config-btn');
    if (clearConfigBtn) {
      clearConfigBtn.addEventListener('click', () => {
        if (confirm(ArcUI.i18n.t('confirmClearConfig') || 'Are you sure? This will clear all settings and conversations.')) {
          ArcUI.settings.clearConfig();
        }
      });
    }

    // Theme toggle button
    const themeBtn = document.getElementById('theme-btn');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        ArcUI.theme.cycleTheme();
      });
    }

    // Language toggle button
    const langBtn = document.getElementById('lang-btn');
    if (langBtn) {
      langBtn.addEventListener('click', () => {
        ArcUI.i18n.toggleLanguage();
      });
    }

    // New chat button
    const newChatBtn = document.getElementById('new-chat-btn');
    if (newChatBtn) {
      newChatBtn.addEventListener('click', () => {
        ArcUI.sidebar.newChat();
      });
    }

    // Send message button
    const sendBtn = document.getElementById('send-btn');
    if (sendBtn) {
      sendBtn.addEventListener('click', () => {
        ArcUI.chat.sendMessage();
      });
    }

    // Chat input — Enter to send
    const chatInput = document.getElementById('chat-input');
    if (chatInput) {
      chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          ArcUI.chat.sendMessage();
        }
      });

      // Auto-resize textarea + enable/disable send button
      chatInput.addEventListener('input', () => {
        chatInput.style.height = 'auto';
        chatInput.style.height = Math.min(chatInput.scrollHeight, 200) + 'px';

        const sendBtn = document.getElementById('send-btn');
        if (sendBtn) {
          var hasText = chatInput.value.trim().length > 0;
          var hasAttachments = ArcUI.state && ArcUI.state.currentAttachments && ArcUI.state.currentAttachments.length > 0;
          sendBtn.disabled = !(hasText || hasAttachments);
        }
      });
    }

    // Image upload button
    const uploadBtn = document.getElementById('upload-btn');
    const fileInput = document.getElementById('multimodal-file-input');
    if (uploadBtn && fileInput) {
      uploadBtn.addEventListener('click', () => {
        ArcUI.multimodal.triggerFileInput();
      });
      fileInput.addEventListener('change', (e) => {
        ArcUI.multimodal.handleImageUpload(e);
      });
    }

    // Stop generation button
    const stopBtn = document.getElementById('stop-btn');
    if (stopBtn) {
      stopBtn.addEventListener('click', () => {
        ArcUI.stream.abortStream();
      });
    }

    // Sidebar search
    const sidebarSearch = document.getElementById('sidebar-search');
    if (sidebarSearch) {
      sidebarSearch.addEventListener('input', (e) => {
        ArcUI.sidebar.onSearchInput(e.target.value);
      });
    }

    // Keyboard shortcut: Ctrl+N for new chat
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        ArcUI.sidebar.newChat();
      }
    });

    // Close sidebar on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        ArcUI.sidebar.close();
        const panel = document.getElementById('settings-panel');
        if (panel) panel.classList.remove('open');
      }
    });
  }

  // ---- Main Initialization ----
  async function init() {
    // Initialize state first
    initState();

    // Apply theme
    ArcUI.theme.applyTheme(ArcUI.state.theme);

    // Apply language
    ArcUI.i18n.applyLanguage(ArcUI.state.currentLang);

    // Set up event listeners
    setupEventListeners();

    // Set up drag-drop and clipboard for multimodal
    ArcUI.multimodal.setupDragDrop();
    ArcUI.multimodal.setupClipboardPaste();

    // Render sidebar with chat history
    ArcUI.sidebar.renderChatHistory();

    // Check if config exists
    const hasConfig = ArcUI.state.config.baseUrl && ArcUI.state.config.apiKey;

    if (!hasConfig) {
      // Show setup screen
      ArcUI.settings.renderSetupScreen();
      // Hide input area
      const inputArea = document.getElementById('input-area');
      if (inputArea) inputArea.style.display = 'none';
    } else {
      // Detect backend identity
      try {
        await ArcUI.identity.detectBackend();
      } catch (e) {
        console.warn('[App] Backend detection failed:', e);
      }

      // Fetch models
      try {
        await ArcUI.modelSelector.fetchAndRender();
      } catch (e) {
        console.warn('[App] Model fetch failed:', e);
      }

      // Load or create current chat
      if (ArcUI.state.currentChatId && ArcUI.state.chatHistory[ArcUI.state.currentChatId]) {
        ArcUI.chat.renderMessages(ArcUI.state.currentChatId);
      } else {
        // Create a new chat if none exists
        ArcUI.sidebar.newChat(false);
      }
    }

    // Initialize plugin manager and load plugins
    if (ArcUI.plugins && ArcUI.plugins.PluginManager) {
      ArcUI.plugins.manager = new ArcUI.plugins.PluginManager();
      try {
        await ArcUI.plugins.manager.loadAll();
      } catch (e) {
        console.warn('[App] Plugin loading failed:', e);
      }
    } else {
      console.warn('[App] PluginManager not available — skipping plugin initialization.');
    }

    // Update UI elements
    ArcUI.theme.updateThemeButton();

    console.log('[ArcUI] Initialization complete.');
  }

  // Run initialization when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
