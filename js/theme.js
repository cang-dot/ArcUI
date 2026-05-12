/* ArcUI - theme.js */
/* Dark/light theme toggle, persistence, auto-detection */

(function () {
  'use strict';

  const ArcUI = window.ArcUI;

  /**
   * Apply a theme to the document.
   * @param {'dark'|'light'} theme
   */
  function applyTheme(theme) {
    ArcUI.state.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('arcui_theme', theme);
    updateThemeButton();
  }

  /**
   * Cycle: dark -> light -> dark
   */
  function cycleTheme() {
    const next = ArcUI.state.theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
  }

  /**
   * Update the theme toggle button appearance.
   */
  function updateThemeButton() {
    const btn = document.getElementById('theme-btn');
    if (!btn) return;
    btn.setAttribute('data-theme', ArcUI.state.theme);
    btn.textContent = ArcUI.state.theme === 'dark' ? '☽' : '☀';
    btn.setAttribute('title', ArcUI.i18n.t('toggleTheme'));
  }

  /**
   * Detect system preference for initial load.
   */
  function detectSystemPreference() {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'light';
    }
    return 'dark';
  }

  // Expose
  ArcUI.theme = { applyTheme, cycleTheme, updateThemeButton, detectSystemPreference };
})();
