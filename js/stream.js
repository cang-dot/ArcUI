/* ArcUI - stream.js */
/* SSE streaming: ReadableStream consumption, typewriter rendering, throttling */

(function () {
  'use strict';

  const ArcUI = window.ArcUI;

  /**
   * AbortController reference for cancelling active streams.
   */
  let abortController = null;

  /**
   * Stream a chat completion request.
   * @param {object} params
   * @param {string} params.url - Full API endpoint (e.g., {baseUrl}/chat/completions)
   * @param {object} params.headers - Request headers
   * @param {object} params.body - Request body
   * @param {function} params.onToken - Called with (token: string, fullContent: string)
   * @param {function} params.onComplete - Called with (fullContent: string)
   * @param {function} params.onError - Called with (error: Error)
   * @param {function} [params.onMeta] - Called with (meta: object) from non-streaming metadata
   * @returns {Promise<void>}
   */
  async function streamChat({ url, headers, body, onToken, onComplete, onError, onMeta }) {
    // Abort any previous stream
    abortStream();

    abortController = new AbortController();
    ArcUI.state.isStreaming = true;

    // Prepare the stream-compatible body
    const streamBody = { ...body, stream: true };

    try {
      const response = await ArcUI.api.callAPIStream({
        url: url,
        headers: headers,
        body: streamBody,
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let buffer = '';
      let lastRenderTime = 0;
      const THROTTLE_MS = 50;
      let pendingTokens = [];

      // Track block state for incremental rendering
      let inCodeBlock = false;
      let inTable = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process SSE lines
        const lines = buffer.split('\n');
        // Keep the last partial line in the buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          const dataStr = trimmed.slice(6); // Remove 'data: '

          if (dataStr === '[DONE]') {
            // Stream finished — do final render below
            continue;
          }

          try {
            const data = JSON.parse(dataStr);
            const delta = data.choices?.[0]?.delta;

            if (delta) {
              // Check for content token
              if (delta.content) {
                const token = delta.content;
                fullContent += token;
                pendingTokens.push(token);

                // Track block states
                // Simple detection: if we have unclosed ```, we're in a code block
                const codeBlockMarkers = (fullContent.match(/```/g) || []).length;
                inCodeBlock = (codeBlockMarkers % 2 === 1);

                // Simple table detection: count | in recent lines
                const lastLine = fullContent.split('\n').pop() || '';
                // Only set inTable true if we have a header separator line pattern
                if (lastLine.includes('|---') || lastLine.includes('| ---')) {
                  inTable = true;
                }

                // Throttle rendering
                const now = Date.now();
                if (now - lastRenderTime >= THROTTLE_MS && pendingTokens.length >= 3) {
                  onToken(pendingTokens.join(''), fullContent);
                  pendingTokens = [];
                  lastRenderTime = now;
                }
              }

              // Check for non-streaming metadata (e.g., verification_trail from Fact-ARC)
              if (data.verification_trail || data.sources) {
                if (onMeta) {
                  onMeta({
                    verification_trail: data.verification_trail,
                    sources: data.sources,
                  });
                }
              }
            }

            // Some APIs return content directly on choices[0]
            if (data.choices?.[0]?.message?.content) {
              fullContent = data.choices[0].message.content;
            }
          } catch (parseErr) {
            // Some SSE lines may not be valid JSON — skip them silently
          }
        }
      }

      // Flush any remaining tokens
      if (pendingTokens.length > 0) {
        onToken(pendingTokens.join(''), fullContent);
        pendingTokens = [];
      }

      // Force final render
      ArcUI.state.isStreaming = false;
      abortController = null;

      if (onComplete) {
        onComplete(fullContent);
      }
    } catch (err) {
      ArcUI.state.isStreaming = false;
      abortController = null;

      if (err.name === 'AbortError') {
        // Stream was intentionally aborted — still pass accumulated content
        if (onComplete) {
          onComplete(fullContent);
        }
        return;
      }

      console.error('[Stream] Error:', err);
      if (onError) {
        onError(err);
      }
    }
  }

  /**
   * Typewriter render: update a DOM element with markdown content.
   * @param {HTMLElement} element - The DOM element to update
   * @param {string} fullContent - The full accumulated content so far
   * @param {boolean} isComplete - Whether the stream is finished
   */
  function typewriterRender(element, fullContent, isComplete) {
    if (!element) return;

    // If stream is complete, render full markdown
    if (isComplete) {
      const html = ArcUI.markdown.renderMarkdown(fullContent);
      element.innerHTML = html;
      // Remove blinking cursor if present
      element.classList.remove('streaming');
    } else {
      // During streaming, try smart rendering
      // Check if code blocks / tables are properly closed
      const codeBlockCount = (fullContent.match(/```/g) || []).length;
      const codeBlockOpen = codeBlockCount % 2 === 1;

      if (codeBlockOpen) {
        // Render everything except the unclosed code block as markdown,
        // then append the last code block as plain text
        const lastFenceIdx = fullContent.lastIndexOf('```');
        const beforeLastFence = fullContent.substring(0, lastFenceIdx);
        const unclosedBlock = fullContent.substring(lastFenceIdx);

        const html = ArcUI.markdown.renderMarkdown(beforeLastFence);
        element.innerHTML = html + '\n<pre><code>' + ArcUI.utils.escapeHtml(unclosedBlock.replace(/^```\w*\n?/, '')) + '</code></pre>';
      } else {
        // All blocks closed — render full markdown
        const html = ArcUI.markdown.renderMarkdown(fullContent);
        element.innerHTML = html;
      }

      // Add blinking cursor class
      element.classList.add('streaming');
    }

    // Scroll to bottom
    ArcUI.utils.scrollToBottom();
  }

  /**
   * Abort the current streaming request.
   */
  function abortStream() {
    if (abortController) {
      abortController.abort();
      abortController = null;
      ArcUI.state.isStreaming = false;
    }
  }

  // Expose
  ArcUI.stream = { streamChat, typewriterRender, abortStream };
})();
