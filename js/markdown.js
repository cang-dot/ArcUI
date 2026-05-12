/* ArcUI - markdown.js */
/* Markdown rendering using marked.js CDN, with plaintext fallback */

(function () {
  'use strict';

  const ArcUI = window.ArcUI;

  /**
   * Render markdown text to HTML.
   * Uses marked.js if available (loaded via CDN), otherwise
   * falls back to plain text with basic newline-to-br conversion.
   * @param {string} text - Raw markdown text
   * @returns {string} HTML string
   */
  function renderMarkdown(text) {
    if (!text && text !== 0) return '';

    // If marked is available, use it
    if (typeof marked !== 'undefined' && typeof marked.parse === 'function') {
      try {
        // Configure marked options
        marked.setOptions({
          breaks: true,
          gfm: true,
        });
        return marked.parse(text);
      } catch (e) {
        console.warn('[Markdown] marked.parse failed, falling back:', e);
        return fallbackRender(text);
      }
    }

    return fallbackRender(text);
  }

  /**
   * Fallback: escape HTML and convert newlines to <br>
   */
  function fallbackRender(text) {
    const escaped = ArcUI.utils.escapeHtml(String(text));
    return '<p>' + escaped.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>') + '</p>';
  }

  // Expose
  ArcUI.markdown = { renderMarkdown };
})();
