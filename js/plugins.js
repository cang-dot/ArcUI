/* ArcUI - plugins.js */
/* Plugin runtime: PluginManager class, loading, hooks, sandbox, Python bridge */

(function () {
  'use strict';

  const ArcUI = window.ArcUI;

  /**
   * PluginManager class.
   * Manages plugin lifecycle, hook registration/dispatch, Python capability calls.
   */
  class PluginManager {
    constructor() {
      /** @type {Array<{id: string, meta: object, instance: object, config: object, enabled: boolean}>} */
      this.plugins = [];
      /** @type {Map<string, Array<{plugin: string, callback: Function}>>} */
      this.hooks = new Map();
      /** @type {Map<string, Array<Function>>} */
      this.events = new Map();

      // Shared sandbox context for all plugins
      this.context = {
        fetch: this._fetch.bind(this),
        callPython: this._callPython.bind(this),
        audio: {
          playFromBase64: (b64) => ArcUI.tts.playFromBase64(b64),
          playBlob: (blob) => ArcUI.tts.playBlob(blob),
          speakBrowser: (text) => ArcUI.tts.speakBrowser(text),
        },
        storage: {
          get: (key) => {
            try { return JSON.parse(localStorage.getItem('arcui_plugin_' + key)); } catch { return null; }
          },
          set: (key, value) => {
            localStorage.setItem('arcui_plugin_' + key, JSON.stringify(value));
          },
          remove: (key) => {
            localStorage.removeItem('arcui_plugin_' + key);
          },
        },
        notify: (message, type) => {
          ArcUI.utils.showToast(message, type || '');
        },
        getLanguage: () => ArcUI.state.currentLang,
        getConfig: () => ({ ...ArcUI.state.config }),
        on: this._on.bind(this),
        emit: this._emit.bind(this),
      };
    }

    /**
     * Build a list of known plugins. In prototype, we scan a hardcoded list.
     * @returns {Array<{id: string}>}
     */
    getAvailablePlugins() {
      return [
        { id: 'arcui-tts' },
        { id: 'arcui-factarc' },
      ];
    }

    /**
     * Get a plugin record by ID.
     * @param {string} pluginId
     * @returns {object|null} The plugin record or null
     */
    getPlugin(pluginId) {
      return this.plugins.find(function (p) { return p.id === pluginId; }) || null;
    }

    /**
     * Load all available plugins.
     */
    async loadAll() {
      const available = this.getAvailablePlugins();

      for (const info of available) {
        try {
          await this.loadPlugin(info.id);
        } catch (e) {
          console.warn(`[PluginManager] Failed to load plugin "${info.id}":`, e.message);
        }
      }

      // Initialize all loaded plugins with their saved config
      for (const p of this.plugins) {
        await this._initPlugin(p);
      }
    }

    /**
     * Load a single plugin by ID.
     * @param {string} pluginId
     */
    async loadPlugin(pluginId) {
      // Check if already loaded
      if (this.plugins.find(p => p.id === pluginId)) {
        console.warn(`[PluginManager] Plugin "${pluginId}" is already loaded.`);
        return;
      }

      // Fetch plugin.json
      let meta;
      try {
        const resp = await fetch(`plugins/${pluginId}/plugin.json`);
        if (!resp.ok) throw new Error(`Failed to load plugin.json (${resp.status})`);
        meta = await resp.json();
      } catch (e) {
        throw new Error(`Cannot load plugin.json for "${pluginId}": ${e.message}`);
      }

      // Validate meta
      if (!meta.id || !meta.name) {
        throw new Error(`Invalid plugin.json for "${pluginId}": missing id or name`);
      }

      // Fetch and evaluate plugin.js
      let PluginClass;
      try {
        const resp = await fetch(`plugins/${pluginId}/plugin.js`);
        if (!resp.ok) throw new Error(`Failed to load plugin.js (${resp.status})`);
        const code = await resp.text();

        // Execute in a sandboxed Function constructor
        const sandboxEval = new Function('context', 'PluginManager', 'ArcUI', `
          return (function() {
            ${code}
            return typeof Plugin !== 'undefined' ? Plugin : null;
          })();
        `);
        PluginClass = sandboxEval(this.context, this, ArcUI);
      } catch (e) {
        throw new Error(`Cannot load plugin.js for "${pluginId}": ${e.message}`);
      }

      if (!PluginClass) {
        throw new Error(`plugin.js for "${pluginId}" does not export a Plugin class.`);
      }

      // Load saved config
      const savedConfig = JSON.parse(localStorage.getItem(`arcui_plugin_config_${pluginId}`) || '{}');

      // Load enabled state
      const savedEnabled = localStorage.getItem(`arcui_plugin_enabled_${pluginId}`);
      const enabled = savedEnabled !== null ? savedEnabled === 'true' : true; // Default enabled

      // Create plugin instance
      const instance = new PluginClass(this.context);

      // Store plugin meta
      if (!instance.constructor.meta) {
        instance.constructor.meta = { id: meta.id, name: meta.name, version: meta.version || '0.0.0' };
      }

      const pluginRecord = {
        id: meta.id,
        meta: meta,
        instance: instance,
        config: savedConfig,
        enabled: enabled,
      };

      this.plugins.push(pluginRecord);
    }

    /**
     * Initialize a loaded plugin with its config.
     */
    async _initPlugin(pluginRecord) {
      if (!pluginRecord.enabled) return;

      // Track which plugin is active so _callPython knows the caller
      this._currentPluginId = pluginRecord.id;

      try {
        if (typeof pluginRecord.instance.init === 'function') {
          await pluginRecord.instance.init(pluginRecord.config);
        }
      } catch (e) {
        console.warn(`[PluginManager] Plugin "${pluginRecord.id}" init failed:`, e);
      }

      // Register hooks
      try {
        if (typeof pluginRecord.instance.registerHooks === 'function') {
          pluginRecord.instance.registerHooks(new HookRegistry(this, pluginRecord.id));
        }
      } catch (e) {
        console.warn(`[PluginManager] Plugin "${pluginRecord.id}" hook registration failed:`, e);
      }

      this._currentPluginId = null;
    }

    /**
     * Install a plugin manually (from user-provided files).
     * In prototype, this simply stores config for re-load on next boot.
     * @param {string} pluginId
     * @param {object} files - {plugin_json: string, plugin_js: string, capability_py?: string}
     */
    async installPlugin(pluginId, files) {
      // Store files in localStorage for persistence
      localStorage.setItem(`arcui_plugin_files_${pluginId}`, JSON.stringify(files));
      localStorage.setItem(`arcui_plugin_enabled_${pluginId}`, 'true');

      // Try to load it now
      await this.loadPlugin(pluginId);
      const p = this.plugins.find(p => p.id === pluginId);
      if (p) {
        await this._initPlugin(p);
      }
    }

    /**
     * Update plugin config.
     * @param {string} pluginId
     * @param {object} config
     */
    async updateConfig(pluginId, config) {
      const p = this.plugins.find(p => p.id === pluginId);
      if (!p) throw new Error(`Plugin "${pluginId}" not found.`);

      p.config = { ...p.config, ...config };
      localStorage.setItem(`arcui_plugin_config_${pluginId}`, JSON.stringify(p.config));

      // Re-init with new config
      if (typeof p.instance.init === 'function') {
        await p.instance.init(p.config);
      }

      ArcUI.utils.showToast(`${pluginId}: config updated`, '');
    }

    /**
     * Enable or disable a plugin.
     * @param {string} pluginId
     * @param {boolean} enabled
     */
    async setEnabled(pluginId, enabled) {
      const p = this.plugins.find(p => p.id === pluginId);
      if (!p) throw new Error(`Plugin "${pluginId}" not found.`);

      p.enabled = enabled;
      localStorage.setItem(`arcui_plugin_enabled_${pluginId}`, String(enabled));

      if (enabled) {
        await this._initPlugin(p);
      } else {
        // Destroy the plugin
        if (typeof p.instance.destroy === 'function') {
          try { await p.instance.destroy(); } catch (e) { /* ignore */ }
        }
        // Remove its hooks
        this._unregisterAllHooks(pluginId);
      }
    }

    /**
     * Uninstall a plugin completely.
     * @param {string} pluginId
     */
    async uninstallPlugin(pluginId) {
      const p = this.plugins.find(p => p.id === pluginId);
      if (!p) return;

      // Disable first (which destroys and unregisters hooks)
      await this.setEnabled(pluginId, false);

      // Remove from list
      this.plugins = this.plugins.filter(p => p.id !== pluginId);

      // Clear storage
      localStorage.removeItem(`arcui_plugin_config_${pluginId}`);
      localStorage.removeItem(`arcui_plugin_enabled_${pluginId}`);
      localStorage.removeItem(`arcui_plugin_files_${pluginId}`);

      ArcUI.utils.showToast(`${pluginId}: uninstalled`, '');
    }

    /**
     * Dispatch a hook to all registered callbacks.
     * @param {string} hookName
     * @param {object} params - Hook parameters (may be modified by hooks)
     * @returns {object} The (possibly modified) params
     */
    async dispatchHook(hookName, params) {
      const registered = this.hooks.get(hookName);
      if (!registered || registered.length === 0) return params;

      // Check which plugins are enabled
      const enabledPlugins = new Set(
        this.plugins.filter(p => p.enabled).map(p => p.id)
      );

      let result = params;
      for (const entry of registered) {
        if (!enabledPlugins.has(entry.plugin)) continue;

        try {
          const ret = await entry.callback({ ...result });
          if (ret !== undefined) {
            result = ret;
          }
        } catch (e) {
          console.warn(`[PluginManager] Hook "${hookName}" callback failed for plugin "${entry.plugin}":`, e);
        }
      }

      return result;
    }

    /**
     * Register a hook callback.
     * @param {string} hookName
     * @param {string} pluginId
     * @param {Function} callback
     */
    registerHook(hookName, pluginId, callback) {
      if (!this.hooks.has(hookName)) {
        this.hooks.set(hookName, []);
      }
      this.hooks.get(hookName).push({ plugin: pluginId, callback });
    }

    /**
     * Unregister all hooks for a given plugin.
     * @param {string} pluginId
     */
    _unregisterAllHooks(pluginId) {
      for (const [hookName, entries] of this.hooks.entries()) {
        this.hooks.set(hookName, entries.filter(e => e.plugin !== pluginId));
      }
    }

    // ---- Sandbox methods exposed to plugins ----

    /**
     * Fetch via ArcUI backend proxy.
     */
    async _fetch(url, options = {}) {
      var config = ArcUI.state.config;
      var proxyUrl = config.backendUrl.replace(/\/+$/, '') + '/api/proxy';

      var resp = await fetch(proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url,
          method: options.method || 'GET',
          headers: options.headers || {},
          body: options.body || null,
        }),
      });

      if (!resp.ok) {
        var errText = await resp.text().catch(function () { return 'Unknown error'; });
        throw new Error('Proxy request failed (' + resp.status + '): ' + errText);
      }

      return resp;
    }

    /**
     * Call a Python capability on the backend.
     */
    async _callPython(capability, params) {
      var config = ArcUI.state.config;
      // Use the currently-active plugin ID (set during _initPlugin)
      var pluginId = this._currentPluginId || 'arcui-tts';

      var resp = await fetch(config.backendUrl.replace(/\/+$/, '') + '/api/plugin/' + pluginId + '/' + capability, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (!resp.ok) {
        var errText = await resp.text().catch(function () { return 'Unknown error'; });
        throw new Error('Python capability "' + capability + '" failed (' + resp.status + '): ' + errText);
      }

      return resp.json();
    }

    /**
     * Listen for custom events (plugin-to-plugin).
     */
    _on(event, callback) {
      if (!this.events.has(event)) {
        this.events.set(event, []);
      }
      this.events.get(event).push(callback);
    }

    /**
     * Emit a custom event (plugin-to-plugin).
     */
    _emit(event, data) {
      const callbacks = this.events.get(event);
      if (!callbacks) return;
      for (const cb of callbacks) {
        try { cb(data); } catch (e) { console.warn('[PluginManager] Event callback error:', e); }
      }
    }
  }

  /**
   * HookRegistry — passed to each plugin's registerHooks() method.
   */
  class HookRegistry {
    constructor(manager, pluginId) {
      this.manager = manager;
      this.pluginId = pluginId;
    }

    /**
     * Register a hook.
     * @param {string} hookName
     * @param {Function} callback
     */
    on(hookName, callback) {
      this.manager.registerHook(hookName, this.pluginId, callback);
    }
  }

  /**
   * Render the plugin list in the settings page.
   */
  function renderPluginList() {
    const listEl = document.getElementById('plugin-settings-list');
    if (!listEl) return;

    const manager = ArcUI.plugins.manager;
    if (!manager || !manager.plugins || manager.plugins.length === 0) {
      listEl.innerHTML = `<div class="sidebar-empty">${ArcUI.i18n.t('noPlugins')}</div>`;
      return;
    }

    listEl.innerHTML = manager.plugins.map(p => {
      const name = ArcUI.state.currentLang === 'en' && p.meta.name_en ? p.meta.name_en : p.meta.name;
      const desc = ArcUI.state.currentLang === 'en' && p.meta.description_en ? p.meta.description_en : p.meta.description;

      return `
        <div class="plugin-item">
          <div class="plugin-item-body">
            <div class="plugin-item-name">${ArcUI.utils.escapeHtml(name || p.id)}</div>
            <div class="plugin-item-desc">${ArcUI.utils.escapeHtml(desc || '')}</div>
          </div>
          <label class="toggle">
            <input type="checkbox" class="toggle-input" data-plugin-id="${p.id}" ${p.enabled ? 'checked' : ''} onchange="ArcUI.plugins.manager.setEnabled('${p.id}', this.checked)">
            <span class="toggle-slider"></span>
          </label>
        </div>
      `;
    }).join('');
  }

  // Expose
  ArcUI.plugins = {
    manager: null, // Will be instantiated in app.js
    PluginManager: PluginManager,
    renderPluginList: renderPluginList,
  };
})();
