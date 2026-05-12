/* ArcUI - chat.js */
/* Chat: send/receive messages, render messages, copy/edit/retry, branch logic */

(function () {
  'use strict';

  const ArcUI = window.ArcUI;

  // Keep track of which user message is being edited in-line.
  // message-edit-<msgId> -> { chatId, msgId }
  const activeEdits = {};

  /**
   * Send a user message and get AI response.
   * @param {string} [text] - Message text. If not provided, reads from input.
   */
  async function sendMessage(text) {
    if (ArcUI.state.isProcessing) return;

    const input = document.getElementById('chat-input');
    const query = text || (input ? input.value.trim() : '');
    if (!query && ArcUI.state.currentAttachments.length === 0) return;

    // Clear input
    if (input) input.value = '';

    const chatId = ensureChat();
    if (!chatId) return;

    const chat = ArcUI.state.chatHistory[chatId];

    // Build user message
    const userMsgContent = buildUserContent(query);

    const userMessage = {
      id: ArcUI.utils.generateId(),
      role: 'user',
      content: userMsgContent,
      rawText: query,        // plain text for branch edits
      timestamp: Date.now(),
    };

    // Plugin hook: message.beforeSend
    let messagesToSend = buildMessagesArray(chatId, userMessage);
    if (ArcUI.plugins && ArcUI.plugins.manager) {
      try {
        const result = await ArcUI.plugins.manager.dispatchHook('message.beforeSend', {
          query,
          messages: messagesToSend,
          config: ArcUI.state.config,
        });
        if (result && result.messages) messagesToSend = result.messages;
      } catch (e) {
        console.warn('[Chat] plugin hook beforeSend failed:', e);
      }
    }

    // Add user message
    addMessage(chatId, userMessage);
    renderMessages(chatId);

    // Update chat title from first user message
    if (chat.messages.filter(m => m.role === 'user').length === 1) {
      chat.title = query.substring(0, 40) + (query.length > 40 ? '...' : '');
      ArcUI.sidebar.saveHistory();
      ArcUI.sidebar.renderChatHistory();
    }

    // Helper to list the last-key messages needed for context (keeps all history)
    await streamAssistantResponse(chatId);
  }

  /**
   * Stream the assistant's response, handling the full lifecycle.
   */
  async function streamAssistantResponse(chatId) {
    ArcUI.state.isProcessing = true;

    // If correction is enabled, use the correction pipeline (non-streaming)
    if (ArcUI.state.correctionEnabled && ArcUI.correction) {
      await streamAssistantResponseWithCorrection(chatId);
      return;
    }

    const thinkingMsg = addAssistantPlaceholder(chatId);
    renderMessages(chatId);

    const config = ArcUI.state.config;
    const endpoint = `${config.baseUrl}/chat/completions`;
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    };

    const messagesToSend = buildMessagesArray(chatId, null);
    const body = { model: config.model, messages: messagesToSend, stream: true };

    let assistantContent = '';
    let assistantEl = null;
    const messagesContainer = document.getElementById('chat-messages');

    await ArcUI.stream.streamChat({
      url: endpoint,
      headers,
      body,
      onToken: (token, fullContent) => {
        assistantContent = fullContent;
        if (!assistantEl) {
          assistantEl = messagesContainer?.querySelector('.message.message-assistant:last-of-type .message-bubble');
        }
        if (assistantEl) {
          ArcUI.stream.typewriterRender(assistantEl, assistantContent, false);
        }
      },
      onComplete: async () => {
        removeThinkingIndicator(chatId);

        const assistantMsg = {
          id: ArcUI.utils.generateId(),
          role: 'assistant',
          content: assistantContent || '(empty response)',
          timestamp: Date.now(),
        };

        addMessage(chatId, assistantMsg);
        renderMessages(chatId);

        ArcUI.state.isProcessing = false;

        // Plugin hook: message.afterReceive
        if (ArcUI.plugins && ArcUI.plugins.manager) {
          try {
            await ArcUI.plugins.manager.dispatchHook('message.afterReceive', {
              response: assistantMsg,
              rawData: null,
              isFactARC: false,
            });
          } catch (e) {
            console.warn('[Chat] plugin hook afterReceive failed:', e);
          }
        }
      },
      onError: (err) => {
        removeThinkingIndicator(chatId);
        const errorMsg = {
          id: ArcUI.utils.generateId(),
          role: 'assistant',
          content: `**${ArcUI.i18n.t('errorOccurred')}:** ${ArcUI.utils.escapeHtml(err.message)}`,
          timestamp: Date.now(),
          isError: true,
        };
        addMessage(chatId, errorMsg);
        renderMessages(chatId);
        ArcUI.state.isProcessing = false;
        ArcUI.utils.showToast(err.message, 'error');
      },
      onMeta: () => { /* no-op */ },
    });
  }

  /**
   * Stream assistant response using the correction pipeline.
   */
  async function streamAssistantResponseWithCorrection(chatId) {
    const thinkingMsg = addAssistantPlaceholder(chatId);
    renderMessages(chatId);

    // Build messages array and find the original query
    const messagesToSend = buildMessagesArray(chatId, null);
    // The last user message contains the original query
    let originalQuery = '';
    for (let i = messagesToSend.length - 1; i >= 0; i--) {
      if (messagesToSend[i].role === 'user') {
        originalQuery = typeof messagesToSend[i].content === 'string'
          ? messagesToSend[i].content
          : (messagesToSend[i].content?.find?.(p => p.type === 'text')?.text || '');
        break;
      }
    }

    try {
      const correctedContent = await ArcUI.correction.runCorrectionPipeline(originalQuery, messagesToSend, chatId);

      removeThinkingIndicator(chatId);

      const assistantMsg = {
        id: ArcUI.utils.generateId(),
        role: 'assistant',
        content: correctedContent || '(empty response)',
        timestamp: Date.now(),
      };

      addMessage(chatId, assistantMsg);
      renderMessages(chatId);

      ArcUI.state.isProcessing = false;

      // Plugin hook: message.afterReceive
      if (ArcUI.plugins && ArcUI.plugins.manager) {
        try {
          await ArcUI.plugins.manager.dispatchHook('message.afterReceive', {
            response: assistantMsg,
            rawData: null,
            isFactARC: false,
          });
        } catch (e) {
          console.warn('[Chat] plugin hook afterReceive failed:', e);
        }
      }
    } catch (err) {
      removeThinkingIndicator(chatId);
      if (err.message === 'Aborted') {
        // User aborted correction
        ArcUI.state.isProcessing = false;
        return;
      }
      const errorMsg = {
        id: ArcUI.utils.generateId(),
        role: 'assistant',
        content: `**${ArcUI.i18n.t('errorOccurred')}:** ${ArcUI.utils.escapeHtml(err.message || 'Correction pipeline failed')}`,
        timestamp: Date.now(),
        isError: true,
      };
      addMessage(chatId, errorMsg);
      renderMessages(chatId);
      ArcUI.state.isProcessing = false;
      ArcUI.utils.showToast(err.message || 'Correction failed', 'error');
    }
  }

  /**
   * Send a preset/system message.
   */
  function sendPreset(text) {
    if (text) sendMessage(text);
  }

  function ensureChat() {
    const chatId = ArcUI.state.currentChatId;
    if (!chatId || !ArcUI.state.chatHistory[chatId]) {
      ArcUI.sidebar.newChat();
      return null; // newChat sets state; caller should re-read
    }

    // Wait a tick if newChat was just called
    if (!ArcUI.state.chatHistory[ArcUI.state.currentChatId]) {
      // not yet created; retry once via mutation observer isn't safe — just return the new id
      return null;
    }
    return ArcUI.state.currentChatId;
  }

  /**
   * Build content array for user message.
   */
  function buildUserContent(text) {
    const attachments = ArcUI.state.currentAttachments;

    if (attachments.length === 0) {
      return text;
    }

    const content = [];
    for (const att of attachments) {
      if (att.type === 'image') {
        content.push({ type: 'image_url', image_url: { url: att.base64 } });
      }
    }
    if (text) {
      content.push({ type: 'text', text });
    }

    ArcUI.state.currentAttachments = [];
    const previewContainer = document.getElementById('attachment-previews');
    if (previewContainer) previewContainer.innerHTML = '';
    if (ArcUI.multimodal && ArcUI.multimodal.toggleToolbar) {
      ArcUI.multimodal.toggleToolbar();
    }

    return content;
  }

  /**
   * Build the full messages array for the API call.
   */
  function buildMessagesArray(chatId, newUserMsg) {
    const chat = ArcUI.state.chatHistory[chatId];
    if (!chat) return [];

    const msgs = [...chat.messages.map(m => ({ role: m.role, content: m.content }))];

    // Insert system prompt at position 0
    const systemPrompt = ArcUI.systemPrompt ? ArcUI.systemPrompt.get() : '';
    if (systemPrompt) {
      if (msgs.length > 0 && msgs[0].role === 'system') {
        msgs[0].content = systemPrompt;
      } else {
        msgs.unshift({ role: 'system', content: systemPrompt });
      }
    }

    if (newUserMsg) {
      msgs.push({ role: newUserMsg.role, content: newUserMsg.content });
    }

    return msgs;
  }

  /**
   * Add a message to a chat's history.
   */
  function addMessage(chatId, message) {
    const chat = ArcUI.state.chatHistory[chatId];
    if (!chat) return;
    if (chat.messages.find(m => m.id === message.id)) return;
    chat.messages.push(message);
    chat.timestamp = Date.now();
    ArcUI.sidebar.saveHistory();
  }

  /**
   * Add multiple messages from stored history.
   */
  function addMessageFromHistory(chatId, messages) {
    const chat = ArcUI.state.chatHistory[chatId];
    if (!chat) return;
    for (const msg of messages) {
      if (!chat.messages.find(m => m.id === msg.id)) {
        chat.messages.push(msg);
      }
    }
    chat.timestamp = Date.now();
    ArcUI.sidebar.saveHistory();
    renderMessages(chatId);
  }

  /**
   * Render all messages for the active chat into the DOM.
   */
  function renderMessages(chatId) {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    const chat = ArcUI.state.chatHistory[chatId];
    if (!chat || chat.messages.length === 0) {
      container.innerHTML = `
        <div class="empty-chat">
          <div class="empty-chat-title">${ArcUI.i18n.t('emptyChat')}</div>
          <div class="empty-chat-sub">${ArcUI.i18n.t('emptyChatSub')}</div>
        </div>`;
      return;
    }

    container.innerHTML = chat.messages.map((msg, idx) => renderMessageHTML(msg, chatId, idx)).join('');

    // Plugin hook: message.render
    if (ArcUI.plugins && ArcUI.plugins.manager) {
      const msgElements = container.querySelectorAll('.message');
      chat.messages.forEach((msg, idx) => {
        const el = msgElements[idx];
        if (el) {
          try {
            ArcUI.plugins.manager.dispatchHook('message.render', { message: msg, domElement: el });
          } catch (e) {
            console.warn('[Chat] plugin hook render failed:', e);
          }
        }
      });

      // Plugin hook: message.action — disabled for now; actions are hardcoded
    }

    ArcUI.utils.scrollToBottom();
  }

  /**
   * Render a single message as HTML.
   */
  function renderMessageHTML(msg, chatId, msgIdx) {
    const isUser = msg.role === 'user';
    const isAssistant = msg.role === 'assistant';
    const isError = msg.isError;

    let contentHtml = '';

    if (isUser) {
      if (typeof msg.content === 'string') {
        contentHtml = ArcUI.utils.escapeHtml(msg.content).replace(/</g, '<').replace(/>/g, '>');
        // Actually escapeHtml already handles that. Fine.
        contentHtml = ArcUI.utils.escapeHtml(msg.content);
      } else if (Array.isArray(msg.content)) {
        contentHtml = msg.content.map(part => {
          if (part.type === 'text') {
            return ArcUI.utils.escapeHtml(part.text);
          } else if (part.type === 'image_url') {
            return `<img src="${ArcUI.utils.escapeHtml(part.image_url?.url || '')}" class="message-image" alt="Uploaded image" />`;
          }
          return '';
        }).join('');
      }
    } else if (isAssistant) {
      if (isError) {
        contentHtml = msg.content;
      } else {
        contentHtml = ArcUI.markdown.renderMarkdown(msg.content);
      }
    }

    const cssClass = isUser ? 'message-user' : (isError ? 'message-assistant message-error' : 'message-assistant');
    const roleLabel = isUser ? ArcUI.state.userName : ArcUI.state.assistantName;

    // Actions for user: copy + edit (branch)
    let actionsHtml = '';
    if (isUser) {
      const escapedContent = ArcUI.utils.escapeAttr(typeof msg.content === 'string' ? msg.content : (msg.rawText || ''));
      actionsHtml = `
        <div class="message-actions">
          <button class="message-action-btn" onclick="ArcUI.utils.copyToClipboard('${escapedContent}')">${ArcUI.i18n.t('copy')}</button>
          <button class="message-action-btn" onclick="ArcUI.chat.showBranchEdit('${msg.id}')">${ArcUI.i18n.t('edit')}</button>
        </div>`;
    }

    // Actions for assistant: copy + retry
    let assistantActionsHtml = '';
    if (isAssistant && !isError) {
      const escapedAssistant = ArcUI.utils.escapeAttr(msg.content);
      assistantActionsHtml = `
        <div class="message-actions">
          <button class="message-action-btn" onclick="ArcUI.utils.copyToClipboard('${escapedAssistant}')">${ArcUI.i18n.t('copy')}</button>
          <button class="message-action-btn retry-btn" onclick="ArcUI.chat.retryFrom('${msg.id}')">${ArcUI.i18n.t('retry')}</button>
        </div>`;
    } else if (isError) {
      assistantActionsHtml = `
        <div class="message-actions">
          <button class="message-action-btn retry-btn" onclick="ArcUI.chat.retryFrom('${msg.id}')">${ArcUI.i18n.t('retry')}</button>
        </div>`;
    }

    // Branch edit area
    const branchHtml = isUser ? `
      <div class="branch-edit-area" id="branch-${msg.id}">
        <textarea class="branch-edit-input" id="branch-input-${msg.id}" rows="3"></textarea>
        <div class="branch-edit-actions">
          <button class="btn btn-sm btn-secondary" onclick="ArcUI.chat.cancelBranchEdit('${msg.id}')">${ArcUI.i18n.t('cancel')}</button>
          <button class="btn btn-sm btn-primary" onclick="ArcUI.chat.submitBranchEdit('${msg.id}')">${ArcUI.i18n.t('send')}</button>
        </div>
      </div>` : '';

    return `
      <div class="message ${cssClass}" data-message-id="${msg.id}">
        <div class="message-meta">${roleLabel}</div>
        <div class="message-bubble">${contentHtml}</div>
        ${actionsHtml}
        ${assistantActionsHtml}
        ${branchHtml}
      </div>
    `;
  }

  /**
   * Show the inline branch edit area for a user message.
   */
  function showBranchEdit(msgId) {
    const chatId = ArcUI.state.currentChatId;
    const chat = ArcUI.state.chatHistory[chatId];
    if (!chat) return;

    const msg = chat.messages.find(m => m.id === msgId);
    if (!msg || msg.role !== 'user') return;

    const editArea = document.getElementById('branch-' + msgId);
    const input = document.getElementById('branch-input-' + msgId);
    if (!editArea || !input) return;

    const rawText = msg.rawText || (typeof msg.content === 'string' ? msg.content : '');

    if (editArea.classList.contains('show')) {
      // Toggle off
      editArea.classList.remove('show');
      return;
    }

    // Toggle on
    input.value = rawText;
    editArea.classList.add('show');
    input.focus();
  }

  /**
   * Cancel branch editing.
   */
  function cancelBranchEdit(msgId) {
    const editArea = document.getElementById('branch-' + msgId);
    if (editArea) editArea.classList.remove('show');
  }

  /**
   * Submit a branch edit: re-sends the edited text as a new user message.
   */
  async function submitBranchEdit(msgId) {
    const input = document.getElementById('branch-input-' + msgId);
    if (!input) return;
    const editedText = input.value.trim();
    if (!editedText) return;

    // Hide the edit area
    const editArea = document.getElementById('branch-' + msgId);
    if (editArea) editArea.classList.remove('show');

    // Send as a new message (this naturally creates a branch)
    await sendMessage(editedText);
  }

  /**
   * Retry from an assistant message: go back to the preceding user message
   * and re-send the same query.
   */
  async function retryFrom(assistantMsgId) {
    if (ArcUI.state.isProcessing) return;

    const chatId = ArcUI.state.currentChatId;
    const chat = ArcUI.state.chatHistory[chatId];
    if (!chat) return;

    // Find the index of this assistant message
    const aiIdx = chat.messages.findIndex(m => m.id === assistantMsgId);
    if (aiIdx === -1) return;

    // Find the preceding user message
    let userMsg = null;
    for (let i = aiIdx - 1; i >= 0; i--) {
      if (chat.messages[i].role === 'user') {
        userMsg = chat.messages[i];
        break;
      }
    }
    if (!userMsg) return;

    // Trim messages from the user message onward (remove old AI reply and any subsequent turns)
    const userIdx = chat.messages.indexOf(userMsg);
    chat.messages = chat.messages.slice(0, userIdx + 1);

    // Restore user content
    const query = userMsg.rawText || (typeof userMsg.content === 'string' ? userMsg.content : '');
    ArcUI.sidebar.saveHistory();

    // Re-send
    const input = document.getElementById('chat-input');
    if (input) input.value = query;
    await sendMessage(query);
  }

  /**
   * Render verification trail UI — for plugins to call.
   */
  function renderVerificationTrail(msg) {
    const trails = msg.verificationTrail;
    if (!trails || trails.length === 0) return '';
    const trailId = `trail-${msg.id}`;
    const itemsHtml = trails.map((t, i) => {
      const statusClass = t.status === 'verified' ? 'trail-verified' :
                        t.status === 'failed' ? 'trail-failed' : 'trail-pending';
      return `
        <div class="trail-item ${statusClass}">
          <span class="trail-step">${i + 1}</span>
          <span class="trail-description">${ArcUI.utils.escapeHtml(t.statement || t.description || '')}</span>
          <span class="trail-status">${t.status || 'pending'}</span>
          ${t.source ? `<span class="trail-source">${ArcUI.utils.escapeHtml(t.source)}</span>` : ''}
        </div>`;
    }).join('');
    return `
      <div class="verification-trail">
        <div class="trail-header" onclick="ArcUI.chat.toggleTrail('${trailId}')">
          <span class="trail-toggle" id="${trailId}-toggle">▶</span>
          <span>${ArcUI.i18n.t('verificationTrail')} (${trails.length})</span>
        </div>
        <div class="trail-body" id="${trailId}" style="display:none;">${itemsHtml}</div>
      </div>`;
  }

  function toggleTrail(trailId) {
    const body = document.getElementById(trailId);
    const toggle = document.getElementById(trailId + '-toggle');
    if (!body || !toggle) return;
    const isVisible = body.style.display !== 'none';
    body.style.display = isVisible ? 'none' : 'block';
    toggle.textContent = isVisible ? '▶' : '▼';
  }

  function addAssistantPlaceholder(chatId) {
    const msg = {
      id: '__thinking__',
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isPlaceholder: true,
    };
    addMessage(chatId, msg);
    return msg;
  }

  function removeThinkingIndicator(chatId) {
    const chat = ArcUI.state.chatHistory[chatId];
    if (!chat) return;
    chat.messages = chat.messages.filter(m => m.id !== '__thinking__');
  }

  // Expose
  ArcUI.chat = {
    sendMessage,
    sendPreset,
    addMessage,
    addMessageFromHistory,
    renderMessages,
    renderVerificationTrail,
    toggleTrail,
    showBranchEdit,
    cancelBranchEdit,
    submitBranchEdit,
    retryFrom,
  };
})();
