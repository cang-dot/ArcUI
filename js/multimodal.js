/* ArcUI - multimodal.js */
/* Multimodal: capability detection, image upload/preview/drag-drop, audio recording */

(function () {
  'use strict';

  const ArcUI = window.ArcUI;

  /**
   * Detect multimodal capabilities from model ID.
   * @param {string} modelId
   * @returns {{vision: boolean, audio: boolean}}
   */
  function detectCapabilities(modelId) {
    if (!modelId) return { vision: false, audio: false };

    const id = modelId.toLowerCase();
    const visionKeywords = [
      'vision', 'vl', 'gpt-4o', 'gpt-4-turbo', 'gemini-pro-vision',
      'claude-3', 'qwenvl', 'glm-4v', 'yi-vision', 'multimodal',
    ];
    const audioKeywords = [
      'audio', 'whisper', 'speech', 'gpt-4o', 'realtime',
    ];

    return {
      vision: visionKeywords.some(k => id.includes(k)),
      audio: audioKeywords.some(k => id.includes(k)),
    };
  }

  /**
   * Handle image upload from file input.
   * @param {Event} event - Change event from file input
   */
  async function handleImageUpload(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      await processImageFile(file);
    }

    // Reset input so the same file can be re-selected
    event.target.value = '';

    toggleToolbar();
    renderPreview();
  }

  /**
   * Handle images pasted from clipboard.
   * @param {ClipboardEvent} event
   */
  async function handleClipboardPaste(event) {
    const items = event.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        event.preventDefault();
        const file = item.getAsFile();
        await processImageFile(file);
      }
    }

    toggleToolbar();
    renderPreview();
  }

  /**
   * Process an image file: resize and convert to base64.
   * @param {File} file
   */
  async function processImageFile(file) {
    try {
      const base64 = await resizeAndConvert(file);
      ArcUI.state.currentAttachments.push({
        type: 'image',
        base64: base64,
        filename: file.name,
        size: file.size,
      });
    } catch (err) {
      console.error('[Multimodal] Failed to process image:', err);
      ArcUI.utils.showToast('Failed to process image', 'error');
    }
  }

  /**
   * Resize image to max 2048px width and convert to base64 data URL.
   * @param {File} file
   * @returns {Promise<string>} base64 data URL
   */
  function resizeAndConvert(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;
          const MAX_WIDTH = 2048;

          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          const dataUrl = canvas.toDataURL(file.type || 'image/png', 0.85);
          resolve(dataUrl);
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  /**
   * Render attachment previews in the toolbar area.
   */
  function renderPreview() {
    const container = document.getElementById('attachment-previews');
    if (!container) return;

    const attachments = ArcUI.state.currentAttachments;

    if (attachments.length === 0) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = attachments.map((att, index) => {
      if (att.type === 'image') {
        return `
          <div class="attachment-preview" title="${ArcUI.utils.escapeHtml(att.filename || 'Image')}">
            <img src="${att.base64}" alt="Preview" />
            <button class="attachment-remove" onclick="ArcUI.multimodal.removeAttachment(${index})" title="${ArcUI.i18n.t('close')}">&times;</button>
          </div>
        `;
      }
      return '';
    }).join('');
  }

  /**
   * Remove an attachment by index.
   * @param {number} index
   */
  function removeAttachment(index) {
    ArcUI.state.currentAttachments.splice(index, 1);
    renderPreview();
    toggleToolbar();
  }

  /**
   * Show or hide the multimodal toolbar based on current model capabilities and attachments.
   */
  function toggleToolbar() {
    const toolbar = document.getElementById('multimodal-toolbar');
    if (!toolbar) return;

    const currentModel = ArcUI.state.availableModels.find(m => m.id === ArcUI.state.config.model);
    const hasVision = currentModel ? currentModel.vision : false;
    const hasAttachments = ArcUI.state.currentAttachments.length > 0;

    if (hasVision || hasAttachments) {
      toolbar.style.display = 'flex';
    } else {
      toolbar.style.display = 'none';
      // Also clear any lingering attachments if model can't handle them
      if (!hasVision && hasAttachments) {
        ArcUI.state.currentAttachments = [];
        renderPreview();
      }
    }
  }

  /**
   * Set up drag-and-drop listeners on the chat container.
   */
  function setupDragDrop() {
    const dropZone = document.getElementById('chat-container');
    if (!dropZone) return;

    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('drag-over');

      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;

      for (const file of files) {
        if (file.type.startsWith('image/')) {
          await processImageFile(file);
        }
      }

      toggleToolbar();
      renderPreview();
    });
  }

  /**
   * Set up clipboard paste listener on the input area.
   */
  function setupClipboardPaste() {
    const input = document.getElementById('chat-input');
    if (!input) return;

    input.addEventListener('paste', handleClipboardPaste);
  }

  /**
   * Trigger the hidden file input for image selection.
   */
  function triggerFileInput() {
    const fileInput = document.getElementById('multimodal-file-input');
    if (fileInput) {
      fileInput.click();
    }
  }

  // Expose
  ArcUI.multimodal = {
    detectCapabilities,
    handleImageUpload,
    renderPreview,
    removeAttachment,
    toggleToolbar,
    setupDragDrop,
    setupClipboardPaste,
    triggerFileInput,
  };
})();
