/* ArcUI - api.js */
/* API calls: non-streaming, streaming, model list, test connection */

(function () {
  'use strict';

  const ArcUI = window.ArcUI;

  /**
   * Make a non-streaming API call through the ArcUI backend proxy.
   * @param {object} params
   * @param {string} params.url - Target API endpoint (full URL)
   * @param {string} params.method - HTTP method
   * @param {object} params.headers - Headers to forward
   * @param {object} params.body - Request body
   * @returns {Promise<object>} Parsed JSON response
   */
  async function callAPI({ url, method, headers, body }) {
    var config = ArcUI.state.config;
    var proxyUrl = config.backendUrl.replace(/\/+$/, '') + '/api/proxy';

    var proxyBody = {
      url: url,
      method: method || 'POST',
      headers: headers || {},
      body: body || {},
    };

    // Attach Fact-ARC token if available
    if (ArcUI.state.factARCToken) {
      proxyBody.headers['X-FactARC-Token'] = ArcUI.state.factARCToken;
    }

    var response = await fetch(proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(proxyBody),
    });

    if (!response.ok) {
      var errorText = await response.text();
      var errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch (e) {
        errorData = { detail: errorText || response.statusText };
      }
      throw new Error(errorData.detail || ('API request failed with status ' + response.status));
    }

    return response.json();
  }

  /**
   * Make a streaming API call through the ArcUI backend proxy.
   * Returns the fetch Response for ReadableStream consumption.
   * @param {object} params
   * @param {string} params.url - Target API endpoint (full URL)
   * @param {object} params.headers - Headers to forward
   * @param {object} params.body - Request body
   * @returns {Promise<Response>} Fetch Response with streaming body
   */
  async function callAPIStream({ url, headers, body }) {
    var config = ArcUI.state.config;
    var proxyUrl = config.backendUrl.replace(/\/+$/, '') + '/api/proxy/stream';

    var proxyBody = {
      url: url,
      headers: headers || {},
      body: body || {},
    };

    // Attach Fact-ARC token if available
    if (ArcUI.state.factARCToken) {
      proxyBody.headers['X-FactARC-Token'] = ArcUI.state.factARCToken;
    }

    var response = await fetch(proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(proxyBody),
    });

    if (!response.ok) {
      var errorText = '';
      try { errorText = await response.text(); } catch (e) { /* ignore */ }
      throw new Error(errorText || ('Stream request failed with status ' + response.status));
    }

    return response;
  }

  /**
   * Fetch available models through the ArcUI backend proxy.
   * @returns {Promise<Array<{id: string, vision?: boolean, audio?: boolean}>>}
   */
  async function fetchModels() {
    var config = ArcUI.state.config;

    if (!config.baseUrl || !config.apiKey) {
      console.warn('[API] fetchModels skipped: missing baseUrl or apiKey');
      return [];
    }

    try {
      var response = await callAPI({
        url: config.baseUrl.replace(/\/+$/, '') + '/models',
        method: 'GET',
        headers: { 'Authorization': 'Bearer ' + config.apiKey },
      });

      var rawModels = response.data || response.models || [];
      var models = rawModels.map(function (m) {
        return { id: typeof m === 'string' ? m : m.id };
      });

      // Detect multimodal capabilities for each model
      models.forEach(function (m) {
        var caps = ArcUI.multimodal ? ArcUI.multimodal.detectCapabilities(m.id) : { vision: false, audio: false };
        m.vision = caps.vision;
        m.audio = caps.audio;
      });

      return models;
    } catch (err) {
      console.warn('[API] fetchModels failed:', err.message);
      return [];
    }
  }

  /**
   * Test connection through the ArcUI backend proxy.
   * @param {string} [overrideBaseUrl] - Optional base URL override
   * @param {string} [overrideApiKey] - Optional API key override
   * @returns {Promise<{ok: boolean, message: string}>}
   */
  async function testConnection(overrideBaseUrl, overrideApiKey) {
    var baseUrl = overrideBaseUrl || ArcUI.state.config.baseUrl;
    var apiKey = overrideApiKey || ArcUI.state.config.apiKey;

    if (!baseUrl || !apiKey) {
      return { ok: false, message: 'Missing base URL or API key' };
    }

    try {
      var response = await callAPI({
        url: baseUrl.replace(/\/+$/, '') + '/models',
        method: 'GET',
        headers: { 'Authorization': 'Bearer ' + apiKey },
      });

      return { ok: true, message: 'Connection successful', data: response };
    } catch (err) {
      return { ok: false, message: err.message };
    }
  }

  // Expose
  ArcUI.api = { callAPI, callAPIStream, fetchModels, testConnection };
})();
