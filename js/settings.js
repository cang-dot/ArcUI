/* ArcUI - settings.js */
/* Settings panel: form rendering, save, test connection, setup screen */

(function () {
  'use strict';

  const ArcUI = window.ArcUI;

  /**
   * Show the settings panel.
   */
  function show() {
    const panel = document.getElementById('settings-panel');
    if (!panel) return;

    // Populate form values from current config
    const baseUrlEl = document.getElementById('setting-base-url');
    const apiKeyEl = document.getElementById('setting-api-key');
    const bochaKeyEl = document.getElementById('setting-bocha-key');
    const modelEl = document.getElementById('setting-model');

    if (baseUrlEl) baseUrlEl.value = ArcUI.state.config.baseUrl || '';
    if (apiKeyEl) apiKeyEl.value = ArcUI.state.config.apiKey || '';
    if (bochaKeyEl) bochaKeyEl.value = ArcUI.state.bochaKey || '';

    // Populate model select dropdown
    if (modelEl && modelEl.tagName === 'SELECT') {
      modelEl.innerHTML = '<option value="">' + ArcUI.i18n.t('selectModel') + '</option>';
      var models = ArcUI.state.availableModels || [];
      for (var i = 0; i < models.length; i++) {
        var m = models[i];
        var selected = (m.id === ArcUI.state.config.model) ? ' selected' : '';
        modelEl.innerHTML += '<option value="' + ArcUI.utils.escapeAttr(m.id) + '"' + selected + '>' + ArcUI.utils.escapeHtml(m.id) + '</option>';
      }
      // If there's a model set but not in the list, add it
      if (ArcUI.state.config.model && models.length === 0) {
        modelEl.innerHTML += '<option value="' + ArcUI.utils.escapeAttr(ArcUI.state.config.model) + '" selected>' + ArcUI.utils.escapeHtml(ArcUI.state.config.model) + '</option>';
      }
    }

    // Populate system prompt editor
    const systemPromptEl = document.getElementById('system-prompt-editor');
    if (systemPromptEl) {
      systemPromptEl.value = ArcUI.state.systemPrompt || '';
    }

    // Populate correction settings
    const correctionEnabledEl = document.getElementById('setting-correction-enabled');
    if (correctionEnabledEl) correctionEnabledEl.checked = !!ArcUI.state.correctionEnabled;
    const correctionRoundsEl = document.getElementById('setting-correction-rounds');
    if (correctionRoundsEl) correctionRoundsEl.value = ArcUI.state.correctionMaxRounds || 2;
    const correctionThresholdEl = document.getElementById('setting-correction-threshold');
    if (correctionThresholdEl) correctionThresholdEl.value = ArcUI.state.correctionThreshold || 70;
    const webSearchEnabledEl = document.getElementById('setting-web-search-enabled');
    if (webSearchEnabledEl) webSearchEnabledEl.checked = !!ArcUI.state.webSearchEnabled;

    // Update title based on backend type
    const backendStatus = document.getElementById('backend-status');
    if (backendStatus) {
      if (ArcUI.state.backendType === 'factarc') {
        backendStatus.textContent = 'Fact-ARC';
        backendStatus.className = 'backend-status factarc';
      } else {
        backendStatus.textContent = '';
        backendStatus.className = 'backend-status';
      }
    }

    panel.classList.add('open');
  }

  /**
   * Save settings from the form.
   */
  async function save() {
    const baseUrl = document.getElementById('setting-base-url')?.value?.trim() || '';
    const apiKey = document.getElementById('setting-api-key')?.value?.trim() || '';
    const bochaKey = document.getElementById('setting-bocha-key')?.value?.trim() || '';
    const model = document.getElementById('setting-model')?.value?.trim() || '';

    // Validate
    if (!baseUrl) {
      ArcUI.utils.showToast(ArcUI.i18n.t('enterBaseUrl'), 'error');
      return;
    }

    // Save bocha key
    ArcUI.state.bochaKey = bochaKey;
    localStorage.setItem('arcui_bocha_key', bochaKey);

    // Save correction settings
    ArcUI.state.correctionEnabled = document.getElementById('setting-correction-enabled')?.checked || false;
    ArcUI.state.correctionMaxRounds = parseInt(document.getElementById('setting-correction-rounds')?.value, 10) || 2;
    ArcUI.state.correctionThreshold = parseInt(document.getElementById('setting-correction-threshold')?.value, 10) || 70;
    ArcUI.state.webSearchEnabled = document.getElementById('setting-web-search-enabled')?.checked || false;

    // Clamp values
    ArcUI.state.correctionMaxRounds = Math.max(1, Math.min(5, ArcUI.state.correctionMaxRounds));
    ArcUI.state.correctionThreshold = Math.max(30, Math.min(99, ArcUI.state.correctionThreshold));

    localStorage.setItem('arcui_correction_enabled', ArcUI.state.correctionEnabled ? '1' : '0');
    localStorage.setItem('arcui_correction_rounds', ArcUI.state.correctionMaxRounds);
    localStorage.setItem('arcui_correction_threshold', ArcUI.state.correctionThreshold);
    localStorage.setItem('arcui_web_search_enabled', ArcUI.state.webSearchEnabled ? '1' : '0');

    // Save config
    ArcUI.state.config.baseUrl = baseUrl;
    ArcUI.state.config.apiKey = apiKey;
    ArcUI.state.config.model = model;

    localStorage.setItem('arcui_config', JSON.stringify(ArcUI.state.config));
    localStorage.setItem('arcui_model', model);

    // Save system prompt
    const systemPrompt = document.getElementById('system-prompt-editor')?.value || '';
    ArcUI.systemPrompt.save(systemPrompt);

    // Detect backend identity
    try {
      await ArcUI.identity.detectBackend();
    } catch (e) {
      console.warn('[Settings] Backend detection failed:', e);
      ArcUI.state.backendType = 'generic';
    }

    // Refresh model list
    await ArcUI.modelSelector.fetchAndRender();

    ArcUI.utils.showToast(ArcUI.i18n.t('settingsSaved'), '');

    // Close panel
    const panel = document.getElementById('settings-panel');
    if (panel) panel.classList.remove('open');
  }

  /**
   * Test the API connection with current form values.
   */
  async function testConnection() {
    const baseUrl = document.getElementById('setting-base-url')?.value?.trim() || '';
    const apiKey = document.getElementById('setting-api-key')?.value?.trim() || '';
    const model = document.getElementById('setting-model')?.value?.trim() || '';

    if (!baseUrl || !apiKey) {
      ArcUI.utils.showToast(ArcUI.i18n.t('enterBaseUrl'), 'error');
      return;
    }

    const testStatusEl = document.getElementById('test-connection-status');
    if (testStatusEl) {
      testStatusEl.textContent = '...';
      testStatusEl.className = 'test-status testing';
    }

    try {
      const result = await ArcUI.api.testConnection(baseUrl, apiKey, model);
      if (testStatusEl) {
        testStatusEl.textContent = ArcUI.i18n.t('connectionSuccess');
        testStatusEl.className = 'test-status success';
      }
      ArcUI.utils.showToast(ArcUI.i18n.t('connectionSuccess'), '');
    } catch (err) {
      if (testStatusEl) {
        testStatusEl.textContent = err.message;
        testStatusEl.className = 'test-status error';
      }
      ArcUI.utils.showToast(err.message, 'error');
    }
  }

  /**
   * Render the initial setup screen (shown when no config exists).
   */
  function renderSetupScreen() {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    container.innerHTML = `
      <div class="setup-screen">
        <div class="setup-title">${ArcUI.i18n.t('welcome')}</div>
        <div class="setup-subtitle">${ArcUI.i18n.t('welcomeSub')}</div>
        <div class="setup-form">
          <div class="form-group">
            <label class="form-label">${ArcUI.i18n.t('baseUrl')}</label>
            <input type="text" class="form-input" id="setup-base-url" placeholder="https://api.openai.com/v1" />
          </div>
          <div class="form-group">
            <label class="form-label">${ArcUI.i18n.t('apiKey')}</label>
            <input type="password" class="form-input" id="setup-api-key" placeholder="sk-..." />
          </div>
          <div class="form-group">
            <label class="form-label">${ArcUI.i18n.t('model')}</label>
            <input type="text" class="form-input" id="setup-model" placeholder="gpt-4o" />
          </div>
          <button class="btn btn-primary" onclick="ArcUI.settings.saveSetup()">${ArcUI.i18n.t('connect')}</button>
        </div>
      </div>
    `;
  }

  /**
   * Save setup form and proceed to main chat interface.
   */
  async function saveSetup() {
    const baseUrl = document.getElementById('setup-base-url')?.value?.trim() || '';
    const apiKey = document.getElementById('setup-api-key')?.value?.trim() || '';
    const model = document.getElementById('setup-model')?.value?.trim() || '';

    if (!baseUrl) {
      ArcUI.utils.showToast(ArcUI.i18n.t('enterBaseUrl'), 'error');
      return;
    }

    ArcUI.state.config.baseUrl = baseUrl;
    ArcUI.state.config.apiKey = apiKey;
    ArcUI.state.config.model = model;

    localStorage.setItem('arcui_config', JSON.stringify(ArcUI.state.config));
    localStorage.setItem('arcui_model', model);

    // Detect backend
    try {
      await ArcUI.identity.detectBackend();
    } catch (e) {
      console.warn('[Settings] Backend detection failed:', e);
    }

    // Fetch models
    await ArcUI.modelSelector.fetchAndRender();

    // Reload the main chat view
    ArcUI.chat.renderMessages(ArcUI.state.currentChatId);
    ArcUI.sidebar.renderChatHistory();

    ArcUI.utils.showToast(ArcUI.i18n.t('settingsSaved'), '');
  }

  /**
   * Clear all config and reset to setup screen.
   */
  function clearConfig() {
    ArcUI.state.config = {
      baseUrl: '',
      apiKey: '',
      model: '',
    };
    ArcUI.state.systemPrompt = '';
    ArcUI.state.availableModels = [];
    ArcUI.state.backendType = 'generic';
    ArcUI.state.factARCToken = null;
    ArcUI.state.currentAttachments = [];

    localStorage.removeItem('arcui_config');
    localStorage.removeItem('arcui_model');
    localStorage.removeItem('arcui_system_prompt');
    localStorage.removeItem('arcui_correction_enabled');
    localStorage.removeItem('arcui_correction_rounds');
    localStorage.removeItem('arcui_correction_threshold');
    localStorage.removeItem('arcui_web_search_enabled');

    document.getElementById('multimodal-toolbar').style.display = 'none';
    document.getElementById('attachment-previews').innerHTML = '';

    renderSetupScreen();
    ArcUI.utils.showToast(ArcUI.i18n.t('configCleared'), '');
  }

  // Expose
  ArcUI.settings = { show, save, renderSetupScreen, saveSetup, clearConfig, testConnection };
})();
