/* ArcUI - model-selector.js */
/* Model selector dropdown: fetch model list, render custom dropdown, switch model */

(function () {
  'use strict';

  const ArcUI = window.ArcUI;

  document.addEventListener('click', (e) => {
    // Close any open model dropdown if clicking outside
    const wrappers = document.querySelectorAll('.model-select-wrapper');
    wrappers.forEach(w => {
      const dropdown = w.querySelector('.model-select-dropdown');
      if (dropdown && !w.contains(e.target)) {
        dropdown.classList.remove('open');
        const arrow = w.querySelector('.arrow');
        if (arrow) arrow.classList.remove('open');
      }
    });
  });

  async function fetchAndRender() {
    const config = ArcUI.state.config;
    if (!config.baseUrl || !config.apiKey) {
      ArcUI.state.availableModels = [];
      renderCustomDropdown();
      return;
    }

    try {
      const models = await ArcUI.api.fetchModels();
      ArcUI.state.availableModels = models;

      if (ArcUI.state.config.model && !models.find(m => m.id === ArcUI.state.config.model)) {
        if (models.length > 0) {
          ArcUI.state.config.model = models[0].id;
          localStorage.setItem('arcui_model', models[0].id);
        }
      }

      if (!ArcUI.state.config.model && models.length > 0) {
        ArcUI.state.config.model = models[0].id;
        localStorage.setItem('arcui_model', models[0].id);
      }

      renderCustomDropdown();
      ArcUI.multimodal.toggleToolbar();
    } catch (err) {
      console.warn('[ModelSelector] Failed to fetch models:', err);
      ArcUI.state.availableModels = [];
      renderCustomDropdown(true);
    }
  }

  function renderCustomDropdown(manualMode) {
    var container = document.getElementById('model-selector-container');
    if (!container) return;

    var currentModel = ArcUI.state.config.model || '';
    var models = ArcUI.state.availableModels;
    var i18nModel = ArcUI.i18n.t('model'); // "模型" (zh) or "Model" (en)

    // Plain text display: "模型：deepseek-v4-flash" or "Model: deepseek-v4-flash"
    // Click to open a popup for switching models
    var displayText = currentModel || (ArcUI.i18n.t('noModel') || 'None');
    var hasModels = models && models.length > 0;

    var modelsListHtml = '';
    if (hasModels) {
      modelsListHtml = models.map(function (m) {
        var sel = (m.id === currentModel) ? ' selected' : '';
        var vt = m.vision ? ' [' + ArcUI.i18n.t('vision') + ']' : '';
        var at = m.audio ? ' [' + ArcUI.i18n.t('audio') + ']' : '';
        return '<div class="model-select-option' + sel + '" data-model="' +
          ArcUI.utils.escapeAttr(m.id) +
          '" onclick="ArcUI.modelSelector.switchModel(\'' +
          ArcUI.utils.escapeAttr(m.id) + '\')">' +
          ArcUI.utils.escapeHtml(m.id) + vt + at + '</div>';
      }).join('');
    } else {
      // Show a manual input option
      modelsListHtml = '<div class="model-select-option manual" onclick="ArcUI.modelSelector.showManualInput()">' +
        ArcUI.i18n.t('enterManually') + '</div>';
      if (currentModel) {
        modelsListHtml += '<div class="model-select-option selected" data-model="' +
          ArcUI.utils.escapeAttr(currentModel) +
          '" onclick="ArcUI.modelSelector.switchModel(\'' +
          ArcUI.utils.escapeAttr(currentModel) + '\')">' +
          ArcUI.utils.escapeHtml(currentModel) + ' (' + (ArcUI.i18n.t('current') || 'current') + ')</div>';
      }
    }

    container.innerHTML =
      '<div class="model-selector-wrapper" id="model-custom-wrapper">' +
      '<span class="model-text-label" onclick="ArcUI.modelSelector.toggleModelPopup()" title="' + ArcUI.i18n.t('switchModel') + '">' +
      ArcUI.utils.escapeHtml(i18nModel) + '：' + ArcUI.utils.escapeHtml(displayText) +
      '</span>' +
      '<div class="model-select-dropdown" id="model-dropdown">' +
      modelsListHtml +
      '</div>' +
      '</div>';
  }

  /** Show a manual model name input inline */
  function showManualInput() {
    var container = document.getElementById('model-selector-container');
    if (!container) return;
    var currentModel = ArcUI.state.config.model || '';
    container.innerHTML =
      '<div class="model-selector-wrapper">' +
      '<span class="model-text-label">' + ArcUI.utils.escapeHtml(ArcUI.i18n.t('model')) + '：</span>' +
      '<input type="text" class="model-manual-input" id="model-manual-input" ' +
      'value="' + ArcUI.utils.escapeAttr(currentModel) + '" placeholder="gpt-4o" ' +
      'onkeydown="if(event.key===\'Enter\')ArcUI.modelSelector.switchModel(this.value)" />' +
      '<button class="btn btn-sm" onclick="var inp=document.getElementById(\'model-manual-input\');if(inp)ArcUI.modelSelector.switchModel(inp.value)">OK</button>' +
      '</div>';
    setTimeout(function () {
      var inp = document.getElementById('model-manual-input');
      if (inp) inp.focus();
    }, 50);
  }

  /** Toggle the model popup dropdown */
  function toggleModelPopup() {
    var dropdown = document.getElementById('model-dropdown');
    if (!dropdown) return;
    dropdown.classList.toggle('open');
  }

  function closeModelDropdown() {
    var dropdown = document.getElementById('model-dropdown');
    if (dropdown) dropdown.classList.remove('open');
  }

  function toggleCustomDropdown() {
    const dropdown = document.getElementById('model-dropdown');
    const arrow = document.getElementById('model-arrow');
    if (!dropdown) return;
    const isOpen = !dropdown.classList.contains('open');
    dropdown.classList.toggle('open', isOpen);
    if (arrow) arrow.classList.toggle('open', isOpen);
  }

  function closeCustomDropdown() {
    const dropdown = document.getElementById('model-dropdown');
    const arrow = document.getElementById('model-arrow');
    if (dropdown) dropdown.classList.remove('open');
    if (arrow) arrow.classList.remove('open');
  }

  function switchModel(modelId) {
    if (!modelId) return;

    ArcUI.state.config.model = modelId;
    localStorage.setItem('arcui_model', modelId);

    const modelInfo = ArcUI.state.availableModels.find(m => m.id === modelId);
    if (!modelInfo) {
      const caps = ArcUI.multimodal.detectCapabilities(modelId);
      ArcUI.state.availableModels = [{
        id: modelId,
        vision: caps.vision,
        audio: caps.audio,
      }];
    }

    ArcUI.multimodal.toggleToolbar();
    closeCustomDropdown();

    // Update assistant name if follow model setting is on
    if (ArcUI.state.aiNameFollowModel) {
      ArcUI.state.assistantName = modelId;
      const display = document.getElementById('assistant-name-display');
      if (display) display.textContent = modelId;
      ArcUI.chat.renderMessages(ArcUI.state.currentChatId);
    }

    // Re-render to show updated selection
    renderCustomDropdown();

    ArcUI.utils.showToast(`${ArcUI.i18n.t('model')}: ${modelId}`, '');
  }

  function load() {
    const saved = localStorage.getItem('arcui_model');
    if (saved) {
      ArcUI.state.config.model = saved;
    }
  }

  // Expose
  ArcUI.modelSelector = {
    fetchAndRender,
    switchModel,
    renderDropdown: renderCustomDropdown,
    renderCustomDropdown,
    toggleCustomDropdown,
    closeCustomDropdown,
    load,
  };
})();
