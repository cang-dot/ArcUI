/* ArcUI - init.js */
/* Must be loaded FIRST, before all other JS modules.
   Pre-builds the complete window.ArcUI skeleton so that
   dependent modules (i18n, theme, etc.) can safely mount
   their implementations onto it. */

window.ArcUI = {
  state: {
    currentChatId: null,
    chatHistory: {},
    isProcessing: false,
    currentLang: 'zh',
    theme: 'dark',
    config: {
      backendUrl: 'http://localhost:1011',
      baseUrl: '',
      apiKey: '',
      model: '',
    },
    systemPrompt: '',
    availableModels: [],
    currentAttachments: [],
    backendType: 'generic',
    isStreaming: false,
    userName: 'User',
    assistantName: 'ArcUI',
    aiNameFollowModel: false,
    webSearchEnabled: false,
    bochaKey: '',
  },

  utils: {
    generateId: function () {
      return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    },
    escapeHtml: function (str) {
      if (!str) return '';
      var div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    },
    escapeAttr: function (str) {
      if (!str) return '';
      return str.replace(/&/g, '&').replace(/"/g, '"').replace(/'/g, '&#39;').replace(/</g, '<').replace(/>/g, '>');
    },
    showToast: function (message, type, duration) {
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
    },
    scrollToBottom: function () {
      var container = document.getElementById('chat-messages');
      if (container) container.scrollTop = container.scrollHeight;
    },
    debounce: function (fn, delay) {
      var timer;
      return function () {
        var args = arguments;
        var ctx = this;
        clearTimeout(timer);
        timer = setTimeout(function () { fn.apply(ctx, args); }, delay);
      };
    },
    highlightText: function (text, query) {
      if (!query) return ArcUI.utils.escapeHtml(text);
      var escaped = ArcUI.utils.escapeHtml(text);
      var q = ArcUI.utils.escapeHtml(query);
      var regex = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
      return escaped.replace(regex, '<mark>$1</mark>');
    },
    copyToClipboard: function (text) {
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
    },
  },

  i18n: {
    t: function (key) { return key; },
    applyLanguage: function () {},
    toggleLanguage: function () {},
    setLanguage: function () {},
    dict: {},
  },

  theme: {
    cycleTheme: function () {},
    applyTheme: function () {},
    updateThemeButton: function () {},
  },

  api: {
    callAPI: function () {},
    fetchModels: function () {},
    testConnection: function () {},
  },

  stream: {
    streamChat: function () {},
    typewriterRender: function () {},
    abortStream: function () {},
  },

  sidebar: {
    toggle: function () {},
    close: function () {},
    renderChatHistory: function () {},
    switchChat: function () {},
    newChat: function () {},
    onSearchInput: function () {},
    clearSearch: function () {},
  },

  chat: {
    sendMessage: function () {},
    sendPreset: function () {},
    addMessage: function () {},
    addMessageFromHistory: function () {},
    renderMessages: function () {},
    renderVerificationTrail: function () {},
    toggleTrail: function () {},
  },

  multimodal: {
    detectCapabilities: function () {},
    handleImageUpload: function () {},
    renderPreview: function () {},
    removeAttachment: function () {},
    toggleToolbar: function () {},
    triggerFileInput: function () {},
    setupDragDrop: function () {},
    setupClipboardPaste: function () {},
  },

  systemPrompt: {
    get: function () {},
    save: function () {},
    reset: function () {},
  },

  modelSelector: {
    fetchAndRender: function () {},
    switchModel: function () {},
    showManualInput: function () {},
    toggleModelPopup: function () {},
    renderCustomDropdown: function () {},
    toggleCustomDropdown: function () {},
    closeCustomDropdown: function () {},
    load: function () {},
  },

  settings: {
    show: function () {},
    save: function () {},
    testConnection: function () {},
    renderSetupScreen: function () {},
    saveSetup: function () {},
    clearConfig: function () {},
  },

  tts: {
    speak: function () {},
    playFromBase64: function () {},
    playBlob: function () {},
    speakBrowser: function () {},
    renderAudioBar: function () {},
    injectAudioBar: function () {},
  },

  plugins: {
    manager: null,
    PluginManager: null,
    renderPluginList: function () {},
  },
};
