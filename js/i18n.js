/* ArcUI - i18n.js */
/* Chinese/English dictionary, t() translator, applyLanguage(), toggleLanguage() */

(function () {
  'use strict';

  const ArcUI = window.ArcUI;

  // Dictionary: key -> { zh, en }
  const dict = {
    appTitle: { zh: 'ArcUI', en: 'ArcUI' },
    newChat: { zh: '新对话', en: 'New Chat' },
    search: { zh: '搜索对话...', en: 'Search chats...' },
    settings: { zh: '设置', en: 'Settings' },
    plugins: { zh: '插件', en: 'Plugins' },
    toggleTheme: { zh: '切换主题', en: 'Toggle Theme' },
    toggleLang: { zh: 'EN', en: '中文' },
    send: { zh: '发送', en: 'Send' },
    stop: { zh: '停止', en: 'Stop' },
    inputPlaceholder: { zh: '输入消息...', en: 'Type a message...' },
    user: { zh: '用户', en: 'User' },
    assistant: { zh: '助手', en: 'Assistant' },
    thinking: { zh: '思考中...', en: 'Thinking...' },
    emptyChat: { zh: '开始一段新对话', en: 'Start a new conversation' },
    emptyChatSub: { zh: '在下方输入消息，或点击侧边栏的对话', en: 'Type a message below, or select a conversation from the sidebar' },
    noChats: { zh: '暂无对话', en: 'No conversations yet' },
    apiConfig: { zh: 'API 配置', en: 'API Configuration' },
    baseUrl: { zh: 'LLM Base URL', en: 'LLM Base URL' },
    apiKey: { zh: 'API Key', en: 'API Key' },
    model: { zh: '模型', en: 'Model' },
    testConnection: { zh: '测试连接', en: 'Test Connection' },
    connectionSuccess: { zh: '连接成功', en: 'Connection successful' },
    connectionFailed: { zh: '连接失败', en: 'Connection failed' },
    save: { zh: '保存', en: 'Save' },
    cancel: { zh: '取消', en: 'Cancel' },
    close: { zh: '关闭', en: 'Close' },
    reset: { zh: '重置', en: 'Reset' },
    restoreDefault: { zh: '恢复默认', en: 'Restore Default' },
    systemPrompt: { zh: '系统提示词', en: 'System Prompt' },
    systemPromptDesc: { zh: '自定义发送给模型的系统提示词。留空使用默认。', en: 'Custom system prompt sent to the model. Leave empty to use default.' },
    systemPromptVars: { zh: '可用变量：{{model}} {{date}} {{user_name}}', en: 'Available variables: {{model}} {{date}} {{user_name}}' },
    theme: { zh: '主题', en: 'Theme' },
    language: { zh: '语言', en: 'Language' },
    dark: { zh: '暗色', en: 'Dark' },
    light: { zh: '浅色', en: 'Light' },
    chinese: { zh: '中文', en: 'Chinese' },
    english: { zh: 'English', en: 'English' },
    about: { zh: '关于', en: 'About' },
    verificationTrail: { zh: '验证轨迹', en: 'Verification Trail' },
    sources: { zh: '来源', en: 'Sources' },
    factARCDetected: { zh: '检测到 Fact-ARC 后端', en: 'Fact-ARC backend detected' },
    genericBackend: { zh: '标准 API', en: 'Standard API' },
    pluginManager: { zh: '插件管理', en: 'Plugin Manager' },
    noPlugins: { zh: '暂无可用的插件', en: 'No plugins available' },
    installPlugin: { zh: '安装插件', en: 'Install Plugin' },
    pluginId: { zh: '插件 ID', en: 'Plugin ID' },
    clearConfig: { zh: '清除配置', en: 'Clear Configuration' },
    clearConfigConfirm: { zh: '确定要清除所有配置吗？这将删除你的 API 设置和对话历史。', en: 'Are you sure you want to clear all configuration? This will delete your API settings and chat history.' },
    dangerZone: { zh: '危险区域', en: 'Danger Zone' },
    uploadImage: { zh: '上传图片', en: 'Upload Image' },
    tts: { zh: '语音合成', en: 'TTS' },
    play: { zh: '播放', en: 'Play' },
    pause: { zh: '暂停', en: 'Pause' },
    download: { zh: '下载', en: 'Download' },
    copy: { zh: '复制', en: 'Copy' },
    copied: { zh: '已复制', en: 'Copied' },
    errorOccurred: { zh: '发生错误', en: 'An error occurred' },
    retry: { zh: '重试', en: 'Retry' },
    maxCorrectionRounds: { zh: '最大纠错轮次', en: 'Max Correction Rounds' },
    setupTitle: { zh: '欢迎使用 ArcUI', en: 'Welcome to ArcUI' },
    setupDesc: { zh: '在开始对话前，请配置你的 LLM API 连接信息。', en: 'Configure your LLM API connection before starting.' },
    setupGetStart: { zh: '开始使用', en: 'Get Started' },
    adText: { zh: 'PS：作者也写了一个 AI 引擎，可以有效抑制 AI 胡说，\n感兴趣的话来看看，求求了', en: 'PS: The author also built an AI engine that effectively reduces hallucinations.\nCheck it out if you\'re interested!' },
    fetchingModels: { zh: '获取模型列表中...', en: 'Fetching models...' },
    noModelsFound: { zh: '未找到模型，可手动输入', en: 'No models found. You can type manually.' },
    appSubtitle: { zh: 'AI 对话前端', en: 'AI Chat Frontend' },
    searchChats: { zh: '搜索对话...', en: 'Search chats...' },
    sendMessage: { zh: '发送消息', en: 'Send Message' },
    stopGeneration: { zh: '停止生成', en: 'Stop Generation' },
    enterBaseUrl: { zh: '请输入 API Base URL', en: 'Please enter API Base URL' },
    settingsSaved: { zh: '设置已保存', en: 'Settings saved' },
    welcome: { zh: '欢迎使用 ArcUI', en: 'Welcome to ArcUI' },
    welcomeSub: { zh: '在开始对话前，请配置你的 LLM API 连接信息。', en: 'Configure your LLM API connection before starting.' },
    welcomeTitle: { zh: '欢迎使用 ArcUI', en: 'Welcome to ArcUI' },
    welcomeSubtitle: { zh: '通用的 AI 对话前端。配置 LLM API 即可开始。', en: 'A universal AI chat frontend. Configure your LLM API to get started.' },
    connect: { zh: '连接 API', en: 'Connect API' },
    configCleared: { zh: '所有配置已清除', en: 'All configuration cleared' },
    confirmClearConfig: { zh: '确定要清除所有配置和对话历史吗？', en: 'Are you sure you want to clear all config and chat history?' },
    yesterday: { zh: '昨天', en: 'Yesterday' },
    apiConfigDesc: { zh: '配置 LLM API 地址和密钥。支持任何 OpenAI 兼容 API。', en: 'Configure LLM API URL and key. Supports any OpenAI-compatible API.' },
    savePrompt: { zh: '保存提示词', en: 'Save Prompt' },
    resetDefault: { zh: '恢复默认', en: 'Restore Default' },
    systemPromptPlaceholder: { zh: '例如：你是一个有帮助的助手...', en: 'E.g.: You are a helpful assistant...' },
    ttsSettings: { zh: 'TTS 语音设置', en: 'TTS Voice Settings' },
    ttsSettingsDesc: { zh: '配置文字转语音。不填 API 地址则使用浏览器内置引擎。', en: 'Configure text-to-speech. Leave API empty to use browser built-in engine.' },
    ttsEndpoint: { zh: 'TTS API 地址', en: 'TTS API Endpoint' },
    ttsVoice: { zh: '语音', en: 'Voice' },
    ttsAutoPlay: { zh: '自动播放语音', en: 'Auto-play speech' },
    pluginsDesc: { zh: '管理已安装的插件。', en: 'Manage installed plugins.' },
    appearance: { zh: '外观', en: 'Appearance' },
    adText1: { zh: 'PS：作者也写了一个 AI 引擎，可以有效抑制 AI 胡说，', en: 'PS: The author also built an AI engine that effectively reduces hallucinations,' },
    adText2: { zh: '感兴趣的话来看看，求求了 🙏', en: 'Check it out if you\'re interested! 🙏' },
    newChatHint: { zh: 'Ctrl+N 新对话', en: 'Ctrl+N New Chat' },
    noModel: { zh: '请先配置 API', en: 'Configure API first' },
    correctionRounds: { zh: '最大纠错轮次', en: 'Max Correction Rounds' },
    ttsNotSupported: { zh: '浏览器不支持语音合成', en: 'Browser does not support speech synthesis' },
    vision: { zh: '视觉', en: 'Vision' },
    audio: { zh: '音频', en: 'Audio' },
    deleteChat: { zh: '删除对话', en: 'Delete Chat' },
    confirmDeleteChat: { zh: '确定要删除这个对话吗？', en: 'Are you sure you want to delete this conversation?' },
    editNames: { zh: '编辑名称', en: 'Edit Names' },
    edit: { zh: '修改', en: 'Edit' },
    webSearch: { zh: '联网搜索', en: 'Web Search' },
    webSearchOn: { zh: '联网搜索：开', en: 'Web Search: ON' },
    webSearchOff: { zh: '联网搜索：关', en: 'Web Search: OFF' },
    bochaKey: { zh: 'Bocha API Key (联网搜索)', en: 'Bocha API Key (Web Search)' },
    bochaKeyHint: { zh: 'Bocha API 密钥，用于联网搜索功能。留空则不启用。', en: 'Bocha API key for web search. Leave empty to disable.' },
    aiNameFollowModel: { zh: 'AI 名字跟随模型名字', en: 'AI name follows model name' },
    aiNameFollowModelDesc: { zh: '开启后 AI 名字将自动跟随当前使用的模型名称', en: 'When enabled, the AI name will automatically follow the current model name' },
    editNames: { zh: '编辑名称', en: 'Edit Names' },
    selectModel: { zh: '选择模型...', en: 'Select model...' },
    enterManually: { zh: '手动输入...', en: 'Enter manually...' },
    current: { zh: '当前', en: 'Current' },
    switchModel: { zh: '切换模型', en: 'Switch Model' },
    correctionEngine: { zh: '纠错引擎', en: 'Correction Engine' },
    correctionDesc: { zh: '多轮自我纠正，提高回答准确性', en: 'Multi-round self-correction to improve accuracy' },
    enableCorrection: { zh: '启用纠错', en: 'Enable Correction' },
    correctionMaxRounds: { zh: '最大纠错轮次', en: 'Max Correction Rounds' },
    correctionThreshold: { zh: '置信度阈值', en: 'Confidence Threshold' },
    correctionWarning: { zh: '⚠ 警告：开启此功能后token用量将成倍增长！！！', en: '⚠ Warning: Enabling this feature will multiply token usage significantly!' },
    correctionDrafting: { zh: 'AI正在打草稿......', en: 'AI is drafting...' },
    correctionEvaluating: { zh: '纠错模型正在判定......', en: 'Correction model evaluating...' },
    correctionConfidence: { zh: '置信度', en: 'Confidence' },
    correctionSearching: { zh: '正在联网搜索......', en: 'Searching the web...' },
    correctionSearchResults: { zh: '搜索到{0}个结果', en: 'Found {0} results' },
    correctionRevising: { zh: 'AI正在根据结果修正......', en: 'AI is revising based on results...' },
    correctionPolishing: { zh: '语言润色中......', en: 'Polishing language...' },
    correctionReady: { zh: '准备输出......', en: 'Ready to output...' },
    correctionExpand: { zh: '展开', en: 'Expand' },
    correctionCollapse: { zh: '收起', en: 'Collapse' },
    correctionRound: { zh: '第{0}轮', en: 'Round {0}' },
    on: { zh: '开', en: 'ON' },
    off: { zh: '关', en: 'OFF' },
  };

  /**
   * Translate a key to the current language.
   * Falls back to the key itself if not found.
   */
  function t(key) {
    const entry = dict[key];
    if (!entry) return key;
    const lang = ArcUI.state.currentLang || 'zh';
    return entry[lang] || entry['zh'] || key;
  }

  /**
   * Apply language to all DOM elements with [data-i18n] attribute.
   * Also updates placeholders and titles.
   */
  function applyLanguage() {
    const lang = ArcUI.state.currentLang;
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';

    // Update text content
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (key) {
        el.textContent = t(key);
      }
    });

    // Update placeholder attributes
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (key) {
        el.setAttribute('placeholder', t(key));
      }
    });

    // Update title attributes
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      if (key) {
        el.setAttribute('title', t(key));
      }
    });

    // Update toggle button text
    const langBtn = document.getElementById('lang-btn');
    if (langBtn) {
      langBtn.textContent = t('toggleLang');
    }

    // Update web search button (managed manually due to emoji icon)
    var searchBtn = document.getElementById('web-search-btn');
    if (searchBtn) {
      if (window.ArcUI && window.ArcUI.state && window.ArcUI.state.webSearchEnabled) {
        searchBtn.innerHTML = '\u{1F310} ' + t('webSearch') + '\uFF1A' + t('on');
      } else {
        searchBtn.innerHTML = '\u{1F310} ' + t('webSearchOff');
      }
    }

    // Dispatch custom event for plugins / dynamic content
    document.dispatchEvent(new CustomEvent('arcui:language-changed', { detail: { lang } }));
  }

  /**
   * Set language explicitly.
   */
  function setLanguage(lang) {
    if (lang !== 'zh' && lang !== 'en') return;
    ArcUI.state.currentLang = lang;
    localStorage.setItem('arcui_lang', lang);
    applyLanguage();

    // Re-render sidebar and any dynamic UI
    if (ArcUI.sidebar && ArcUI.sidebar.renderChatHistory) {
      ArcUI.sidebar.renderChatHistory();
    }
  }

  /**
   * Toggle between Chinese and English.
   */
  function toggleLanguage() {
    var newLang = ArcUI.state.currentLang === 'zh' ? 'en' : 'zh';
    setLanguage(newLang);
  }

  // Expose
  ArcUI.i18n = { t, applyLanguage, setLanguage, toggleLanguage, dict };
})();
