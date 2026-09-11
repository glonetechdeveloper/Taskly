/* ==========================================================
   TASKLY — nodi.js
   Frontend Integration for Nodi AI Chatbot (POST /chat)
   ========================================================== */

(function () {
  const STORAGE_KEY = "taskly_nodi_chat_history";

  const DEFAULT_MESSAGES = [
    {
      role: "assistant",
      text: "Hey! I'm Nodi 👋 I can organize your roadmaps, check your study progress, generate new learning paths, or complete tasks for you. What would you like to do today?",
      actions: [],
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ];

  const NodiChat = {
    history: [],
    isOpen: false,
    isLoading: false,

    init() {
      this.loadHistory();
      this.renderWidgetMarkup();
      this.bindTriggers();
      this.renderMessages();
    },

    loadHistory() {
      try {
        const stored = sessionStorage.getItem(STORAGE_KEY);
        if (stored) {
          this.history = JSON.parse(stored);
        } else {
          this.history = [...DEFAULT_MESSAGES];
        }
      } catch (e) {
        this.history = [...DEFAULT_MESSAGES];
      }
    },

    saveHistory() {
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(this.history));
      } catch (e) {}
    },

    renderWidgetMarkup() {
      // 1. Floating Action Button (FAB)
      if (!document.getElementById("nodiFabTrigger")) {
        const fab = document.createElement("button");
        fab.id = "nodiFabTrigger";
        fab.className = "nodi-fab-trigger";
        fab.setAttribute("aria-label", "Ask Nodi AI");
        fab.innerHTML = `
          <div class="nodi-fab-avatar-wrap">
            <img src="assets/Nodi.png" alt="Nodi AI">
            <span class="nodi-fab-online-dot"></span>
          </div>
          <div class="nodi-fab-text">
            <span class="nodi-fab-title">Ask Nodi AI</span>
            <span class="nodi-fab-subtitle">Online & ready</span>
          </div>
        `;
        document.body.appendChild(fab);
      }

      // 2. Chat Overlay Window
      if (!document.getElementById("nodiChatOverlay")) {
        const overlay = document.createElement("div");
        overlay.id = "nodiChatOverlay";
        overlay.setAttribute("aria-hidden", "true");
        overlay.innerHTML = `
          <div class="nodi-chat-window" role="dialog" aria-modal="true" aria-label="Nodi AI Assistant">
            <!-- Header -->
            <div class="nodi-window-header">
              <div class="nodi-window-profile">
                <div class="nodi-window-avatar-wrap">
                  <img src="assets/Nodi.png" alt="Nodi AI">
                  <span class="nodi-window-online-dot"></span>
                </div>
                <div class="nodi-window-info">
                  <p class="name">Nodi AI</p>
                  <p class="status">
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="#10B981"><circle cx="4" cy="4" r="4"/></svg>
                    Active Assistant
                  </p>
                </div>
              </div>
              <div class="nodi-window-actions">
                <button class="nodi-btn-icon" id="nodiResetChatBtn" title="Reset conversation" aria-label="Reset chat">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                    <path d="M3 3v5h5"/>
                  </svg>
                </button>
                <button class="nodi-btn-icon" id="nodiCloseChatBtn" title="Close chat" aria-label="Close chat">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            </div>

            <!-- Message Area -->
            <div class="nodi-messages-body" id="nodiMessagesBody"></div>

            <!-- Suggestion Chips -->
            <div class="nodi-suggestions-row" id="nodiSuggestionsRow">
              <button class="nodi-suggestion-chip" type="button" data-prompt="What roadmaps do I have right now?">What roadmaps do I have?</button>
              <button class="nodi-suggestion-chip" type="button" data-prompt="How is my progress?">Check progress</button>
              <button class="nodi-suggestion-chip" type="button" data-prompt="Create a roadmap for Python Basics">Create Python roadmap</button>
              <button class="nodi-suggestion-chip" type="button" data-prompt="Complete my next task">Complete task</button>
            </div>

            <!-- Input bar -->
            <form class="nodi-input-bar" id="nodiChatForm">
              <input class="nodi-input-field" id="nodiChatInput" type="text" placeholder="Ask Nodi anything or give an action…" maxlength="400" autocomplete="off">
              <button class="nodi-input-send-btn" id="nodiChatSendBtn" type="submit" aria-label="Send message">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"/>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              </button>
            </form>
          </div>
        `;
        document.body.appendChild(overlay);
      }
    },

    bindTriggers() {
      // FAB Trigger
      const fab = document.getElementById("nodiFabTrigger");
      if (fab) fab.addEventListener("click", () => this.toggleChat());

      // Open buttons across pages (e.g. in sidebar, topbar, dashboard cards)
      document.querySelectorAll(".open-nodi-chat, [data-open-nodi], #askNodiFab, #askNodiSidebar").forEach(btn => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          this.openChat();
        });
      });

      // Close button
      const closeBtn = document.getElementById("nodiCloseChatBtn");
      if (closeBtn) closeBtn.addEventListener("click", () => this.closeChat());

      // Reset button
      const resetBtn = document.getElementById("nodiResetChatBtn");
      if (resetBtn) resetBtn.addEventListener("click", () => this.resetConversation());

      // Overlay backdrop click
      const overlay = document.getElementById("nodiChatOverlay");
      if (overlay) {
        overlay.addEventListener("click", (e) => {
          if (e.target === overlay) this.closeChat();
        });
      }

      // Escape key to close
      window.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && this.isOpen) this.closeChat();
      });

      // Chat form submit
      const form = document.getElementById("nodiChatForm");
      if (form) {
        form.addEventListener("submit", (e) => {
          e.preventDefault();
          this.handleSendMessage();
        });
      }

      // Suggestion chips
      document.addEventListener("click", (e) => {
        const chip = e.target.closest(".nodi-suggestion-chip");
        if (chip && chip.dataset.prompt) {
          const input = document.getElementById("nodiChatInput");
          if (input) {
            input.value = chip.dataset.prompt;
            this.handleSendMessage();
          }
        }
      });
    },

    openChat() {
      const overlay = document.getElementById("nodiChatOverlay");
      if (!overlay) return;
      this.isOpen = true;
      overlay.classList.add("is-open");
      overlay.setAttribute("aria-hidden", "false");
      this.scrollToBottom();
      setTimeout(() => {
        const input = document.getElementById("nodiChatInput");
        if (input) input.focus();
      }, 100);
    },

    closeChat() {
      const overlay = document.getElementById("nodiChatOverlay");
      if (!overlay) return;
      this.isOpen = false;
      overlay.classList.remove("is-open");
      overlay.setAttribute("aria-hidden", "true");
    },

    toggleChat() {
      if (this.isOpen) {
        this.closeChat();
      } else {
        this.openChat();
      }
    },

    resetConversation() {
      this.history = [...DEFAULT_MESSAGES];
      this.saveHistory();
      this.renderMessages();
    },

    renderMessages() {
      const body = document.getElementById("nodiMessagesBody");
      if (!body) return;

      body.innerHTML = this.history.map(msg => {
        const isUser = msg.role === "user";
        
        let actionsHtml = "";
        if (Array.isArray(msg.actions) && msg.actions.length > 0) {
          actionsHtml = `
            <div class="nodi-actions-list">
              ${msg.actions.map(act => {
                let pillClass = "";
                let iconSvg = '<svg class="nodi-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>';
                
                if (act.tool === "create_roadmap") {
                  pillClass = "is-create";
                  iconSvg = '<svg class="nodi-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>';
                } else if (act.tool === "get_roadmap_progress" || act.tool === "list_roadmaps") {
                  pillClass = "is-progress";
                  iconSvg = '<svg class="nodi-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>';
                }

                return `
                  <div class="nodi-action-pill ${pillClass}">
                    ${iconSvg}
                    <span>${this.escapeHtml(act.result || act.tool)}</span>
                  </div>
                `;
              }).join("")}
            </div>
          `;
        }

        return `
          <div class="nodi-message-row ${isUser ? 'is-user' : 'is-assistant'}">
            ${!isUser ? '<img class="nodi-msg-avatar" src="assets/Nodi.png" alt="Nodi">' : ''}
            <div class="nodi-msg-content">
              <div class="nodi-msg-bubble">${this.formatMessageText(msg.text)}</div>
              ${actionsHtml}
              <span class="nodi-msg-time">${msg.time || ''}</span>
            </div>
          </div>
        `;
      }).join("");

      if (this.isLoading) {
        body.innerHTML += `
          <div class="nodi-typing-row">
            <img class="nodi-msg-avatar" src="assets/Nodi.png" alt="Nodi">
            <div class="nodi-typing-bubble">
              <span class="nodi-typing-dot"></span>
              <span class="nodi-typing-dot"></span>
              <span class="nodi-typing-dot"></span>
            </div>
          </div>
        `;
      }

      this.scrollToBottom();
    },

    scrollToBottom() {
      const body = document.getElementById("nodiMessagesBody");
      if (body) {
        setTimeout(() => {
          body.scrollTop = body.scrollHeight;
        }, 30);
      }
    },

    formatMessageText(text) {
      if (!text) return "";
      let formatted = this.escapeHtml(text);
      // Bold **text**
      formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      // Inline quotes 'text'
      formatted = formatted.replace(/'(.*?)'/g, '<code>$1</code>');
      // Line breaks
      formatted = formatted.replace(/\n/g, '<br>');
      return formatted;
    },

    escapeHtml(str) {
      if (!str) return "";
      return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    },

    async handleSendMessage() {
      const input = document.getElementById("nodiChatInput");
      const sendBtn = document.getElementById("nodiChatSendBtn");
      if (!input) return;

      const userText = input.value.trim();
      if (!userText || this.isLoading) return;

      input.value = "";
      this.isLoading = true;
      if (sendBtn) sendBtn.disabled = true;

      const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      // Add user message to history
      this.history.push({
        role: "user",
        text: userText,
        actions: [],
        time: nowTime
      });
      this.saveHistory();
      this.renderMessages();

      try {
        let response = null;
        if (window.TasklyAPI && window.TasklyAPI.chat) {
          response = await window.TasklyAPI.chat(userText);
        } else {
          // Fallback if API not available
          response = {
            reply: "I received your message! However, the connection client is initializing. Please try again in a moment.",
            actions_taken: []
          };
        }

        const replyText = (response && (response.reply || response.message)) || "I've processed your request.";
        const actionsTaken = (response && Array.isArray(response.actions_taken)) ? response.actions_taken : [];

        // Add assistant message
        this.history.push({
          role: "assistant",
          text: replyText,
          actions: actionsTaken,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
        this.saveHistory();

        // Process Action Invalidation / State Synchronization
        this.handleActionsSynchronization(actionsTaken);

      } catch (err) {
        console.error("[Nodi AI Chat Error]", err);
        let errorReply = "Sorry, I had trouble reaching the server. Please verify your connection or try again shortly.";
        if (err && err.message && err.message.includes("not fully set up")) {
          errorReply = err.message;
        }

        this.history.push({
          role: "assistant",
          text: errorReply,
          actions: [],
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
        this.saveHistory();
      } finally {
        this.isLoading = false;
        if (sendBtn) sendBtn.disabled = false;
        this.renderMessages();
        if (input) input.focus();
      }
    },

    handleActionsSynchronization(actions) {
      if (!Array.isArray(actions) || actions.length === 0) return;

      let hasRoadmapCreation = false;
      let hasNodeCompletion = false;

      actions.forEach(action => {
        const tool = action.tool || "";
        if (tool === "create_roadmap") {
          hasRoadmapCreation = true;
        }
        if (tool === "complete_node") {
          hasNodeCompletion = true;
        }
      });

      // 1. Invalidate roadmaps if a new roadmap was created
      if (hasRoadmapCreation) {
        if (window.TasklyAPI && window.TasklyAPI.emit) {
          window.TasklyAPI.emit("taskly:roadmaps-updated", { source: "nodi" });
        }
        // If current page is dashboard or roadmap manager, refresh data
        if (typeof window.loadRoadmaps === "function") {
          window.loadRoadmaps();
        }
      }

      // 2. Invalidate streak & nodes if a node was completed
      if (hasNodeCompletion) {
        if (window.StreakManager && window.StreakManager.refresh) {
          window.StreakManager.refresh();
        }
        if (window.TasklyAPI && window.TasklyAPI.emit) {
          window.TasklyAPI.emit("taskly:nodes-updated", { source: "nodi" });
          window.TasklyAPI.emit("taskly:streak-updated", { source: "nodi" });
        }
        // If on roadmap page, refresh current roadmap detail
        if (typeof window.loadRoadmapDetail === "function") {
          window.loadRoadmapDetail();
        }
      }
    }
  };

  window.NodiChat = NodiChat;

  // Auto initialize on DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => NodiChat.init());
  } else {
    NodiChat.init();
  }
})();
