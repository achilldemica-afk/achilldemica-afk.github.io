// achilldemica AI Chat Widget
(function() {
  const WORKER_URL = 'https://achilldemica-comments.achilldemica.workers.dev';
  const MAX_HISTORY = 10;

  let isOpen = false;
  let messages = [];
  let selectedText = '';
  let isLoading = false;
  let articleText = '';
  let pageSlug = '';

  // Extract article text and slug
  function init() {
    const article = document.querySelector('article');
    if (article) articleText = article.innerText.substring(0, 50000);
    const path = window.location.pathname;
    const match = path.match(/posts\/(.+)\.html/);
    pageSlug = match ? match[1] : 'index';
    createFAB();
    setupTextSelection();
  }

  // ==================== FAB Button ====================
  function createFAB() {
    const fab = document.createElement('button');
    fab.className = 'acm-chat-fab';
    fab.innerHTML = '💬';
    fab.title = 'AI Asistan';
    fab.onclick = () => toggleChat();
    document.body.appendChild(fab);
  }

  // ==================== Chat Panel ====================
  function toggleChat() {
    isOpen = !isOpen;
    let panel = document.getElementById('acm-chat-panel');
    if (isOpen) {
      if (!panel) panel = createPanel();
      panel.style.display = 'flex';
    } else if (panel) {
      panel.style.display = 'none';
    }
  }

  function createPanel() {
    const panel = document.createElement('div');
    panel.id = 'acm-chat-panel';
    panel.className = 'acm-chat-panel';
    panel.innerHTML = `
      <div class="acm-chat-header">
        <span>AI Asistan</span>
        <button class="acm-chat-header-close" onclick="document.getElementById('acm-chat-panel').style.display='none'">&times;</button>
      </div>
      <div class="acm-chat-messages" id="acm-chat-messages">
        <div class="acm-chat-welcome">
          <p>Makale hakkinda soru sorabilirsin.</p>
          <p style="font-size:12px;color:#b8a898">Metni secersen otomatik olarak buraya aktarilir.</p>
        </div>
      </div>
      <div id="acm-chat-selected-bar" style="display:none" class="acm-chat-selected">
        <span class="acm-chat-selected-label">Secili:</span>
        <span class="acm-chat-selected-text" id="acm-chat-selected-text"></span>
        <button class="acm-chat-selected-clear" onclick="window._acmClearSelection()">&times;</button>
      </div>
      <div class="acm-chat-input-area">
        <textarea class="acm-chat-input" id="acm-chat-input" placeholder="Soru sor..." rows="1"></textarea>
        <button class="acm-chat-send" id="acm-chat-send" onclick="window._acmSend()">&#8593;</button>
      </div>
      <div class="acm-chat-disclaimer">Bu bir AI yanıtıdır, hata içerebilir.</div>
    `;
    document.body.appendChild(panel);

    // Enter to send
    document.getElementById('acm-chat-input').addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        window._acmSend();
      }
    });

    return panel;
  }

  // ==================== Send Message ====================
  window._acmSend = async function() {
    const input = document.getElementById('acm-chat-input');
    const text = input.value.trim();
    if (!text || isLoading) return;

    input.value = '';
    isLoading = true;

    // Add user message
    const userMsg = { role: 'user', content: text, selectedText: selectedText || null };
    messages.push(userMsg);
    renderMessages();

    // Clear selection after sending
    const sentSelection = selectedText;
    window._acmClearSelection();

    // Update send button
    document.getElementById('acm-chat-send').disabled = true;

    try {
      const res = await fetch(WORKER_URL + '/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          article: articleText,
          question: text,
          selectedText: sentSelection || undefined,
          history: messages.slice(-MAX_HISTORY).map(m => ({ role: m.role, content: m.content })),
          slug: pageSlug
        })
      });

      const data = await res.json();
      if (data.error) {
        messages.push({ role: 'assistant', content: 'Hata: ' + data.error });
      } else {
        messages.push({ role: 'assistant', content: data.answer });
      }
    } catch (err) {
      messages.push({ role: 'assistant', content: 'Baglanti hatasi. Lutfen tekrar deneyin.' });
    }

    isLoading = false;
    document.getElementById('acm-chat-send').disabled = false;
    renderMessages();
  };

  // ==================== Render Messages ====================
  function renderMessages() {
    const container = document.getElementById('acm-chat-messages');
    if (!container) return;

    let html = '';
    for (const msg of messages) {
      const cls = msg.role === 'user' ? 'user' : 'assistant';
      let quoteHtml = '';
      if (msg.selectedText) {
        const short = msg.selectedText.length > 60 ? msg.selectedText.substring(0, 60) + '...' : msg.selectedText;
        quoteHtml = `<div class="acm-chat-msg-quote">"${escapeHtml(short)}"</div>`;
      }
      html += `<div class="acm-chat-msg ${cls}">${quoteHtml}${escapeHtml(msg.content)}</div>`;
    }
    if (isLoading) {
      html += `<div class="acm-chat-msg assistant acm-chat-typing">...</div>`;
    }
    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
  }

  // ==================== Text Selection ====================
  function setupTextSelection() {
    document.addEventListener('mouseup', function(e) {
      const sel = window.getSelection();
      const text = sel.toString().trim();
      if (!text || text.length < 5) return;

      // Only for article content
      const article = document.querySelector('article');
      if (!article || !article.contains(sel.anchorNode)) return;

      // Otomatik chat'e aktar (tooltip yok)
      selectedText = text;
      if (!isOpen) toggleChat();
      setTimeout(() => {
        updateSelectedBar();
      }, 100);
    });
  }

  function updateSelectedBar() {
    const bar = document.getElementById('acm-chat-selected-bar');
    const textEl = document.getElementById('acm-chat-selected-text');
    if (!bar || !textEl) return;
    if (selectedText) {
      const short = selectedText.length > 40 ? selectedText.substring(0, 40) + '...' : selectedText;
      textEl.textContent = '"' + short + '"';
      bar.style.display = 'flex';
    } else {
      bar.style.display = 'none';
    }
  }

  window._acmClearSelection = function() {
    selectedText = '';
    updateSelectedBar();
  };

  // ==================== Helpers ====================
  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
  }

  // Init when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
