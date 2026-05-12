// ArcUI - Fact-ARC plugin
// Detects Fact-ARC backend, displays verification trails and source citations

class FactARCPlugin {
  static meta = {
    id: 'arcui-factarc',
    name: 'Fact-ARC 集成',
    version: '1.0.0',
  };

  context = null;
  config = {};

  constructor(context) {
    this.context = context;
  }

  async init(config) {
    this.config = config || {};
    return true;
  }

  registerHooks(registry) {
    registry.on('message.afterReceive', this.onAfterReceive.bind(this));
    registry.on('message.render', this.onMessageRender.bind(this));
  }

  /**
   * After receiving a response: if it contains verification_trail or sources, stash them.
   */
  onAfterReceive({ response }) {
    if (!response || !response.content) return;
    // No-op in plugin mode — the Fact-ARC metadata comes from the original backend.
    // If the user connects directly to Fact-ARC backend as their LLM API,
    // the verification trail and sources would be injected by Fact-ARC's response wrapper.
    // This hook exists so users can extend.
  }

  /**
   * On message render: inject verification trail and sources UI.
   */
  onMessageRender({ message, domElement }) {
    if (!message || !domElement) return;
    if (message.role !== 'assistant') return;

    // Check for verification trail
    let trail = message.verificationTrail || message.verification_trail;
    if (trail && trail.length > 0) {
      const trailHTML = this.renderVerificationTrail(message.id, trail);
      const existingTrail = domElement.querySelector('.verification-trail');
      if (!existingTrail) {
        domElement.insertAdjacentHTML('beforeend', trailHTML);
      }
    }

    // Check for sources
    let sources = message.sources;
    if (sources && sources.length > 0) {
      const sourcesHTML = this.renderSources(sources);
      const existingSources = domElement.querySelector('.message-sources');
      if (!existingSources) {
        domElement.insertAdjacentHTML('beforeend', sourcesHTML);
      }
    }
  }

  renderVerificationTrail(msgId, trails) {
    if (!trails || trails.length === 0) return '';
    const trailId = `trail-${msgId}`;
    const itemsHtml = trails.map((t, i) => {
      const statusClass = t.status === 'verified' ? 'trail-verified' :
                          t.status === 'failed' ? 'trail-failed' :
                          'trail-pending';
      const statusLabel = t.status || 'pending';
      const desc = ArcUI.utils.escapeHtml(t.statement || t.description || '');
      const source = t.source ? `<span class="trail-source">${ArcUI.utils.escapeHtml(t.source)}</span>` : '';
      return `
        <div class="trail-item ${statusClass}">
          <span class="trail-step">${i + 1}</span>
          <span class="trail-description">${desc}</span>
          <span class="trail-status">${statusLabel}</span>
          ${source}
        </div>`;
    }).join('');

    return `
      <div class="verification-trail">
        <div class="trail-header" onclick="var p=ArcUI.plugins.manager.getPlugin('arcui-factarc');if(p&&p.instance)p.instance._toggleTrail('${trailId}')">
          <span class="trail-toggle" id="${trailId}-toggle">▶</span>
          <span>${ArcUI.i18n.t('verificationTrail')} (${trails.length})</span>
        </div>
        <div class="trail-body" id="${trailId}" style="display:none;">
          ${itemsHtml}
        </div>
      </div>
    `;
  }

  renderSources(sources) {
    if (!sources || sources.length === 0) return '';
    const itemsHtml = sources.map(s => {
      const url = ArcUI.utils.escapeHtml(s.url || '#');
      const title = ArcUI.utils.escapeHtml(s.title || s.url || 'Source');
      return `<a href="${url}" target="_blank" rel="noopener" class="source-link">${title}</a>`;
    }).join(', ');
    return `
      <div class="message-sources">
        <span class="sources-label">${ArcUI.i18n.t('sources')}:</span>
        ${itemsHtml}
      </div>
    `;
  }

  _toggleTrail(trailId) {
    const body = document.getElementById(trailId);
    const toggle = document.getElementById(trailId + '-toggle');
    if (!body || !toggle) return;
    const isVisible = body.style.display !== 'none';
    body.style.display = isVisible ? 'none' : 'block';
    toggle.textContent = isVisible ? '▶' : '▼';
  }

  destroy() {
    // No cleanup needed
  }
}

// Export for PluginManager
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FactARCPlugin;
}

// Sandbox eval compatibility: PluginManager expects the class as "Plugin"
const Plugin = FactARCPlugin;
