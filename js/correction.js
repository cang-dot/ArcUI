/* ArcUI - correction.js */
/* Correction Engine: multi-round self-correction pipeline */

(function () {
  'use strict';

  const ArcUI = window.ArcUI;

  /**
   * Make a non-streaming LLM call through the ArcUI backend proxy.
   */
  async function callLLMNonStreaming(messages, model, signal) {
    const config = ArcUI.state.config;
    const body = {
      url: `${config.baseUrl}/chat/completions`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: {
        model: model || config.model,
        messages,
        stream: false,
      },
    };

    // Build headers for proxy
    const proxyHeaders = { 'Content-Type': 'application/json' };
    if (ArcUI.state.factARCToken) {
      proxyHeaders['X-FactARC-Token'] = ArcUI.state.factARCToken;
    }

    let response;
    try {
      response = await fetch(`${config.backendUrl}/api/proxy`, {
        method: 'POST',
        headers: proxyHeaders,
        body: JSON.stringify(body),
        signal: signal,
      });
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      // Try direct call if proxy fails
      response = await fetch(body.url, {
        method: 'POST',
        headers: body.headers,
        body: JSON.stringify(body.body),
        signal: signal,
      });
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => 'Unknown error');
      throw new Error(`LLM call failed: ${response.status} ${errText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  /**
   * Build system prompt for the correction judge model.
   */
  function buildJudgePrompt(originalQuery, draftContent, lang) {
    const isZh = lang === 'zh';
    const instructions = isZh
      ? `你是一个严格的纠错判定器。请评估以下AI回答的事实准确性和逻辑一致性。
对于用户的查询和AI的回答，给出一个0到100的置信度分数。
- 0-40：完全不正确，致命的逻辑错误，与已知事实严重矛盾
- 41-69：有轻微问题，但核心回答基本正确
- 70-100：事实准确，逻辑一致，回答可靠

请只输出一个JSON对象，格式如下：
{"confidence": 数字, "analysis": "简短的分析说明"}
不要输出任何其他内容。`
      : `You are a strict correction judge. Evaluate the factual accuracy and logical consistency of the following AI response.
For the user's query and the AI's answer, give a confidence score from 0 to 100.
- 0-40: Completely incorrect, fatal logical errors, severely contradicts known facts
- 41-69: Minor issues, but core answer is basically correct
- 70-100: Factually accurate, logically consistent, answer is reliable

Output ONLY a JSON object in this format:
{"confidence": number, "analysis": "brief analysis explanation"}
Do not output anything else.`;

    return [
      { role: 'system', content: instructions },
      { role: 'user', content: `${isZh ? '用户查询' : 'User Query'}: ${originalQuery}\n\n${isZh ? 'AI回答' : 'AI Response'}: ${draftContent}` },
    ];
  }

  /**
   * Build messages for revision (with search results if available).
   */
  function buildRevisionPrompt(originalQuery, draftContent, analysis, searchResults, messages, lang) {
    const isZh = lang === 'zh';
    const systemMsg = isZh
      ? `你是一个知识渊博的AI助手。你之前的回答被判定置信度不足，需要修正。
下面是判定器的分析意见，请根据这些意见修正你的回答，提供更准确、更可靠的信息。

${searchResults ? `以下是联网搜索的结果，请优先参考这些来源：
${searchResults}` : ''}

修正要求：
1. 纠正任何事实错误
2. 补充缺失的关键信息
3. 如果搜索结果与你的回答矛盾，以搜索结果为准
4. 保持回答结构清晰、有条理`
      : `You are a knowledgeable AI assistant. Your previous answer was judged to have insufficient confidence and needs revision.
Below is the judge's analysis. Please revise your answer based on this feedback to provide more accurate and reliable information.

${searchResults ? `Here are web search results that you should prioritize:
${searchResults}` : ''}

Revision requirements:
1. Correct any factual errors
2. Fill in missing key information
3. If search results contradict your answer, prioritize search results
4. Keep the response well-structured and organized`;

    const revisionMessages = [...messages];
    // Replace the last user message with a revision instruction
    const revisionUserMsg = isZh
      ? `请修正你之前的回答。\n\n原始问题：${originalQuery}\n\n之前的回答：${draftContent}\n\n判定分析：${analysis}`
      : `Please revise your previous answer.\n\nOriginal question: ${originalQuery}\n\nPrevious answer: ${draftContent}\n\nJudge analysis: ${analysis}`;

    // Remove the last assistant message if present, then add revision
    if (revisionMessages.length > 0 && revisionMessages[revisionMessages.length - 1].role === 'assistant') {
      revisionMessages.pop();
    }
    revisionMessages.push({ role: 'user', content: revisionUserMsg });

    // Prepend the system instruction
    if (revisionMessages.length > 0 && revisionMessages[0].role === 'system') {
      revisionMessages[0].content = systemMsg;
    } else {
      revisionMessages.unshift({ role: 'system', content: systemMsg });
    }

    return revisionMessages;
  }

  /**
   * Build polish prompt.
   */
  function buildPolishPrompt(draftContent, lang) {
    const isZh = lang === 'zh';
    const systemMsg = isZh
      ? `你是一个语言润色专家。请优化以下文本的语言表达，使其更流畅、更自然、更专业。
注意：
1. 只优化语言表达，不改变任何事实内容
2. 保持原有的信息量和结构
3. 修正语法错误和不自然的表达
4. 保持原有语气风格`
      : `You are a language polishing expert. Please optimize the following text to make it more fluent, natural, and professional.
Note:
1. Only improve language expression, do not change any factual content
2. Maintain the original information and structure
3. Fix grammar errors and unnatural expressions
4. Keep the original tone and style`;

    return [
      { role: 'system', content: systemMsg },
      { role: 'user', content: draftContent },
    ];
  }

  /**
   * Call Bocha API for web search.
   */
  async function callBochaSearch(query, bochaKey) {
    if (!bochaKey) return null;

    try {
      const response = await fetch('https://api.bochaai.com/v1/ai/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${bochaKey}`,
        },
        body: JSON.stringify({
          query,
          count: 8,
          answer: false,
          stream: false,
          freshness: 'noLimit',
        }),
      });

      if (!response.ok) {
        console.warn('[Correction] Bocha search failed:', response.status);
        return null;
      }

      const data = await response.json();
      const results = data?.data?.webPages?.value || [];

      if (results.length === 0) return null;

      // Format results as text for the LLM
      return results.map((r, i) => {
        return `[${i + 1}] ${r.name || r.title || ''}\nURL: ${r.url || ''}\n${r.snippet || r.summary || ''}`;
      }).join('\n\n');
    } catch (e) {
      console.warn('[Correction] Bocha search error:', e);
      return null;
    }
  }

  /**
   * Create the progress container element in the chat.
   */
  function createProgressContainer() {
    const container = document.getElementById('chat-messages');
    if (!container) return null;

    const progressEl = document.createElement('div');
    progressEl.className = 'correction-progress';
    progressEl.innerHTML = `
      <div class="correction-progress-header">
        <span class="correction-progress-icon">⚙</span>
        <span class="correction-progress-title">${ArcUI.i18n.t('correctionEngine')}</span>
        <button class="correction-collapse-btn" onclick="ArcUI.correction.toggleProgressExpand(this)">${ArcUI.i18n.t('correctionCollapse')}</button>
      </div>
      <div class="correction-progress-body">
        <div class="correction-step-list" id="correction-step-list"></div>
      </div>`;

    container.appendChild(progressEl);
    ArcUI.utils.scrollToBottom();
    return progressEl;
  }

  /**
   * Add a step to the progress UI.
   */
  function addProgressStep(statusText, stepId) {
    const list = document.getElementById('correction-step-list');
    if (!list) return null;

    const stepEl = document.createElement('div');
    stepEl.className = 'correction-step';
    stepEl.setAttribute('data-step-id', stepId);
    stepEl.innerHTML = `
      <span class="correction-step-status">⏳</span>
      <span class="correction-step-text">${statusText}</span>
      <span class="correction-step-detail" id="correction-detail-${stepId}"></span>`;

    list.appendChild(stepEl);
    ArcUI.utils.scrollToBottom();
    return stepEl;
  }

  /**
   * Update a step's status.
   */
  function updateStepStatus(stepId, icon, text, detail) {
    const stepEl = document.querySelector(`[data-step-id="${stepId}"]`);
    if (!stepEl) return;

    const statusEl = stepEl.querySelector('.correction-step-status');
    const detailEl = document.getElementById('correction-detail-' + stepId);

    if (statusEl) statusEl.textContent = icon;
    if (detailEl && detail) detailEl.textContent = detail;

    // If detail is provided, show it
    if (detailEl) {
      detailEl.style.display = detail ? 'inline' : 'none';
    }
  }

  /**
   * Remove the progress container and any thinking indicators.
   */
  function removeProgressContainer() {
    const progressEl = document.querySelector('.correction-progress');
    if (progressEl) progressEl.remove();

    const chatId = ArcUI.state.currentChatId;
    const chat = ArcUI.state.chatHistory[chatId];
    if (chat) {
      chat.messages = chat.messages.filter(m => m.id !== '__thinking__');
    }
  }

  /**
   * Toggle expand/collapse for the progress panel.
   */
  function toggleProgressExpand(btn) {
    const progress = btn.closest('.correction-progress');
    if (!progress) return;
    const body = progress.querySelector('.correction-progress-body');
    if (!body) return;

    const isCollapsed = body.style.display === 'none';
    body.style.display = isCollapsed ? 'block' : 'none';
    btn.textContent = isCollapsed ? ArcUI.i18n.t('correctionCollapse') : ArcUI.i18n.t('correctionExpand');
  }

  /**
   * Main correction pipeline.
   * @param {string} originalQuery - The user's original query
   * @param {Array} messages - The full messages array for context
   * @param {string} chatId - Current chat ID
   * @returns {string} Final corrected content
   */
  async function runCorrectionPipeline(originalQuery, messages, chatId) {
    const state = ArcUI.state;
    const maxRounds = state.correctionMaxRounds || 2;
    const threshold = state.correctionThreshold || 70;
    const lang = state.currentLang;
    const model = state.config.model;
    const bochaKey = state.bochaKey;
    const webSearchEnabled = state.webSearchEnabled;
    const abortController = new AbortController();

    // Store abort controller so user can cancel
    ArcUI.state._correctionAbort = abortController;

    // Create progress UI
    const progressEl = createProgressContainer();
    if (!progressEl) return null;

    let draft = '';
    let currentMessages = [...messages];

    try {
      // Step 1: Draft
      addProgressStep(ArcUI.i18n.t('correctionDrafting'), 'draft');
      draft = await callLLMNonStreaming(currentMessages, model, abortController.signal);
      if (abortController.signal.aborted) throw new Error('Aborted');
      updateStepStatus('draft', '✓', null, '');
      ArcUI.utils.scrollToBottom();

      // Step 2: Correction loop
      let finalConfidence = 0;
      let searchResults = null;
      let usedSearch = false;

      for (let round = 0; round < maxRounds; round++) {
        // 2a. Judge confidence
        const evalStepId = `evaluate-${round}`;
        addProgressStep(
          ArcUI.i18n.t('correctionEvaluating') + ' ' + ArcUI.i18n.t('correctionRound').replace('{0}', round + 1),
          evalStepId
        );

        const judgeMessages = buildJudgePrompt(originalQuery, draft, lang);
        const judgeResultRaw = await callLLMNonStreaming(judgeMessages, model, abortController.signal);
        if (abortController.signal.aborted) throw new Error('Aborted');

        // Parse judge result
        let confidence = 0;
        let analysis = '';
        try {
          const parsed = JSON.parse(judgeResultRaw);
          confidence = typeof parsed.confidence === 'number' ? parsed.confidence : parseInt(parsed.confidence, 10) || 0;
          analysis = parsed.analysis || '';
        } catch (e) {
          // Try to extract confidence from text
          const match = judgeResultRaw.match(/confidence[:\s]*(\d+)/i);
          if (match) confidence = parseInt(match[1], 10) || 0;
          analysis = judgeResultRaw.substring(0, 200);
        }

        confidence = Math.max(0, Math.min(100, confidence));
        finalConfidence = confidence;
        updateStepStatus(evalStepId, '✓', null, `${ArcUI.i18n.t('correctionConfidence')}: ${confidence}`);

        if (confidence >= threshold) {
          break; // Good enough
        }

        // 2b. Web search (only on first round that needs it)
        if (webSearchEnabled && bochaKey && !usedSearch) {
          const searchStepId = 'search';
          addProgressStep(ArcUI.i18n.t('correctionSearching'), searchStepId);
          searchResults = await callBochaSearch(originalQuery, bochaKey);
          usedSearch = true;
          if (searchResults) {
            const resultCount = searchResults.split('\n\n').filter(b => b.trim()).length;
            updateStepStatus(searchStepId, '✓', null, ArcUI.i18n.t('correctionSearchResults').replace('{0}', resultCount));
          } else {
            updateStepStatus(searchStepId, '✗', null, '');
          }
        }

        // 2c. Revise
        const reviseStepId = `revise-${round}`;
        addProgressStep(ArcUI.i18n.t('correctionRevising'), reviseStepId);

        const revisionMessages = buildRevisionPrompt(originalQuery, draft, analysis, searchResults, currentMessages, lang);
        draft = await callLLMNonStreaming(revisionMessages, model, abortController.signal);
        if (abortController.signal.aborted) throw new Error('Aborted');
        updateStepStatus(reviseStepId, '✓', null, '');
      }

      // Step 3: Polish
      const polishStepId = 'polish';
      addProgressStep(ArcUI.i18n.t('correctionPolishing'), polishStepId);
      const polishMessages = buildPolishPrompt(draft, lang);
      draft = await callLLMNonStreaming(polishMessages, model, abortController.signal);
      if (abortController.signal.aborted) throw new Error('Aborted');
      updateStepStatus(polishStepId, '✓', null, '');

      // Step 4: Ready
      const readyStepId = 'ready';
      addProgressStep(ArcUI.i18n.t('correctionReady'), readyStepId);
      updateStepStatus(readyStepId, '✓', null, '');

      // Remove progress, add assistant message
      removeProgressContainer();

      return draft;

    } catch (e) {
      removeProgressContainer();
      throw e;
    } finally {
      ArcUI.state._correctionAbort = null;
    }
  }

  /**
   * Abort the correction pipeline.
   */
  function abortCorrection() {
    if (ArcUI.state._correctionAbort) {
      ArcUI.state._correctionAbort.abort();
      ArcUI.state._correctionAbort = null;
    }
    removeProgressContainer();
    ArcUI.state.isProcessing = false;
  }

  // Expose
  ArcUI.correction = {
    runCorrectionPipeline,
    abortCorrection,
    callLLMNonStreaming,
    toggleProgressExpand,
  };
})();
