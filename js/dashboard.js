/* ==========================================================
   TASKLY — dashboard.js
   ========================================================== */
window.TasklyDashboard = (function () {

  // Point this at your FastAPI backend. Set window.TASKLY_API_BASE
  // to your API URL in a script tag before this file loads.
  const API_BASE = window.TASKLY_API_BASE || "http://localhost:8000";
  const TOKEN_KEY = "access_token";
  const MAX_CHARS = 500;

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

  function getToken() {
    try {
      return localStorage.getItem("access_token") || localStorage.getItem("taskly_access_token");
    } catch (e) {
      return null;
    }
  }

  function showToast(message, type) {
    const toast = $("#toast");
    if (!toast) return;
    toast.textContent = message;
    toast.className = "toast is-visible" + (type === "success" ? " is-success" : "");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove("is-visible"), 3600);
  }

  /* ---------- generic modal + dropdown plumbing ---------- */

  function openModal(overlayId) {
    closeAllDropdowns();
    const overlay = document.getElementById(overlayId);
    if (overlay) overlay.classList.add("is-open");
  }
  function closeModal(overlayId) {
    const overlay = document.getElementById(overlayId);
    if (overlay) overlay.classList.remove("is-open");
  }
  function closeAllModals() {
    $all(".modal-overlay.is-open").forEach((o) => o.classList.remove("is-open"));
  }
  function closeAllDropdowns() {
    $all(".dropdown-panel.is-open").forEach((d) => d.classList.remove("is-open"));
  }

  function wireGenericModalClosers() {
    $all("[data-close-modal]").forEach((btn) => {
      btn.addEventListener("click", () => closeModal(btn.dataset.closeModal));
    });
    $all(".modal-overlay").forEach((overlay) => {
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) overlay.classList.remove("is-open");
      });
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeAllModals();
        closeAllDropdowns();
      }
    });
  }

  /* ---------- mobile drawer ---------- */

  function wireDrawer() {
    const sidebar = $("#sidebar");
    const overlay = $("#drawerOverlay");
    const openBtn = $("#hamburgerBtn");
    const closeBtn = $("#sidebarCloseBtn");
    if (!sidebar || !overlay) return;

    function open() { sidebar.classList.add("is-open"); overlay.classList.add("is-visible"); }
    function close() { sidebar.classList.remove("is-open"); overlay.classList.remove("is-visible"); }
    openBtn && openBtn.addEventListener("click", open);
    closeBtn && closeBtn.addEventListener("click", close);
    overlay.addEventListener("click", close);
    $all(".nav-link").forEach((link) => link.addEventListener("click", close));
  }

  /* ---------- inline goal / chat card (dashboard body) ---------- */

  function wireChatCard() {
    const textarea = $("#goalInput");
    const charCount = $("#charCount");
    const sendBtn = $("#sendBtn");
    if (!textarea) return;

    function updateCount() {
      const len = textarea.value.length;
      if (charCount) charCount.textContent = `${len}/${MAX_CHARS}`;
      if (sendBtn) sendBtn.disabled = len === 0;
    }
    textarea.addEventListener("input", () => {
      if (textarea.value.length > MAX_CHARS) textarea.value = textarea.value.slice(0, MAX_CHARS);
      updateCount();
    });
    updateCount();

    async function submitInlineGoal() {
      const goal = textarea.value.trim();
      if (!goal) { textarea.focus(); return; }
      await createRoadmapRequest(goal);
      textarea.value = "";
      updateCount();
    }

    sendBtn && sendBtn.addEventListener("click", submitInlineGoal);
    textarea.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitInlineGoal(); }
    });
  }

  /* ---------- shared: call the backend to create a roadmap ---------- */

  async function createRoadmapRequest(goalText) {
    const token = getToken();
    try {
      // POST /roadmaps { goal_text } — kicks off async generation per the API spec.
      const res = await fetch(API_BASE + "/roadmaps", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ goal_text: goalText })
      });
      if (!res.ok) throw new Error("Couldn't start that roadmap. Please try again.");
      return await res.json().catch(() => ({}));
    } catch (err) {
      // Backend isn't wired up in this preview — fail silently upstream,
      // the calling UI (modal) shows its own simulated progress.
      throw err;
    }
  }

  /* ---------- Add New Roadmap modal ---------- */

  function wireAddRoadmapModal() {
    const openBtn = $("#addRoadmapBtn");
    const textarea = $("#modalGoalInput");
    const charCount = $("#modalCharCount");
    const generateBtn = $("#generateRoadmapBtn");
    const formView = $("#addRoadmapFormView");
    const genState = $("#generationState");
    const genMessage = $("#generationMessage");
    if (!openBtn || !textarea) return;

    openBtn.addEventListener("click", () => {
      openModal("addRoadmapOverlay");
      formView.classList.remove("is-hidden");
      genState.classList.remove("is-active");
      setTimeout(() => textarea.focus(), 250);
    });

    function updateCount() {
      const len = textarea.value.length;
      charCount.textContent = len;
      generateBtn.disabled = len === 0;
    }
    textarea.addEventListener("input", updateCount);
    updateCount();

    $all(".example-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        textarea.value = chip.dataset.example;
        updateCount();
        textarea.focus();
      });
    });

    const messages = [
      "Breaking this into phases…",
      "Figuring out what needs to come first…",
      "Filling in the details…"
    ];

    generateBtn.addEventListener("click", () => {
      const goal = textarea.value.trim();
      if (!goal) return;

      formView.classList.add("is-hidden");
      genState.classList.add("is-active");

      let step = 0;
      genMessage.textContent = messages[0];
      const msgInterval = setInterval(() => {
        step++;
        if (step < messages.length) {
          genMessage.style.opacity = 0;
          setTimeout(() => { genMessage.textContent = messages[step]; genMessage.style.opacity = 1; }, 200);
        }
      }, 1000);

      // Try the real backend; regardless of outcome, this is a UI demo
      // so we simulate the generation delay and show a result either way.
      createRoadmapRequest(goal).catch(() => {});

      setTimeout(() => {
        clearInterval(msgInterval);
        closeModal("addRoadmapOverlay");
        formView.classList.remove("is-hidden");
        genState.classList.remove("is-active");
        textarea.value = "";
        updateCount();
        addRoadmapCardToList(goal);
        showToast("Your roadmap is ready!", "success");
      }, 3200);
    });
  }

  function addRoadmapCardToList(goalText) {
    const list = $("#roadmapList");
    if (!list) return;
    const id = "rm-" + Date.now();
    const title = goalText.length > 46 ? goalText.slice(0, 43) + "…" : goalText;
    const variant = list.children.length % 2 === 0 ? "is-teal" : "";

    const card = document.createElement("article");
    card.className = "roadmap-card";
    card.dataset.id = id;
    card.dataset.title = title;
    card.dataset.icon = "ic-route";
    card.dataset.iconVariant = variant;
    card.style.opacity = "0";
    card.style.transform = "translateY(14px)";
    card.innerHTML = [
      '<div class="roadmap-icon ' + variant + '">',
      '  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><use href="#ic-route"></use></svg>',
      '</div>',
      '<div class="roadmap-body">',
      '  <p class="roadmap-title">' + escapeHtml(title) + '</p>',
      '  <div class="progress-track"><div class="progress-fill" data-progress="0" style="width:0%"></div></div>',
      '  <p class="roadmap-meta">0 out of 8 tasks completed</p>',
      '</div>',
      '<button class="card-menu-btn" aria-label="Roadmap options">',
      '  <svg viewBox="0 0 24 24"><use href="#ic-dots"></use></svg>',
      '</button>'
    ].join("\n");
    list.prepend(card);
    wireOneRoadmapCard(card);
    requestAnimationFrame(() => {
      card.style.transition = "opacity .4s ease, transform .4s ease";
      card.style.opacity = "1";
      card.style.transform = "translateY(0)";
    });
    updateEmptyState();
  }

  function escapeHtml(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }

  /* ---------- roadmap cards + options modal ---------- */

  let currentOptionsCard = null;

  function animateProgressBars() {
    $all(".progress-fill").forEach((bar) => {
      const target = bar.dataset.progress || "0";
      setTimeout(() => { bar.style.width = target + "%"; }, 200);
    });
  }

  function openOptionsForCard(card) {
    currentOptionsCard = card;
    const title = card.dataset.title || "Roadmap";
    const metaEl = card.querySelector(".roadmap-meta");
    const meta = metaEl ? metaEl.textContent : "";
    const iconId = card.dataset.icon || "ic-route";
    const variant = card.dataset.iconVariant || "";

    $("#optionsRoadmapTitle").textContent = title;
    $("#optionsRoadmapMeta").textContent = meta;
    $("#optionsRoadmapIconUse").setAttribute("href", "#" + iconId);
    const iconBox = $("#optionsRoadmapIcon");
    iconBox.className = "roadmap-icon" + (variant ? " " + variant : "");

    $("#roadmapOptionsView").style.display = "";
    $("#deleteConfirmView").classList.remove("is-active");
    openModal("roadmapOptionsOverlay");
  }

  function wireOneRoadmapCard(card) {
    card.addEventListener("click", (e) => {
      if (e.target.closest(".card-menu-btn")) return; // handled separately
      openOptionsForCard(card);
    });
    const menuBtn = card.querySelector(".card-menu-btn");
    if (menuBtn) {
      menuBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openOptionsForCard(card);
      });
    }
  }

  function wireRoadmapCards() {
    $all(".roadmap-card").forEach(wireOneRoadmapCard);
  }

  function updateEmptyState() {
    const list = $("#roadmapList");
    const empty = $("#emptyRoadmaps");
    if (!list || !empty) return;
    empty.classList.toggle("is-visible", list.children.length === 0);
  }

  function wireOptionsModalActions() {
    $("#viewRoadmapOption").addEventListener("click", () => {
      showToast("Opening roadmap details is coming next.");
    });

    $("#renameRoadmapOption").addEventListener("click", () => {
      if (!currentOptionsCard) return;
      const current = currentOptionsCard.dataset.title;
      const next = window.prompt("Rename roadmap", current);
      if (next && next.trim()) {
        const trimmed = next.trim();
        currentOptionsCard.dataset.title = trimmed;
        currentOptionsCard.querySelector(".roadmap-title").textContent = trimmed;
        $("#optionsRoadmapTitle").textContent = trimmed;
        showToast("Roadmap renamed.", "success");
      }
    });

    $("#regenerateRoadmapOption").addEventListener("click", () => {
      if (!currentOptionsCard) return;
      closeModal("roadmapOptionsOverlay");
      const bar = currentOptionsCard.querySelector(".progress-fill");
      const original = bar.dataset.progress;
      bar.style.width = "0%";
      showToast("Regenerating roadmap…");
      setTimeout(() => { bar.style.width = original + "%"; showToast("Roadmap regenerated.", "success"); }, 1400);
    });

    $("#deleteRoadmapOption").addEventListener("click", () => {
      if (!currentOptionsCard) return;
      $("#deleteConfirmTitle").textContent = currentOptionsCard.dataset.title;
      $("#roadmapOptionsView").style.display = "none";
      $("#deleteConfirmView").classList.add("is-active");
    });

    $("#cancelDeleteBtn").addEventListener("click", () => {
      $("#roadmapOptionsView").style.display = "";
      $("#deleteConfirmView").classList.remove("is-active");
    });

    $("#confirmDeleteBtn").addEventListener("click", () => {
      if (!currentOptionsCard) return;
      const card = currentOptionsCard;
      closeModal("roadmapOptionsOverlay");
      card.style.transition = "opacity .25s ease, transform .25s ease";
      card.style.opacity = "0";
      card.style.transform = "translateY(-8px)";
      setTimeout(() => {
        card.remove();
        updateEmptyState();
      }, 250);
      showToast("Roadmap deleted.");
    });
  }

  /* ---------- streak popup ---------- */

  let streakInterval = null;

  function wireStreakPopup() {
    const btn = $("#streakBtn");
    if (!btn) return;
    btn.addEventListener("click", () => {
      openModal("streakOverlay");
      tickCountdown();
      clearInterval(streakInterval);
      streakInterval = setInterval(tickCountdown, 1000);
    });
    $("#streakOverlay").addEventListener("click", (e) => {
      if (e.target.id === "streakOverlay") clearInterval(streakInterval);
    });
    $all('[data-close-modal="streakOverlay"]').forEach((b) =>
      b.addEventListener("click", () => clearInterval(streakInterval))
    );
  }

  function tickCountdown() {
    const el = $("#streakCountdown");
    if (!el) return;
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const diff = Math.max(0, midnight - now);
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    const pad = (n) => String(n).padStart(2, "0");
    el.textContent = pad(h) + ":" + pad(m) + ":" + pad(s);
  }

  /* ---------- notifications dropdown ---------- */

  function wireNotifications() {
    const btn = $("#notifBtn");
    const panel = $("#notifPanel");
    const dot = $("#notifDot");
    if (!btn || !panel) return;

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const willOpen = !panel.classList.contains("is-open");
      closeAllDropdowns();
      if (willOpen) {
        panel.classList.add("is-open");
        if (dot) dot.style.display = "none";
      }
    });

    document.addEventListener("click", (e) => {
      if (panel.classList.contains("is-open") && !panel.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
        panel.classList.remove("is-open");
      }
    });

    $("#viewAllNotifsBtn").addEventListener("click", () => {
      panel.classList.remove("is-open");
      showToast("A full notifications page is coming soon.");
    });
  }

  /* ---------- Ask Nodi modal ---------- */

  const nodiReplies = [
    "Good question — once I'm connected to your roadmap data I'll be able to answer that in detail. For now, try breaking the task into two smaller steps and starting with whichever feels easiest.",
    "I don't have live answers wired up in this preview yet, but that's exactly the kind of thing I'll help with once I'm connected to the backend.",
    "Here's a general tip: if a task feels stuck, it's often too big. Splitting it into a 20-minute first step usually gets things moving again."
  ];

  function wireNodiModal() {
    const openBtn = $("#nodiBtn");
    const input = $("#nodiInput");
    const sendBtn = $("#nodiSendBtn");
    const body = $("#nodiBody");
    if (!openBtn) return;

    openBtn.addEventListener("click", () => {
      openModal("nodiOverlay");
      setTimeout(() => input.focus(), 250);
    });

    function appendBubble(text, from) {
      const bubble = document.createElement("div");
      bubble.className = "chat-bubble from-" + from;
      bubble.textContent = text;
      body.appendChild(bubble);
      body.scrollTop = body.scrollHeight;
      return bubble;
    }

    function sendMessage(text) {
      const msg = (text || input.value).trim();
      if (!msg) return;
      appendBubble(msg, "user");
      input.value = "";

      const typing = document.createElement("div");
      typing.className = "chat-bubble from-nodi";
      typing.innerHTML = '<span class="typing-dots"><span></span><span></span><span></span></span>';
      body.appendChild(typing);
      body.scrollTop = body.scrollHeight;

      setTimeout(() => {
        typing.remove();
        const reply = nodiReplies[Math.floor(Math.random() * nodiReplies.length)];
        appendBubble(reply, "nodi");
      }, 1100);
    }

    sendBtn.addEventListener("click", () => sendMessage());
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") sendMessage(); });
    $all(".suggestion-chip").forEach((chip) => {
      chip.addEventListener("click", () => sendMessage(chip.textContent));
    });
  }

  /* ---------- init ---------- */

  function init() {
    document.addEventListener("DOMContentLoaded", () => {
      wireGenericModalClosers();
      wireDrawer();
      wireChatCard();
      wireAddRoadmapModal();
      wireRoadmapCards();
      wireOptionsModalActions();
      wireStreakPopup();
      wireNotifications();
      wireNodiModal();
      animateProgressBars();
      updateEmptyState();
    });
  }

  return { init };
})();

TasklyDashboard.init();
