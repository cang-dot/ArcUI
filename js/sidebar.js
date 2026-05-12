/* ArcUI - sidebar.js */
/* Sidebar: chat history list, search/filter, highlight, new conversation, settings */

(function () {
  'use strict';

  const ArcUI = window.ArcUI;

  // Local cache of the desktop pinned state
  let desktopPinned = localStorage.getItem('arcui_sidebar_pinned') === '1';

  /**
   * Toggle sidebar open/closed.
   * On desktop (<768px NOT), use a pinned/expanded state.
   * On mobile, use overlay.
   */
  function toggle() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (!sidebar) return;

    if (window.innerWidth >= 768) {
      desktopPinned = !desktopPinned;
      sidebar.classList.toggle('collapsed', !desktopPinned);
      localStorage.setItem('arcui_sidebar_pinned', desktopPinned ? '1' : '0');
      if (overlay) overlay.classList.remove('open');
    } else {
      const isOpen = sidebar.classList.toggle('open');
      if (overlay) overlay.classList.toggle('open', isOpen);
    }
  }

  /**
   * Close the sidebar (mobile only).
   */
  function close() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
  }

  /** ensure desktop sidebar matches the stored state on load */
  function initDesktopState() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    if (window.innerWidth >= 768) {
      sidebar.classList.toggle('collapsed', !desktopPinned);
    }
  }

  // Listen for window resize to re-apply
  window.addEventListener('resize', () => {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    if (window.innerWidth >= 768) {
      sidebar.classList.toggle('collapsed', !desktopPinned);
      sidebar.classList.remove('open');
      const overlay = document.getElementById('sidebar-overlay');
      if (overlay) overlay.classList.remove('open');
    } else {
      sidebar.classList.remove('collapsed');
    }
  });

  /**
   * Render the chat history list in the sidebar.
   * Applies current search filter if any.
   */
  function renderChatHistory() {
    const listEl = document.getElementById('sidebar-list');
    if (!listEl) return;

    const chats = ArcUI.state.chatHistory;
    const ids = Object.keys(chats);
    const searchInput = document.getElementById('sidebar-search');
    const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

    const filtered = ids.filter(id => {
      if (!query) return true;
      const chat = chats[id];
      return (chat.title || '').toLowerCase().includes(query);
    });

    filtered.sort((a, b) => (chats[b].timestamp || 0) - (chats[a].timestamp || 0));

    if (filtered.length === 0) {
      listEl.innerHTML = `<div class="sidebar-empty">${ArcUI.i18n.t('noChats')}</div>`;
      renderBottom();
      return;
    }

    listEl.innerHTML = filtered.map(id => {
      const chat = chats[id];
      const isActive = id === ArcUI.state.currentChatId;
      const title = ArcUI.utils.escapeHtml(chat.title || ArcUI.i18n.t('newChat'));

      let displayTitle = title;
      if (query) {
        const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${escapedQuery})`, 'gi');
        displayTitle = title.replace(regex, '<mark class="search-highlight">$1</mark>');
      }

      const time = chat.timestamp ? formatTime(chat.timestamp) : '';

      // Prevent the delete button from triggering a chat switch by stopping propagation
      return `
        <div class="sidebar-item ${isActive ? 'active' : ''}" data-chat-id="${id}" onclick="ArcUI.sidebar.switchChat('${id}')">
          <span class="sidebar-item-title">${displayTitle}</span>
          <span class="sidebar-item-time">${time}</span>
          <button class="sidebar-item-delete" onclick="event.stopPropagation();ArcUI.sidebar.deleteChat('${id}')" title="${ArcUI.i18n.t('deleteChat')}">×</button>
        </div>
      `;
    }).join('');

    renderBottom();
  }

  function renderBottom() {
    const bottom = document.getElementById('sidebar-bottom');
    if (!bottom) return;
    bottom.innerHTML = `
      <button class="sidebar-bottom-btn" onclick="ArcUI.sidebar.newChat()" title="${ArcUI.i18n.t('newChat')} (Ctrl+N)">
        <span class="sidebar-bottom-btn-icon">+</span>
        <span class="sidebar-bottom-btn-text">${ArcUI.i18n.t('newChat')}</span>
      </button>
      <button class="sidebar-bottom-btn" onclick="ArcUI.sidebar.showUsernameModal()" title="${ArcUI.i18n.t('editNames')}">
        <span class="sidebar-bottom-btn-icon">@</span>
        <span class="sidebar-bottom-btn-text">${ArcUI.i18n.t('editNames')}</span>
      </button>
      <button class="sidebar-bottom-btn" onclick="ArcUI.settings.show()" title="${ArcUI.i18n.t('settings')}">
        <span class="sidebar-bottom-btn-icon">#</span>
        <span class="sidebar-bottom-btn-text">${ArcUI.i18n.t('settings')}</span>
      </button>
    `;
  }

  /**
   * Switch to a different chat by ID.
   */
  function switchChat(chatId) {
    if (ArcUI.state.isProcessing) return;

    ArcUI.state.currentChatId = chatId;
    localStorage.setItem('arcui_current_chat_id', chatId);

    ArcUI.chat.renderMessages(chatId);
    renderChatHistory();
    close();
  }

  /**
   * Create a new conversation.
   */
  function newChat() {
    if (ArcUI.state.isProcessing) return;

    const id = ArcUI.utils.generateId();
    const chat = {
      title: ArcUI.i18n.t('newChat'),
      messages: [],
      timestamp: Date.now(),
    };

    ArcUI.state.chatHistory[id] = chat;
    ArcUI.state.currentChatId = id;

    saveHistory();
    ArcUI.chat.renderMessages(id);
    renderChatHistory();
    close();

    const input = document.getElementById('chat-input');
    if (input) input.focus();
  }

  /**
   * Delete a chat from history.
   */
  function deleteChat(chatId) {
    if (!confirm(ArcUI.i18n.t('confirmDeleteChat'))) return;

    // Try to remove the FactARC associated data
    try {
      localStorage.removeItem('arcui_factarc_conv_' + chatId);
    } catch (_) { /* ignore */ }

    delete ArcUI.state.chatHistory[chatId];

    if (ArcUI.state.currentChatId === chatId) {
      const remaining = Object.keys(ArcUI.state.chatHistory);
      if (remaining.length > 0) {
        ArcUI.state.currentChatId = remaining[0];
        ArcUI.chat.renderMessages(remaining[0]);
      } else {
        const newId = ArcUI.utils.generateId();
        ArcUI.state.chatHistory[newId] = {
          title: ArcUI.i18n.t('newChat'),
          messages: [],
          timestamp: Date.now(),
        };
        ArcUI.state.currentChatId = newId;
        ArcUI.chat.renderMessages(newId);
      }
    }

    saveHistory();
    renderChatHistory();
  }

  /**
   * Show username / assistant name edit modal.
   */
  function showUsernameModal() {
    const modal = document.getElementById('username-modal');
    if (!modal) return;

    document.getElementById('username-input').value = ArcUI.state.userName;
    document.getElementById('assistantname-input').value = ArcUI.state.assistantName;

    // Load checkbox state and apply disable logic
    var aiNameFollowEl = document.getElementById('ai-name-follow-model');
    if (aiNameFollowEl) {
      aiNameFollowEl.checked = ArcUI.state.aiNameFollowModel;
      // Disable assistant name input when AI name follows model
      var assistantInput = document.getElementById('assistantname-input');
      if (assistantInput) {
        assistantInput.disabled = ArcUI.state.aiNameFollowModel;
        if (ArcUI.state.aiNameFollowModel && ArcUI.state.config.model) {
          assistantInput.value = ArcUI.state.config.model;
        }
      }
      // Listen for checkbox changes to toggle input state
      aiNameFollowEl.onchange = function () {
        var inp = document.getElementById('assistantname-input');
        if (inp) {
          inp.disabled = aiNameFollowEl.checked;
          if (aiNameFollowEl.checked && ArcUI.state.config.model) {
            inp.value = ArcUI.state.config.model;
          } else {
            inp.value = ArcUI.state.assistantName;
          }
        }
      };
    }

    modal.style.display = 'flex';
  }

  function hideUsernameModal() {
    const modal = document.getElementById('username-modal');
    if (modal) modal.style.display = 'none';
  }

  function saveUsernames() {
    const userInput = document.getElementById('username-input');
    const assistantInput = document.getElementById('assistantname-input');
    const aiNameFollowEl = document.getElementById('ai-name-follow-model');

    if (userInput) {
      ArcUI.state.userName = userInput.value.trim() || 'User';
      localStorage.setItem('arcui_username', ArcUI.state.userName);
    }
    if (assistantInput && !ArcUI.state.aiNameFollowModel) {
      ArcUI.state.assistantName = assistantInput.value.trim() || 'ArcUI';
      localStorage.setItem('arcui_assistant_name', ArcUI.state.assistantName);
    }
    if (aiNameFollowEl) {
      ArcUI.state.aiNameFollowModel = aiNameFollowEl.checked;
      localStorage.setItem('arcui_ai_name_follow_model', ArcUI.state.aiNameFollowModel ? '1' : '0');
    }

    // Apply AI name follow model if enabled
    updateAssistantNameDisplay();

    hideUsernameModal();
    ArcUI.chat.renderMessages(ArcUI.state.currentChatId);
    renderChatHistory();
  }

  /**
   * Update the assistant name display based on follow-model setting.
   */
  function updateAssistantNameDisplay() {
    const display = document.getElementById('assistant-name-display');
    if (!display) return;

    if (ArcUI.state.aiNameFollowModel && ArcUI.state.config.model) {
      ArcUI.state.assistantName = ArcUI.state.config.model;
      display.textContent = ArcUI.state.config.model;
    } else {
      display.textContent = ArcUI.state.assistantName;
    }
  }

  /**
   * Format a timestamp for sidebar display.
   */
  function formatTime(ts) {
    const d = new Date(ts);
    const now = new Date();
    const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return ArcUI.i18n.t('yesterday') || 'Yesterday';
    } else if (diffDays < 7) {
      return d.toLocaleDateString([], { weekday: 'short' });
    } else {
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  }

  /**
   * Save chat history to localStorage.
   */
  function saveHistory() {
    try {
      localStorage.setItem('arcui_chat_history', JSON.stringify(ArcUI.state.chatHistory));
    } catch (e) {
      console.warn('[Sidebar] Failed to save chat history:', e);
    }
  }

  /**
   * Load chat history from localStorage.
   */
  function loadHistory() {
    try {
      const raw = localStorage.getItem('arcui_chat_history');
      if (raw) {
        const parsed = JSON.parse(raw);
        // Remove legacy __thinking__ artifacts if any
        for (const id of Object.keys(parsed)) {
          if (parsed[id].messages) {
            parsed[id].messages = parsed[id].messages.filter(m => m.id !== '__thinking__');
          }
        }
        ArcUI.state.chatHistory = parsed;
      }
    } catch (e) {
      console.warn('[Sidebar] Failed to load chat history:', e);
    }

    const lastId = localStorage.getItem('arcui_current_chat_id');
    if (lastId && ArcUI.state.chatHistory[lastId]) {
      ArcUI.state.currentChatId = lastId;
    } else if (Object.keys(ArcUI.state.chatHistory).length > 0) {
      ArcUI.state.currentChatId = Object.keys(ArcUI.state.chatHistory)[0];
    } else {
      const id = ArcUI.utils.generateId();
      ArcUI.state.chatHistory[id] = {
        title: ArcUI.i18n.t('newChat'),
        messages: [],
        timestamp: Date.now(),
      };
      ArcUI.state.currentChatId = id;
    }

    // Load custom names
    ArcUI.state.userName = localStorage.getItem('arcui_user_name') || 'User';
    ArcUI.state.assistantName = localStorage.getItem('arcui_assistant_name') || 'ArcUI';
    ArcUI.state.aiNameFollowModel = localStorage.getItem('arcui_ai_name_follow_model') === '1';
    ArcUI.state.bochaKey = localStorage.getItem('arcui_bocha_key') || '';

    // Update assistant name display
    updateAssistantNameDisplay();
  }

  // Expose
  ArcUI.sidebar = {
    toggle,
    close,
    initDesktopState,
    renderChatHistory,
    switchChat,
    newChat,
    deleteChat,
    onSearchInput() { renderChatHistory(); },
    clearSearch() {
      const input = document.getElementById('sidebar-search');
      if (input) { input.value = ''; renderChatHistory(); }
    },
    saveHistory,
    loadHistory,
    showUsernameModal,
    hideUsernameModal,
    saveUsernames,
  };
})();
