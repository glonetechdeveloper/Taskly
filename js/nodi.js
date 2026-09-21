/* ==========================================================
   TASKLY — nodi.js
   Frontend Integration for Nodi AI Chatbot (POST /chat)
   - Bottom-Right Floating Chat Window Interface
   - Built-in Markdown Parser for rich AI replies
   - Action Badges for Tool Executions & live refresh
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

  /* ---------------- Robust Python List & String Parser ---------------- */
  function parsePythonList(raw) {
    if (!raw) return [];
    const items = [];
    const regex = /'([^'\\]*(?:\\.[^'\\]*)*)'|"([^"\\]*(?:\\.[^"\\]*)*)"/g;
    let match;
    while ((match = regex.exec(raw)) !== null) {
      items.push(match[1] !== undefined ? match[1] : match[2]);
    }
    return items;
  }

  /* ---------------- Human Text Sanitizer ---------------- */
  function formatHumanText(text) {
    if (!text) return "";
    let clean = String(text);

    // Convert raw "No node in this roadmap matches..." Python error dump into polite, clean markdown
    const nodeMismatchRegex = /No node in this roadmap matches\s+['"]?([^'".]+)['"]?\.\s*Here are the available nodes:\s*\[([\s\S]*?)\]/i;
    const nodeMismatchMatch = clean.match(nodeMismatchRegex);
    if (nodeMismatchMatch) {
      const query = nodeMismatchMatch[1].trim();
      const items = parsePythonList(nodeMismatchMatch[2]);
      if (items.length > 0) {
        return `I couldn't find a task matching **"${query}"** in this roadmap.\n\n**Here are the tasks available in this roadmap:**\n` + items.map(it => `• ${it}`).join("\n");
      }
      return `I couldn't find a task matching **"${query}"** in this roadmap.`;
    }

    // Convert generic Python list array dumps: ['item 1', 'item 2'] into clean comma-separated text
    clean = clean.replace(/\[\s*(?:'[^']*'|"[^"]*")(?:\s*,\s*(?:'[^']*'|"[^"]*"))*\s*\]/g, (match) => {
      const items = parsePythonList(match);
      return items.length > 0 ? items.join(", ") : match;
    });

    // Convert raw markdown tables with IDs/UUIDs into clean conversational English bullet points
    if (clean.includes("|") && (clean.toLowerCase().includes("id") || /[0-9a-f]{8}-[0-9a-f]{4}/i.test(clean))) {
      const lines = clean.split("\n");
      const items = [];
      lines.forEach(line => {
        const parts = line.split("|").map(p => p.trim()).filter(Boolean);
        if (parts.length >= 2) {
          if (parts[0].toLowerCase().includes("id") || parts[0].includes("---")) return;
          const title = parts.find(p => !/^[0-9a-f]{8}-[0-9a-f]{4}/i.test(p) && p !== "sequential" && p !== "flat" && p !== "done" && p !== "pending" && !/^\d+%$/.test(p));
          const pct = parts.find(p => /^\d+%$/.test(p)) || "0%";
          if (title) {
            items.push(`• **${title}** (${pct} complete)`);
          }
        }
      });
      if (items.length > 0) {
        return "Here's a list of your active roadmaps:\n\n" + items.join("\n");
      }
    }

    // Strip raw UUIDs and backend JSON formatting
    clean = clean.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "");
    clean = clean.replace(/\|---.*---|/g, "");
    clean = clean.replace(/\|\s*(sequential|flat)\s*\|\s*(done|pending)\s*\|/gi, "");

    return clean;
  }

  /* ---------------- Nodi AI Controller ---------------- */
  const NodiAI = {
    history: [],
    isOpen: false,
    isSending: false,
    activePolls: {},

    init() {
      const path = window.location.pathname.toLowerCase();
      if (path.endsWith("login.html") || path.endsWith("signup.html")) {
        return; // Exclude chatbot on login and signup pages
      }
      this.ensureModalDOM();
      this.loadHistory();
      this.reconcileIndicators();
      this.bindEvents();
      this.renderHistory();
    },

    ensureModalDOM() {
      let overlay = document.getElementById("nodiOverlay");
      if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "nodiOverlay";
        document.body.appendChild(overlay);
      }

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
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
              <button class="nodi-action-btn" id="nodiCloseBtn" title="Close" aria-label="Close">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          </div>

          <div class="nodi-body" id="nodiBody"></div>

          <div class="nodi-suggestions" id="nodiSuggestions">
            <button class="suggestion-chip" type="button">What are my active roadmaps?</button>
            <button class="suggestion-chip" type="button">Create a python study roadmap</button>
            <button class="suggestion-chip" type="button">How do I keep my streak?</button>
          </div>

          <div class="nodi-input-row">
            <input class="nodi-input" id="nodiInput" type="text" placeholder="Ask Nodi anything…" maxlength="500">
            <button class="send-btn" id="nodiSendBtn" type="button" aria-label="Send message">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="m22 2-7 20-4-9-9-4Z"/>
                <path d="M22 2 11 13"/>
              </svg>
            </button>
          </div>
        </div>
      `;

      // Don't render floating chatbot button on login or signup pages
      const path = (window.location.pathname || "").toLowerCase();
      const isAuthPage = path.endsWith("login.html") || path.endsWith("signup.html");

      // Remove any duplicate or legacy buttons first
      document.querySelectorAll("#nodiBtn, .help-bubble, #nodiFloatingBtn, #helpBubble, .nodi-floating-trigger").forEach((btn, idx) => {
        if (isAuthPage || idx > 0) {
          btn.remove();
        }
      });

      if (isAuthPage) return;

      let existingFloat = document.getElementById("nodiFloatingBtn");
      if (!existingFloat) {
        const floatBtn = document.createElement("button");
        floatBtn.id = "nodiFloatingBtn";
        floatBtn.className = "nodi-floating-trigger open-nodi-modal";
        floatBtn.type = "button";
        floatBtn.setAttribute("aria-label", "Open Nodi AI Chat");
        floatBtn.setAttribute("title", "Ask Nodi AI");
        floatBtn.innerHTML = `
          <img src="assets/Nodi.png" alt="Nodi AI" class="nodi-float-avatar" onerror="this.src='assets/tasklylogo.png'">
          <span class="nodi-float-label">Ask Nodi</span>
        `;
        document.body.appendChild(floatBtn);
      }
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
              text: "Hey! I'm **Nodi**, your AI learning assistant. Ask me to create roadmaps, break down goals, or track your progress!",
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
        window.dispatchEvent(new CustomEvent("taskly:chat-updated", { detail: { source: "nodi" } }));
      } catch (e) {}
    },

    async reconcileIndicators() {
      let roadmaps = [];
      try {
        if (window.TasklyAPI && typeof window.TasklyAPI.getDashboard === "function") {
          const res = await window.TasklyAPI.getDashboard();
          if (Array.isArray(res)) roadmaps = res;
          else if (res && Array.isArray(res.roadmaps)) roadmaps = res.roadmaps;
        }
      } catch (e) {}

      let changed = false;
      this.history.forEach((msg) => {
        const text = msg.text !== undefined ? msg.text : (msg.content || "");
        if (msg.indicator) {
          const ind = msg.indicator;
          const curStatus = (ind.status || "").toLowerCase();
          if (curStatus !== "done" && curStatus !== "failed") {
            let matched = null;
            if (ind.roadmapId) {
              matched = roadmaps.find(r => String(r.id) === String(ind.roadmapId));
            }
            if (!matched && text) {
              matched = roadmaps.find(r => {
                const t = (r.title || r.goal_text || "").toLowerCase();
                return t && text.toLowerCase().includes(t);
              });
            }
            if (matched) {
              ind.roadmapId = matched.id;
              const rStatus = (matched.status || "done").toLowerCase();
              const hasNodes = Array.isArray(matched.nodes) && matched.nodes.length > 0;
              if (rStatus === "done" || hasNodes) {
                ind.status = "done";
                changed = true;
              } else if (rStatus === "failed") {
                ind.status = "failed";
                changed = true;
              } else if (rStatus && rStatus !== curStatus) {
                ind.status = rStatus;
                changed = true;
              }
            }
          }
        }
      });

      if (changed) {
        this.saveHistory();
        this.renderHistory();
      }

      this.history.forEach((msg) => {
        if (msg.indicator && msg.indicator.roadmapId) {
          const s = (msg.indicator.status || "").toLowerCase();
          if (s !== "done" && s !== "failed") {
            this.startRoadmapPolling(msg.indicator.roadmapId);
          }
        }
      });
    },

    startRoadmapPolling(roadmapId) {
      if (!roadmapId || this.activePolls[roadmapId]) return;

      const pollFn = async () => {
        try {
          if (!window.TasklyAPI || typeof window.TasklyAPI.getGenerationStatus !== "function") return;
          const res = await window.TasklyAPI.getGenerationStatus(roadmapId);
          const currentStatus = (res && (res.status || (res.roadmap && res.roadmap.status) || "")).toLowerCase();

          this.loadHistory();
          let changed = false;
          this.history.forEach((m) => {
            if (m.indicator && String(m.indicator.roadmapId) === String(roadmapId)) {
              if (m.indicator.status !== currentStatus) {
                m.indicator.status = currentStatus;
                if (currentStatus === "failed") {
                  m.indicator.error = res && res.error_message;
                }
                changed = true;
              }
            }
          });

          if (changed) {
            this.saveHistory();
            this.renderHistory();
          }

          if (currentStatus === "done" || currentStatus === "failed") {
            clearInterval(this.activePolls[roadmapId]);
            delete this.activePolls[roadmapId];
            if (window.TasklyAPI && window.TasklyAPI.clearActiveGeneration) {
              window.TasklyAPI.clearActiveGeneration(roadmapId);
            }
            if (currentStatus === "done") {
              if (window.TasklyAPI && typeof window.TasklyAPI.addNotification === "function") {
                window.TasklyAPI.addNotification({
                  message: "Nodi finished creating your roadmap!",
                  type: "roadmap",
                  roadmap_id: roadmapId
                });
              }
              if (window.TasklyDashboard && typeof window.TasklyDashboard.fetchUserRoadmaps === "function") {
                window.TasklyDashboard.fetchUserRoadmaps();
              }
            }
          }
        } catch (err) {
          console.warn("Nodi polling roadmap creation status error:", err);
        }
      };

      this.activePolls[roadmapId] = setInterval(pollFn, 500);
      pollFn();
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
        document.body.classList.add("nodi-open");
        document.querySelectorAll("#nodiBtn, .help-bubble, #nodiFloatingBtn").forEach(b => b.style.display = "none");
        this.reconcileIndicators();
        setTimeout(() => {
          const input = document.getElementById("nodiInput");
          if (input) input.focus();
        }, 50);
      }
    },

    close() {
      this.isOpen = false;
      const overlay = document.getElementById("nodiOverlay");
      if (overlay) overlay.classList.remove("is-open");
      document.body.classList.remove("nodi-open");
      document.querySelectorAll("#nodiBtn, .help-bubble, #nodiFloatingBtn").forEach(b => b.style.display = "flex");
    },

    toggle() {
      if (this.isOpen) {
        this.close();
      } else {
        this.open();
      }
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

    formatCleanActionResult(act) {
      if (!act) return null;
      const result = typeof act.result === "string" ? act.result : (typeof act === "string" ? act : "");

      // Filter out internal noisy discovery/listing tool steps that clutter the conversation
      if (/^listed\s+\d+\s+roadmap/i.test(result.trim()) || /^list_roadmaps/i.test(String(act.tool || ""))) {
        return null;
      }

      let clean = result.replace(/\(id:[^)]+\)/gi, "").replace(/status:\s*\w+/gi, "").trim();
      clean = clean.replace(/,\s*\)/g, ")").replace(/\s{2,}/g, " ").trim();
      
      if (clean) return clean;
      if (act.tool) {
        const tool = String(act.tool).replace(/_/g, " ");
        return tool.charAt(0).toUpperCase() + tool.slice(1);
      }
      return null;
    },

    appendMessageDOM(msg) {
      const body = document.getElementById("nodiBody");
      if (!body) return;

      const sender = msg.sender || msg.role || "nodi";
      const text = msg.text !== undefined ? msg.text : (msg.content || "");

      const bubble = document.createElement("div");
      bubble.className = `chat-bubble from-${sender}`;

      if (sender === "user") {
        bubble.textContent = text;
      } else {
        const humanified = formatHumanText(text);
        bubble.innerHTML = parseMarkdown(humanified);

        // Render Action Badges
        if (Array.isArray(msg.actions) && msg.actions.length > 0) {
          msg.actions.forEach(act => {
            const cleanLabel = this.formatCleanActionResult(act);
            if (cleanLabel) {
              const badge = document.createElement("div");
              badge.className = "nodi-action-badge";
              badge.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span>${cleanLabel}</span>
              `;
              bubble.appendChild(badge);
            }
          });
        }

        // Render Roadmap Indicator Badge (in sync with dashboard inline chat)
        if (msg.indicator) {
          const ind = msg.indicator;
          const status = (ind.status || "generating_phases").toLowerCase();
          const badge = document.createElement("div");

          if (status === "done") {
            badge.className = "nodi-action-badge is-done";
            badge.innerHTML = `
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
              <span>Roadmap created!</span>
              <a href="roadmap.html?id=${encodeURIComponent(ind.roadmapId)}" class="view-link" style="color:inherit; text-decoration:underline; font-weight:700; margin-left:4px;">View Roadmap →</a>
            `;
          } else if (status === "failed") {
            badge.className = "nodi-action-badge is-failed";
            badge.style.cssText = "color:#DC2626; background:#FEE2E2; border-color:#FCA5A5;";
            badge.innerHTML = `
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <span>Generation failed${ind.error ? ': ' + escapeHtml(ind.error) : ''}</span>
            `;
          } else {
            const stageName = status === "generating_tasks" ? "generating tasks…" : "generating phases…";
            badge.className = "nodi-action-badge is-generating";
            badge.innerHTML = `
              <span class="spinner-ring" style="width:12px; height:12px; border-width:1.5px; border-top-color:currentColor;"></span>
              <span>Creating your roadmap (${stageName})</span>
            `;
          }
          bubble.appendChild(badge);
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
      if (this.isSending) return; // Prevent double sending

      const input = document.getElementById("nodiInput");
      const text = (typeof customText === "string" ? customText : (input ? input.value : "")).trim();
      if (!text) return;

      this.isSending = true;
      if (input) input.value = "";

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
        let reply = "";
        let actions = [];

        if (window.TasklyAPI && typeof window.TasklyAPI.chat === "function") {
          const res = await window.TasklyAPI.chat(text);
          reply = res.reply || res.message || "I processed your request.";
          actions = res.actions_taken || res.actions || [];
        } else {
          reply = `I processed your request for: "${text}". You can ask me to create roadmaps or check your streak anytime!`;
        }

        this.hideTyping();

        const nodiMsg = {
          sender: "nodi",
          text: formatHumanText(reply),
          actions: actions,
          timestamp: new Date().toISOString()
        };

        // Check if actions_taken has create_roadmap
        let createdRoadmapId = null;
        if (Array.isArray(actions) && actions.length > 0) {
          const createAction = actions.find(a => {
            const tool = String(a.tool || a.name || a.action || "").toLowerCase();
            const resText = String(a.result || "").toLowerCase();
            return tool.includes("create_roadmap") || resText.includes("created roadmap");
          });

          if (createAction) {
            createdRoadmapId = createAction.roadmap_id || createAction.id;
            if (!createdRoadmapId && typeof createAction.result === "string") {
              const idMatch = createAction.result.match(/\(id:\s*([^)]+)\)/i);
              if (idMatch) createdRoadmapId = idMatch[1].trim();
            }
          }
        }

        if (createdRoadmapId) {
          nodiMsg.indicator = {
            roadmapId: createdRoadmapId,
            status: "generating_phases"
          };
          this.history.push(nodiMsg);
          this.appendMessageDOM(nodiMsg);
          this.saveHistory();
          this.startRoadmapPolling(createdRoadmapId);
          window.dispatchEvent(new CustomEvent("taskly:roadmap-created", { detail: { id: createdRoadmapId } }));
          if (window.TasklyDashboard && typeof window.TasklyDashboard.fetchUserRoadmaps === "function") {
            window.TasklyDashboard.fetchUserRoadmaps();
          }
        } else {
          this.history.push(nodiMsg);
          this.appendMessageDOM(nodiMsg);
          this.saveHistory();
          this.reconcileIndicators();
        }

        if (Array.isArray(actions) && actions.length > 0) {
          actions.forEach(a => {
            const tool = String(a.tool || "");
            const res = typeof a.result === "string" ? a.result : "";
            if (tool.includes("roadmap")) {
              window.dispatchEvent(new CustomEvent("taskly:roadmap-created", { detail: a.result }));
            }
            if (tool.includes("node") || tool.includes("task")) {
              window.dispatchEvent(new CustomEvent("taskly:node-completed", { detail: a.result }));
              if (window.TasklyAPI && typeof window.TasklyAPI.addNotification === "function" && res) {
                const clean = res.replace(/\(id:[^)]+\)/gi, "").trim();
                window.TasklyAPI.addNotification({
                  message: `Nodi: ${clean}`,
                  type: "milestone"
                });
              }
            }
            if (tool.includes("streak")) {
              window.dispatchEvent(new CustomEvent("taskly:streak-updated", { detail: a.result }));
            }
          });
        }
      } catch (err) {
        this.hideTyping();
        const friendlyMsg = window.TasklyAPI && window.TasklyAPI.sanitizeError ? window.TasklyAPI.sanitizeError(err) : "Failed to reach Nodi AI. Please try again in a moment.";
        const errorMsg = {
          sender: "nodi",
          text: `⚠️ ${friendlyMsg}`,
          timestamp: new Date().toISOString()
        };
        this.history.push(errorMsg);
        this.appendMessageDOM(errorMsg);
        this.saveHistory();
      } finally {
        this.isSending = false;
      }
    },

    bindEvents() {
      const closeBtn = document.getElementById("nodiCloseBtn");
      const clearBtn = document.getElementById("nodiClearBtn");
      const sendBtn = document.getElementById("nodiSendBtn");
      const input = document.getElementById("nodiInput");
      const suggestions = document.getElementById("nodiSuggestions");

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

      // Close on clicking outside floating chat modal
      document.addEventListener("click", (e) => {
        if (!this.isOpen) return;
        const modal = document.querySelector(".modal-nodi");
        const isTrigger = e.target.closest(".open-nodi-modal, #sidebarNewChatBtn, .sidebar-btn-new-chat, #sidebarChatBtn, #askNodiSidebar, #nodiBtn, #nodiFloatingBtn");
        if (modal && !modal.contains(e.target) && !isTrigger) {
          this.close();
        }
      });

      // Close on Escape key
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && this.isOpen) {
          this.close();
        }
      });

      // Two-way synchronization with dashboard chat modal & other tabs
      window.addEventListener("taskly:chat-updated", (e) => {
        if (e && e.detail && e.detail.source === "nodi") return;
        this.loadHistory();
        this.renderHistory();
      });

      window.addEventListener("storage", (e) => {
        if (e.key === STORAGE_KEY) {
          this.loadHistory();
          this.renderHistory();
        }
      });

      // Bind all Nodi opening triggers across the app
      document.querySelectorAll(".open-nodi-modal, #sidebarNewChatBtn, .sidebar-btn-new-chat, #sidebarChatBtn, #askNodiSidebar, #nodiBtn, #nodiFloatingBtn").forEach(btn => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.open();
        });
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
