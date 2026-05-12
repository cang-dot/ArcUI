/* ArcUI - identity.js */
/* Generic backend identity detection — no hardcoded Fact-ARC logic.
   Plugins (e.g. factarc) register their own detection via hooks. */

(function () {
  'use strict';

  const ArcUI = window.ArcUI;

  /**
   * Detect whether the configured backend is a special type.
   * Core only sets up the detection pipeline; plugins handle specifics.
   *
   * @returns {Promise<'generic'>} The backend type
   */
  async function detectBackend() {
    // Plugins may override by listening to api.provider hook
    // and modifying ArcUI.state.backendType directly.
    // Core always defaults to generic.
    ArcUI.state.backendType = 'generic';

    // Notify plugins so they can run their own detection
    if (ArcUI.plugins && ArcUI.plugins.manager) {
      try {
        await ArcUI.plugins.manager.dispatchHook('api.provider', {
          providers: [],
          detectBackend: true,
        });
      } catch (e) {
        console.warn('[Identity] Plugin detection hook failed:', e);
      }
    }

    return ArcUI.state.backendType;
  }

  // Expose
  ArcUI.identity = { detectBackend };
})();
