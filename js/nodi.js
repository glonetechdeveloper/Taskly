/* ==========================================================
   TASKLY — nodi.js
   Frontend Integration for Nodi AI Chatbot (POST /chat)
   - Classic Centered Modal Interface
   - Built-in Robust Markdown Parser for formatted AI replies
   - Action Badges for Tool Executions
   - Session & LocalStorage Sync
   ========================================================== */

(function () {
  const STORAGE_KEY = "taskly_nodi_history_v2";

  /* ---------------- Robust Markdown Parser ---------------- */
  function parseMarkdown(md) {
    if (!md) return "";
    let html = String(md);

    // Escape raw HTML tags (excluding ones we generate)
    html = html.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    // Code blocks with backticks ```lang\ncode\n```
    html = html.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
      return `<pre><code class="lang-${lang}">${code.trim()}</code></pre>`;
    });

    // Inline code `code`
    html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

    // Headers
    html = html.replace(/^### (.*$)/gim, "<h3>$1</h3>");
    html = html.replace(/^## (.*$)/gim, "<h2>$1</h2>");
    html = html.replace(/^# (.*$)/gim, "<h1>$1</h1>");

    // Bold & Italic
    html = html.replace(/\*\*\*(.*?)\*\*\*/g, "<strong><em>$1</em></strong>");
    html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
    html = html.replace(/___(.*?)___/g, "<strong><em>$1</em></strong>");
    html = html.replace(/__(.*?)__/g, "<strong>$1</strong>");
    html = html.replace(/_(.*?)_/g, "<em>$1</em>");

    // Unordered lists (- or *)
    html = html.replace(/^\s*[-*]\s+(.*)$/gim, "<li>$1</li>");
    html = html.replace(/(<li>.*<\/li>(\n?<li>.*<\/li>)*)/gim, "<ul>$1</ul>");

    // Numbered lists (1. 2. etc)
    html = html.replace(/^\s*(\d+)\.\s+(.*)$/gim, "<li>$2</li>");

    // Blockquotes
    html = html.replace(/^\s*&gt;\s+(.*)$/gim, "<blockquote>$1</blockquote>");

    // Links [text](url)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:#0D9488; text-decoration:underline;">$1</a>');

    // Paragraph line breaks
    const lines = html.split("\n");
    const formatted = lines.map(line => {
      const trimmed = line.trim();
      if (!trimmed) return "";
      if (/^<(h\d|ul|ol|li|pre|blockquote)/.test(trimmed)) return trimmed;
      return `<p>${trimmed}</p>`;
    }).filter(Boolean).join("");

    return formatted || html;
  }

  /* ---------------- Nodi AI Controller ---------------- */
  const NodiAI = {
    history: [],
    isOpen: false,

    init() {
      this.ensureModalDOM();
      this.loadHistory();
      this.bindEvents();
      this.renderHistory();
    },

    ensureModalDOM() {
      if (document.getElementById("nodiOverlay")) return;

      const overlay = document.createElement("div");
      overlay.id = "nodiOverlay";
      overlay.className = "modal-overlay";
      overlay.innerHTML = `
        <div class="modal modal-nodi" role="dialog" aria-modal="true" aria-label="Ask Nodi AI">
          <div class="nodi-header">
            <img src="assets/Nodi.png" alt="Nodi AI" onerror="this.src='assets/tasklylogo.png'">
            <div class="nodi-header-text">
              <p class="name">Nodi <span class="nodi-ai-tag">AI</span></p>
              <p class="status">Online</p>
            </div>
            <div class="nodi-header-actions">
              <button class="nodi-action-btn" id="nodiClearBtn" title="Clear conversation" aria-label="Clear chat">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
              <button class="nodi-action-btn" id="nodiCloseBtn" title="Close" aria-label="Close">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          </div>
          <div class="nodi-body" id="nodiBody"></div>
          <div class="nodi-suggestions" id="nodiSuggestions">
            <button class="suggestion-chip" type="button">What roadmaps do I have?</button>
            <button class="suggestion-chip" type="button">How does my study streak work?</button>
            <button class="suggestion-chip" type="button">Help me stay on track today</button>
          </div>
          <div class="nodi-input-row">
            <input class="nodi-input" id="nodiInput" type="text" placeholder="Message Nodi…" maxlength="500">
            <button class="send-btn" id="nodiSendBtn" type="button" aria-label="Send message">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
              </svg>
            </button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
    },

    loadHistory() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          this.history = JSON.parse(raw);
        } else {
          this.history = [
            {
              sender: "nodi",
              text: "Hey, I'm **Nodi** 👋 I can answer your questions, create custom roadmaps, checklist tasks, and track your learning progress. How can I help you today?",
              timestamp: new Date().toISOString()
            }
          ];
        }
      } catch (e) {
        this.history = [];
      }
    },

    saveHistory() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.history));
      } catch (e) {}
    },

    clearHistory() {
      this.history = [
        {
          sender: "nodi",
          text: "Chat cleared! How can I help you today?",
          timestamp: new Date().toISOString()
        }
      ];
      this.saveHistory();
      this.renderHistory();
    },

    open() {
      this.isOpen = true;
      const overlay = document.getElementById("nodiOverlay");
      if (overlay) {
        overlay.classList.add("is-open");
        setTimeout(() => {
          const input = document.getElementById("nodiInput");
          if (input) input.focus();
        }, 100);
      }
    },

    close() {
      this.isOpen = false;
      const overlay = document.getElementById("nodiOverlay");
      if (overlay) overlay.classList.remove("is-open");
    },

    renderHistory() {
      const body = document.getElementById("nodiBody");
      if (!body) return;
      body.innerHTML = "";

      this.history.forEach((msg) => {
        this.appendMessageDOM(msg);
      });

      body.scrollTop = body.scrollHeight;
    },

    appendMessageDOM(msg) {
      const body = document.getElementById("nodiBody");
      if (!body) return;

      const bubble = document.createElement("div");
      bubble.className = `chat-bubble from-${msg.sender}`;

      if (msg.sender === "user") {
        bubble.textContent = msg.text;
      } else {
        bubble.innerHTML = parseMarkdown(msg.text);

        // Render Action Pills if actions were executed
        if (Array.isArray(msg.actions) && msg.actions.length > 0) {
          msg.actions.forEach(act => {
            const pill = document.createElement("div");
            pill.className = "nodi-action-pill";
            pill.innerHTML = `
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span>${typeof act.result === "string" ? act.result : (act.tool ? `Executed ${act.tool}` : "Action executed")}</span>
            `;
            bubble.appendChild(pill);
          });
        }
      }

      body.appendChild(bubble);
      body.scrollTop = body.scrollHeight;
    },

    showTyping() {
      const body = document.getElementById("nodiBody");
      if (!body) return;

      const typing = document.createElement("div");
      typing.id = "nodiTypingIndicator";
      typing.className = "chat-bubble from-nodi";
      typing.innerHTML = '<div class="typing-dots"><span></span><span></span><span></span></div>';
      body.appendChild(typing);
      body.scrollTop = body.scrollHeight;
    },

    hideTyping() {
      const typing = document.getElementById("nodiTypingIndicator");
      if (typing) typing.remove();
    },

    async sendMessage(customText) {
      const input = document.getElementById("nodiInput");
      const text = (typeof customText === "string" ? customText : (input ? input.value : "")).trim();
      if (!text) return;

      if (input && !customText) input.value = "";

      const userMsg = {
        sender: "user",
        text: text,
        timestamp: new Date().toISOString()
      };
      this.history.push(userMsg);
      this.appendMessageDOM(userMsg);
      this.saveHistory();

      this.showTyping();

      try {
        let replyText = "I'm having trouble connecting to the server right now.";
        let actions = [];

        if (window.TasklyAPI && typeof window.TasklyAPI.chat === "function") {
          const res = await window.TasklyAPI.chat(text);
          if (res) {
            replyText = res.reply || replyText;
            actions = res.actions_taken || [];
          }
        }

        this.hideTyping();

        const nodiMsg = {
          sender: "nodi",
          text: replyText,
          actions: actions,
          timestamp: new Date().toISOString()
        };

        this.history.push(nodiMsg);
        this.appendMessageDOM(nodiMsg);
        this.saveHistory();

        // If actions involved creating a roadmap or updating a node, dispatch custom events
        if (actions.length > 0) {
          actions.forEach(a => {
            const tool = String(a.tool || "").toLowerCase();
            if (tool.includes("roadmap")) {
              window.dispatchEvent(new CustomEvent("taskly:roadmap-created", { detail: a.result }));
            }
            if (tool.includes("node") || tool.includes("task")) {
              window.dispatchEvent(new CustomEvent("taskly:node-completed", { detail: a.result }));
            }
            if (tool.includes("streak")) {
              window.dispatchEvent(new CustomEvent("taskly:streak-updated", { detail: a.result }));
            }
          });
        }
      } catch (err) {
        this.hideTyping();
        const errorMsg = {
          sender: "nodi",
          text: `⚠️ *Error:* ${err.message || "Failed to reach Nodi AI. Please try again."}`,
          timestamp: new Date().toISOString()
        };
        this.history.push(errorMsg);
        this.appendMessageDOM(errorMsg);
        this.saveHistory();
      }
    },

    bindEvents() {
      const overlay = document.getElementById("nodiOverlay");
      const closeBtn = document.getElementById("nodiCloseBtn");
      const clearBtn = document.getElementById("nodiClearBtn");
      const sendBtn = document.getElementById("nodiSendBtn");
      const input = document.getElementById("nodiInput");
      const suggestions = document.getElementById("nodiSuggestions");

      if (overlay) {
        overlay.addEventListener("click", (e) => {
          if (e.target === overlay) this.close();
        });
      }

      if (closeBtn) closeBtn.addEventListener("click", () => this.close());
      if (clearBtn) clearBtn.addEventListener("click", () => this.clearHistory());

      if (sendBtn) sendBtn.addEventListener("click", () => this.sendMessage());
      if (input) {
        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            this.sendMessage();
          }
        });
      }

      if (suggestions) {
        suggestions.addEventListener("click", (e) => {
          const chip = e.target.closest(".suggestion-chip");
          if (chip) {
            this.sendMessage(chip.textContent.trim());
          }
        });
      }

      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && this.isOpen) {
          this.close();
        }
      });
    }
  };

  window.NodiAI = NodiAI;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => NodiAI.init());
  } else {
    NodiAI.init();
  }
})();
