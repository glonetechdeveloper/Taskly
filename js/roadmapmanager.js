/* ==========================================================
   TASKLY — roadmapmanager.js
   ========================================================== */
window.TasklyManager = (function () {

  const DEFAULT_PLACEHOLDER = "https://your-service.onrender.com";
  const API_BASE = window.API_BASE || window.TASKLY_API_BASE || localStorage.getItem("TASKLY_API_BASE") || DEFAULT_PLACEHOLDER;
  const TOKEN_KEY = "access_token";

  let userRoadmaps = [];
  let currentFilter = "all";

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

  function getToken() {
    try {
      return localStorage.getItem("access_token") || localStorage.getItem("taskly_access_token");
    } catch (e) {
      return null;
    }
  }

  function getUserEmail() {
    try {
      return localStorage.getItem("taskly_user_email") || "default";
    } catch (e) {
      return "default";
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

  function escapeHtml(str) {
    const d = document.createElement("div");
    d.textContent = str || "";
    return d.innerHTML;
  }

  function goToRoadmap(type, title, blank) {
    let url = "roadmap.html?type=" + encodeURIComponent(type || "sequential") + "&title=" + encodeURIComponent(title || "Roadmap");
    if (blank) url += "&blank=1";
    window.location.href = url;
  }

  /* ---------- Storage helpers ---------- */

  function getStorageKey() {
    const email = getUserEmail();
    return "taskly_roadmaps_" + email.replace(/[^a-zA-Z0-9_]/g, "_");
  }

  function getStoredRoadmaps() {
    try {
      const raw = localStorage.getItem(getStorageKey()) || localStorage.getItem("taskly_user_roadmaps");
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveStoredRoadmaps(roadmaps) {
    try {
      const serialized = JSON.stringify(roadmaps);
      localStorage.setItem(getStorageKey(), serialized);
      localStorage.setItem("taskly_user_roadmaps", serialized);
    } catch (e) {
      console.warn("Could not save roadmaps to storage", e);
    }
  }

  function getIconForTitle(title) {
    const t = (title || "").toLowerCase();
    if (t.includes("figma") || t.includes("code") || t.includes("program") || t.includes("web") || t.includes("python") || t.includes("react") || t.includes("tech") || t.includes("design") || t.includes("laptop")) {
      return "ic-laptop";
    }
    if (t.includes("drive") || t.includes("car") || t.includes("license") || t.includes("vehicle") || t.includes("travel")) {
      return "ic-car";
    }
    if (t.includes("cook") || t.includes("food") || t.includes("recipe") || t.includes("rice") || t.includes("bake") || t.includes("kitchen") || t.includes("meal")) {
      return "ic-pot";
    }
    if (t.includes("plumb") || t.includes("fix") || t.includes("build") || t.includes("diy") || t.includes("repair") || t.includes("wrench")) {
      return "ic-wrench";
    }
    return "ic-route";
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
        $all(".modal-overlay.is-open").forEach((o) => o.classList.remove("is-open"));
        closeAllDropdowns();
      }
    });
  }

  /* ---------- shared shell ---------- */

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

  function wireNotifications() {
    const btn = $("#notifBtn");
    const panel = $("#notifPanel");
    const dot = $("#notifDot");
    if (!btn || !panel) return;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const willOpen = !panel.classList.contains("is-open");
      closeAllDropdowns();
      if (willOpen) { panel.classList.add("is-open"); if (dot) dot.style.display = "none"; }
    });
    document.addEventListener("click", (e) => {
      if (panel.classList.contains("is-open") && !panel.contains(e.target) && !btn.contains(e.target)) {
        panel.classList.remove("is-open");
      }
    });
    const viewAll = $("#viewAllNotifsBtn");
    viewAll && viewAll.addEventListener("click", () => {
      panel.classList.remove("is-open");
      window.location.href = "notifications.html";
    });
  }

  /* ---------- Fetch and Normalize Roadmaps (GET /roadmaps) ---------- */

  async function fetchUserRoadmaps() {
    const token = getToken();
    const isPlaceholder = API_BASE.includes("your-service.onrender.com");
    let serverRoadmaps = null;

    if (!isPlaceholder && token) {
      try {
        const res = await fetch(API_BASE + "/roadmaps", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          }
        });

        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            serverRoadmaps = data;
          } else if (data && Array.isArray(data.roadmaps)) {
            serverRoadmaps = data.roadmaps;
          } else if (data && Array.isArray(data.data)) {
            serverRoadmaps = data.data;
          } else if (data && typeof data === "object") {
            serverRoadmaps = [data];
          }
        }
      } catch (err) {
        console.warn("GET /roadmaps failed, using locally stored roadmaps:", err);
      }
    }

    if (serverRoadmaps && serverRoadmaps.length > 0) {
      userRoadmaps = serverRoadmaps.map(normalizeRoadmapData);
      saveStoredRoadmaps(userRoadmaps);
    } else {
      userRoadmaps = getStoredRoadmaps();
    }

    renderRoadmapList();
  }

  function normalizeRoadmapData(raw) {
    const id = raw.id || raw._id || ("rm-" + Math.random().toString(36).substr(2, 9));
    const title = raw.title || raw.goal_text || raw.name || "My Roadmap";
    const type = raw.type === "flat" || raw.type === "checklist" ? "flat" : "sequential";

    let totalTasks = 8;
    let completedTasks = 0;

    if (typeof raw.total_tasks === "number") {
      totalTasks = raw.total_tasks;
    } else if (raw.tasks && Array.isArray(raw.tasks)) {
      totalTasks = raw.tasks.length || 1;
      completedTasks = raw.tasks.filter(t => t.completed).length;
    } else if (raw.phases && Array.isArray(raw.phases)) {
      let count = 0;
      let comp = 0;
      raw.phases.forEach(p => {
        if (p.nodes && Array.isArray(p.nodes)) {
          count += p.nodes.length;
          comp += p.nodes.filter(n => n.completed).length;
        }
      });
      if (count > 0) {
        totalTasks = count;
        completedTasks = comp;
      }
    }

    if (typeof raw.completed_tasks === "number") {
      completedTasks = raw.completed_tasks;
    }

    let progress = 0;
    if (typeof raw.progress === "number") {
      progress = raw.progress;
    } else if (totalTasks > 0) {
      progress = Math.round((completedTasks / totalTasks) * 100);
    }

    const icon = raw.icon || getIconForTitle(title);

    return {
      id,
      title,
      goal_text: raw.goal_text || title,
      type,
      total_tasks: totalTasks,
      completed_tasks: completedTasks,
      progress,
      icon,
      created_at: raw.created_at || raw.createdAt || new Date().toISOString()
    };
  }

  /* ---------- Render Manager List Cards ---------- */

  function renderRoadmapList() {
    const list = $("#managerList");
    if (!list) return;
    list.innerHTML = "";

    if (!userRoadmaps || userRoadmaps.length === 0) {
      updateEmptyFilterState();
      return;
    }

    userRoadmaps.forEach((rm, index) => {
      const card = createCardElement(rm, index);
      list.appendChild(card);
      wireOneManagerCard(card);
    });

    applyCurrentFilter();
    animateProgressBars();
  }

  function createCardElement(rm, index) {
    const variant = index % 2 === 0 ? "is-teal" : "";
    const iconId = rm.icon || getIconForTitle(rm.title);
    const title = rm.title || rm.goal_text || "Roadmap";
    const total = rm.total_tasks || 8;
    const completed = rm.completed_tasks || 0;
    const progress = typeof rm.progress === "number" ? rm.progress : Math.round((completed / total) * 100);
    const isFlat = rm.type === "flat";

    const badgeIcon = isFlat ? "ic-list" : "ic-layers";
    const badgeText = isFlat ? "Checklist" : "Sequential";
    const badgeClass = isFlat ? "roadmap-type-badge is-flat manager-card-type-badge" : "roadmap-type-badge manager-card-type-badge";

    const card = document.createElement("article");
    card.className = "roadmap-card";
    card.dataset.id = rm.id;
    card.dataset.title = title;
    card.dataset.icon = iconId;
    card.dataset.iconVariant = variant;
    card.dataset.type = rm.type || "sequential";

    card.innerHTML = `
      <div class="roadmap-icon ${variant}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <use href="#${iconId}"></use>
        </svg>
      </div>
      <div class="roadmap-body">
        <p class="roadmap-title">
          ${escapeHtml(title)} 
          <span class="${badgeClass}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><use href="#${badgeIcon}"></use></svg>
            ${badgeText}
          </span>
        </p>
        <div class="progress-track">
          <div class="progress-fill" data-progress="${progress}" style="width: ${progress}%"></div>
        </div>
        <p class="roadmap-meta">${completed} out of ${total} tasks completed</p>
      </div>
      <button class="card-menu-btn" type="button" aria-label="Roadmap options">
        <svg viewBox="0 0 24 24"><use href="#ic-dots"></use></svg>
      </button>
    `;

    return card;
  }

  function animateProgressBars() {
    $all(".progress-fill").forEach((bar) => {
      const target = bar.dataset.progress || "0";
      setTimeout(() => { bar.style.width = target + "%"; }, 200);
    });
  }

  /* ---------- filter tabs ---------- */

  function applyCurrentFilter() {
    $all(".roadmap-card").forEach((card) => {
      const match = currentFilter === "all" || card.dataset.type === currentFilter;
      card.style.display = match ? "" : "none";
    });
    updateEmptyFilterState();
  }

  function updateEmptyFilterState() {
    const list = $("#managerList");
    const emptyMsg = $("#managerEmptyFilter");
    if (!list || !emptyMsg) return;

    if (!userRoadmaps || userRoadmaps.length === 0) {
      emptyMsg.textContent = "No roadmaps created yet. Tap \"Add New Roadmap\" or \"Create Checklist\" to begin.";
      emptyMsg.classList.add("is-visible");
      return;
    }

    const anyVisible = $all(".roadmap-card", list).some((c) => c.style.display !== "none");
    emptyMsg.textContent = "Nothing here yet for this filter.";
    emptyMsg.classList.toggle("is-visible", !anyVisible);
  }

  function wireFilterTabs() {
    $all(".filter-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        $all(".filter-tab").forEach((t) => t.classList.remove("is-active"));
        tab.classList.add("is-active");
        currentFilter = tab.dataset.filter || "all";
        applyCurrentFilter();
      });
    });
  }

  /* ---------- roadmap cards: click to open, menu for options ---------- */

  let currentOptionsCard = null;

  function wireOneManagerCard(card) {
    card.addEventListener("click", (e) => {
      if (e.target.closest(".card-menu-btn")) return;
      goToRoadmap(card.dataset.type, card.dataset.title, false);
    });
    const menuBtn = card.querySelector(".card-menu-btn");
    if (menuBtn) {
      menuBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openOptionsForCard(card);
      });
    }
  }

  function openOptionsForCard(card) {
    currentOptionsCard = card;
    const title = card.dataset.title || "Roadmap";
    const metaEl = card.querySelector(".roadmap-meta");
    $("#optionsRoadmapTitle").textContent = title;
    $("#optionsRoadmapMeta").textContent = metaEl ? metaEl.textContent : "";
    $("#roadmapOptionsView").style.display = "";
    $("#deleteConfirmView").classList.remove("is-active");
    openModal("roadmapOptionsOverlay");
  }

  function wireOptionsModalActions() {
    $("#viewRoadmapOption").addEventListener("click", () => {
      if (!currentOptionsCard) return;
      goToRoadmap(currentOptionsCard.dataset.type, currentOptionsCard.dataset.title, false);
    });

    $("#renameRoadmapOption").addEventListener("click", () => {
      if (!currentOptionsCard) return;
      const current = currentOptionsCard.dataset.title;
      const next = window.prompt("Rename roadmap", current);
      if (next && next.trim()) {
        const trimmed = next.trim();
        const id = currentOptionsCard.dataset.id;
        currentOptionsCard.dataset.title = trimmed;
        
        const titleTextNode = currentOptionsCard.querySelector(".roadmap-title").firstChild;
        if (titleTextNode) {
          titleTextNode.textContent = trimmed + " ";
        }
        $("#optionsRoadmapTitle").textContent = trimmed;

        const item = userRoadmaps.find(r => r.id === id);
        if (item) {
          item.title = trimmed;
          saveStoredRoadmaps(userRoadmaps);
        }

        showToast("Roadmap renamed.", "success");
      }
    });

    $("#regenerateRoadmapOption").addEventListener("click", () => {
      if (!currentOptionsCard) return;
      closeModal("roadmapOptionsOverlay");
      const bar = currentOptionsCard.querySelector(".progress-fill");
      const original = bar ? bar.dataset.progress : "0";
      if (bar) bar.style.width = "0%";
      showToast("Regenerating roadmap…");
      setTimeout(() => { if (bar) bar.style.width = original + "%"; showToast("Roadmap regenerated.", "success"); }, 1400);
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

    $("#confirmDeleteBtn").addEventListener("click", async () => {
      if (!currentOptionsCard) return;
      const card = currentOptionsCard;
      const id = card.dataset.id;
      closeModal("roadmapOptionsOverlay");

      const token = getToken();
      const isPlaceholder = API_BASE.includes("your-service.onrender.com");
      if (!isPlaceholder && token && id) {
        try {
          await fetch(`${API_BASE}/roadmaps/${id}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${token}` }
          });
        } catch (e) {}
      }

      userRoadmaps = userRoadmaps.filter(r => r.id !== id);
      saveStoredRoadmaps(userRoadmaps);

      card.style.transition = "opacity .25s ease, transform .25s ease";
      card.style.opacity = "0";
      card.style.transform = "translateY(-8px)";
      setTimeout(() => {
        card.remove();
        updateEmptyFilterState();
      }, 250);
      showToast("Roadmap deleted.");
    });
  }

  /* ---------- Add New Roadmap (AI) & Create Checklist ---------- */

  async function createRoadmapRequest(goalText, type = "sequential") {
    const token = getToken();
    const isPlaceholder = API_BASE.includes("your-service.onrender.com");

    let created = null;

    if (!isPlaceholder && token) {
      try {
        const res = await fetch(API_BASE + "/roadmaps", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify({ goal_text: goalText, title: goalText, type })
        });
        if (res.ok) {
          const data = await res.json();
          created = data.roadmap || data.data || data;
        }
      } catch (e) {
        console.warn("API request failed, fallback:", e);
      }
    }

    if (!created || !created.id) {
      created = {
        id: "rm-" + Date.now(),
        title: goalText,
        goal_text: goalText,
        type,
        completed_tasks: 0,
        total_tasks: type === "flat" ? 6 : 8,
        progress: 0,
        icon: getIconForTitle(goalText),
        created_at: new Date().toISOString()
      };
    }

    const normalized = normalizeRoadmapData(created);
    userRoadmaps.unshift(normalized);
    saveStoredRoadmaps(userRoadmaps);
    return normalized;
  }

  function wireAddRoadmapModal() {
    const openBtn = $("#addRoadmapBtn");
    const textarea = $("#modalGoalInput");
    const charCount = $("#modalCharCount");
    const generateBtn = $("#generateRoadmapBtn");
    const formView = $("#addRoadmapFormView");
    const genState = $("#generationState");
    const genMessage = $("#generationMessage");
    if (!openBtn) return;

    openBtn.addEventListener("click", () => {
      openModal("addRoadmapOverlay");
      formView.classList.remove("is-hidden");
      genState.classList.remove("is-active");
      setTimeout(() => textarea && textarea.focus(), 250);
    });

    function updateCount() {
      if (!textarea) return;
      const len = textarea.value.length;
      if (charCount) charCount.textContent = len;
      if (generateBtn) generateBtn.disabled = len === 0;
    }
    textarea && textarea.addEventListener("input", updateCount);
    updateCount();

    $all(".example-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        if (!textarea) return;
        textarea.value = chip.dataset.example;
        updateCount();
        textarea.focus();
      });
    });

    const messages = ["Breaking this into phases…", "Figuring out what needs to come first…", "Filling in the details…"];

    generateBtn && generateBtn.addEventListener("click", async () => {
      const goal = textarea ? textarea.value.trim() : "";
      if (!goal) return;

      formView.classList.add("is-hidden");
      genState.classList.add("is-active");

      let step = 0;
      if (genMessage) genMessage.textContent = messages[0];
      const msgInterval = setInterval(() => {
        step++;
        if (step < messages.length && genMessage) {
          genMessage.style.opacity = 0;
          setTimeout(() => { genMessage.textContent = messages[step]; genMessage.style.opacity = 1; }, 200);
        }
      }, 900);

      try {
        await createRoadmapRequest(goal, "sequential");
      } catch (err) {
        console.warn(err);
      }

      setTimeout(() => {
        clearInterval(msgInterval);
        closeModal("addRoadmapOverlay");
        formView.classList.remove("is-hidden");
        genState.classList.remove("is-active");
        if (textarea) textarea.value = "";
        updateCount();
        goToRoadmap("sequential", goal, false);
      }, 2400);
    });

    // Create manual checklist button
    const checklistBtn = $("#createChecklistBtn");
    checklistBtn && checklistBtn.addEventListener("click", async () => {
      const title = window.prompt("Checklist title:", "New checklist");
      if (title && title.trim()) {
        const trimmed = title.trim();
        await createRoadmapRequest(trimmed, "flat");
        goToRoadmap("flat", trimmed, true);
      }
    });
  }

  /* ---------- Ask Nodi modal ---------- */

  const nodiReplies = [
    "I can help organize your roadmaps or break down milestones. Let me know which roadmap you want to work on next!",
    "To build momentum, start with your shortest checklist first. Small wins keep your daily streak alive!",
    "Sequential roadmaps are great for step-by-step learning, while checklists work best for quick daily routines."
  ];

  function wireNodiModal() {
    const openBtn = $("#nodiBtn");
    const input = $("#nodiInput");
    const sendBtn = $("#nodiSendBtn");
    const body = $("#nodiBody");
    if (!openBtn) return;

    openBtn.addEventListener("click", () => {
      openModal("nodiOverlay");
      setTimeout(() => input && input.focus(), 250);
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
      const msg = (text || (input ? input.value : "")).trim();
      if (!msg) return;
      appendBubble(msg, "user");
      if (input) input.value = "";

      const typing = document.createElement("div");
      typing.className = "chat-bubble from-nodi";
      typing.innerHTML = '<span class="typing-dots"><span></span><span></span><span></span></span>';
      body.appendChild(typing);
      body.scrollTop = body.scrollHeight;

      setTimeout(() => {
        typing.remove();
        const reply = nodiReplies[Math.floor(Math.random() * nodiReplies.length)];
        appendBubble(reply, "nodi");
      }, 1000);
    }

    sendBtn && sendBtn.addEventListener("click", () => sendMessage());
    input && input.addEventListener("keydown", (e) => { if (e.key === "Enter") sendMessage(); });
    $all(".suggestion-chip").forEach((chip) => {
      chip.addEventListener("click", () => sendMessage(chip.textContent));
    });
  }

  /* ---------- init ---------- */

  function init() {
    const run = () => {
      wireGenericModalClosers();
      wireDrawer();
      wireStreakPopup();
      wireNotifications();
      wireFilterTabs();
      wireAddRoadmapModal();
      wireOptionsModalActions();
      wireNodiModal();
      fetchUserRoadmaps();
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", run);
    } else {
      run();
    }
  }

  return {
    init,
    fetchUserRoadmaps,
    createRoadmapRequest,
  };
})();

TasklyManager.init();
