/* ==========================================================
   TASKLY — dashboard.js
   Dashboard logic connected to live FastAPI backend
   ========================================================== */

window.TasklyDashboard = (function () {

  let userRoadmaps = [];
  let currentActiveRoadmap = null;

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

  function showToast(message, type) {
    const toast = $("#toast");
    if (!toast) return;
    toast.textContent = message;
    toast.className = "toast is-visible" + (type === "success" ? " is-success" : (type === "error" ? " is-error" : ""));
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove("is-visible"), 3600);
  }

  function escapeHtml(str) {
    const d = document.createElement("div");
    d.textContent = str || "";
    return d.innerHTML;
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

  /* ---------- User info & Greeting ---------- */

  function updateGreeting() {
    const greetingEl = $("#greetingHeading");
    if (!greetingEl) return;
    const name = localStorage.getItem("taskly_user_name") || "";
    if (name) {
      const firstName = name.split(" ")[0];
      greetingEl.textContent = `Welcome back, ${firstName}!`;
    } else {
      const email = localStorage.getItem("taskly_user_email") || "";
      if (email) {
        const username = email.split("@")[0];
        greetingEl.textContent = `Welcome back, ${username}!`;
      } else {
        greetingEl.textContent = "Welcome back!";
      }
    }
  }

  /* ---------- Modal & Drawer Plumbing ---------- */

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

  /* ---------- Streak Handling (GET /streak) ---------- */

  let streakInterval = null;

  async function loadStreak() {
    try {
      const data = await window.TasklyAPI.getStreak();
      if (data && typeof data.current_streak === "number") {
        const count = data.current_streak;
        const streakBtn = $("#streakBtn");
        if (streakBtn) {
          const countSpan = streakBtn.querySelector(".streak-count") || streakBtn;
          countSpan.textContent = `${count} ${count === 1 ? "day" : "days"}`;
        }
        const modalCount = $("#streakCountBig");
        if (modalCount) {
          modalCount.textContent = `${count} ${count === 1 ? "Day" : "Days"}`;
        }
      }
    } catch (err) {
      console.warn("Could not load streak:", err);
    }
  }

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

  /* ---------- Notifications Handling (GET /notifications + LocalStorage) ---------- */

  function getStoredNotifications() {
    try {
      const raw = localStorage.getItem("taskly_notifications");
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveStoredNotifications(notifs) {
    try {
      localStorage.setItem("taskly_notifications", JSON.stringify(notifs));
    } catch (e) {}
  }

  async function loadNotifications() {
    try {
      const freshNotifs = await window.TasklyAPI.getNotifications();
      if (Array.isArray(freshNotifs) && freshNotifs.length > 0) {
        const existing = getStoredNotifications();
        const existingIds = new Set(existing.map(n => n.id));
        const merged = [...freshNotifs.filter(n => !existingIds.has(n.id)), ...existing];
        saveStoredNotifications(merged);
      }
    } catch (err) {
      console.warn("Could not fetch notifications from server:", err);
    }
    renderNotificationDropdown();
  }

  function renderNotificationDropdown() {
    const panel = $("#notifPanel");
    const dot = $("#notifDot");
    if (!panel) return;

    const notifs = getStoredNotifications();
    if (dot) {
      dot.style.display = notifs.length > 0 ? "block" : "none";
    }

    panel.innerHTML = `
      <div class="dropdown-header" style="display:flex; justify-content:space-between; align-items:center;">
        <span>Notifications</span>
        ${notifs.length > 0 ? '<button id="clearNotifsBtn" type="button" style="background:none; border:none; color:var(--color-ink-soft); font-size:11.5px; font-weight:600; cursor:pointer; padding:2px 6px;">Clear all</button>' : ''}
      </div>
      <div class="notif-dropdown-list" style="max-height: 320px; overflow-y: auto;">
        ${notifs.length === 0 ? `
          <div style="padding: 24px 16px; text-align: center; color: var(--color-ink-soft); font-size: 13px;">
            No new notifications
          </div>
        ` : notifs.map(n => `
          <div class="notif-item" data-roadmap-id="${escapeHtml(n.roadmap_id || '')}" style="cursor: ${n.roadmap_id ? 'pointer' : 'default'};">
            <div class="notif-icon ${n.type === 'milestone' ? 'is-teal' : ''}">
              <svg viewBox="0 0 24 24" fill="${n.type === 'milestone' ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <use href="${n.type === 'milestone' ? '#ic-flame' : '#ic-check'}"></use>
              </svg>
            </div>
            <div>
              <p class="notif-text">${escapeHtml(n.message || 'Milestone update')}</p>
              <p class="notif-time">${n.created_at ? new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}</p>
            </div>
          </div>
        `).join('')}
      </div>
      <div class="dropdown-footer">
        <button class="view-all-btn" id="viewAllNotifsBtn" type="button">View all notifications</button>
      </div>
    `;

    const clearBtn = $("#clearNotifsBtn", panel);
    if (clearBtn) {
      clearBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        localStorage.removeItem("taskly_notifications");
        renderNotificationDropdown();
        showToast("Notifications cleared.");
      });
    }

    const viewAllBtn = $("#viewAllNotifsBtn", panel);
    if (viewAllBtn) {
      viewAllBtn.addEventListener("click", () => {
        panel.classList.remove("is-open");
        window.location.href = "notifications.html";
      });
    }

    $all(".notif-item[data-roadmap-id]", panel).forEach(item => {
      const rmId = item.dataset.roadmapId;
      if (rmId) {
        item.addEventListener("click", () => {
          panel.classList.remove("is-open");
          window.location.href = `roadmap.html?id=${encodeURIComponent(rmId)}`;
        });
      }
    });
  }

  function wireNotifDropdown() {
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
      if (panel.classList.contains("is-open") && !panel.contains(e.target) && !btn.contains(e.target)) {
        panel.classList.remove("is-open");
      }
    });
  }

  /* ---------- Roadmaps Fetching (GET /roadmaps or /dashboard) ---------- */

  async function fetchUserRoadmaps() {
    try {
      const data = await window.TasklyAPI.getDashboard();
      let list = [];
      if (Array.isArray(data)) {
        list = data;
      } else if (data && Array.isArray(data.roadmaps)) {
        list = data.roadmaps;
      } else if (data && typeof data === "object") {
        list = [data];
      }
      userRoadmaps = list;
    } catch (err) {
      console.warn("Error fetching dashboard roadmaps:", err);
      userRoadmaps = [];
    }

    renderRoadmapList();
  }

  function renderRoadmapList() {
    const list = $("#roadmapList");
    if (!list) return;
    list.innerHTML = "";

    if (!userRoadmaps || userRoadmaps.length === 0) {
      updateEmptyState();
      return;
    }

    userRoadmaps.forEach((rm, index) => {
      const card = createCardElement(rm, index);
      list.appendChild(card);
      wireOneRoadmapCard(card, rm);
    });

    updateEmptyState();
  }

  function createCardElement(rm, index) {
    const variant = index % 2 === 0 ? "is-teal" : "";
    const title = rm.title || rm.goal_text || "Roadmap";
    const iconId = getIconForTitle(title);
    const status = (rm.status || "done").toLowerCase();
    const isDone = status === "done";
    const isFailed = status === "failed";
    const isGenerating = !isDone && !isFailed;

    const progress = typeof rm.progress_percentage === "number" ? Math.round(rm.progress_percentage) : (typeof rm.progress === "number" ? Math.round(rm.progress) : 0);

    const card = document.createElement("article");
    card.className = "roadmap-card";
    card.dataset.id = rm.id;

    let metaHtml = "";
    if (isGenerating) {
      metaHtml = `<span style="color:var(--color-orange-deep); font-weight:600; font-size:12px; display:inline-flex; align-items:center; gap:4px;">
        <span class="spinner-ring" style="width:12px; height:12px; border-width:1.5px; border-top-color:var(--color-orange-deep);"></span>
        Generating roadmap…
      </span>`;
    } else if (isFailed) {
      metaHtml = `<span style="color:var(--color-error); font-weight:600; font-size:12px;">Generation failed</span>`;
    } else {
      metaHtml = `<p class="roadmap-meta">${progress}% completed</p>`;
    }

    card.innerHTML = `
      <div class="roadmap-icon ${variant}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <use href="#${iconId}"></use>
        </svg>
      </div>
      <div class="roadmap-body">
        <p class="roadmap-title">${escapeHtml(title)}</p>
        <div class="progress-track">
          <div class="progress-fill ${isGenerating ? 'is-pulse' : ''}" style="width: ${isGenerating ? '60%' : progress + '%'}"></div>
        </div>
        ${metaHtml}
      </div>
      <button class="card-menu-btn" type="button" aria-label="Roadmap options">
        <svg viewBox="0 0 24 24"><use href="#ic-dots"></use></svg>
      </button>
    `;

    return card;
  }

  function wireOneRoadmapCard(card, rm) {
    card.addEventListener("click", (e) => {
      if (e.target.closest(".card-menu-btn")) return;
      window.location.href = `roadmap.html?id=${encodeURIComponent(rm.id)}`;
    });

    const menuBtn = card.querySelector(".card-menu-btn");
    if (menuBtn) {
      menuBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openRoadmapOptionsMenu(rm);
      });
    }
  }

  function updateEmptyState() {
    const list = $("#roadmapList");
    const empty = $("#emptyRoadmaps");
    if (!list || !empty) return;
    const hasItems = userRoadmaps && userRoadmaps.length > 0;
    empty.classList.toggle("is-visible", !hasItems);
  }

  /* ---------- Roadmap Options Modal (Rename, Regenerate, Delete) ---------- */

  function openRoadmapOptionsMenu(rm) {
    currentActiveRoadmap = rm;
    const title = rm.title || rm.goal_text || "Roadmap";
    const status = (rm.status || "done").toLowerCase();

    $("#optionsRoadmapTitle").textContent = title;
    $("#optionsRoadmapMeta").textContent = status === "done" ? `${rm.progress_percentage || 0}% completed` : status;

    const iconUse = $("#optionsRoadmapIconUse");
    if (iconUse) {
      iconUse.setAttribute("href", "#" + getIconForTitle(title));
    }

    $("#optionsMenuRoot").style.display = "block";
    $("#deleteConfirmView").style.display = "none";

    openModal("roadmapOptionsOverlay");
  }

  function wireRoadmapOptionsMenu() {
    const viewBtn = $("#viewRoadmapOption");
    viewBtn && viewBtn.addEventListener("click", () => {
      closeModal("roadmapOptionsOverlay");
      if (currentActiveRoadmap) {
        window.location.href = `roadmap.html?id=${encodeURIComponent(currentActiveRoadmap.id)}`;
      }
    });

    const renameBtn = $("#renameRoadmapOption");
    renameBtn && renameBtn.addEventListener("click", async () => {
      if (!currentActiveRoadmap) return;
      const currentTitle = currentActiveRoadmap.title || currentActiveRoadmap.goal_text || "";
      const newTitle = window.prompt("Rename roadmap:", currentTitle);
      if (newTitle && newTitle.trim()) {
        closeModal("roadmapOptionsOverlay");
        try {
          await window.TasklyAPI.updateRoadmap(currentActiveRoadmap.id, { title: newTitle.trim() });
          showToast("Roadmap renamed.", "success");
          await fetchUserRoadmaps();
        } catch (err) {
          showToast(err.message || "Failed to rename roadmap", "error");
        }
      }
    });

    const regenBtn = $("#regenerateRoadmapOption");
    regenBtn && regenBtn.addEventListener("click", async () => {
      if (!currentActiveRoadmap) return;
      closeModal("roadmapOptionsOverlay");
      try {
        await window.TasklyAPI.regenerateRoadmap(currentActiveRoadmap.id);
        showToast("Roadmap regeneration started.", "success");
        window.location.href = `roadmap.html?id=${encodeURIComponent(currentActiveRoadmap.id)}`;
      } catch (err) {
        showToast(err.message || "Failed to regenerate roadmap", "error");
      }
    });

    const deleteOptionBtn = $("#deleteRoadmapOption");
    deleteOptionBtn && deleteOptionBtn.addEventListener("click", () => {
      if (!currentActiveRoadmap) return;
      $("#deleteConfirmTitle").textContent = currentActiveRoadmap.title || "this roadmap";
      $("#optionsMenuRoot").style.display = "none";
      $("#deleteConfirmView").style.display = "block";
    });

    const cancelDeleteBtn = $("#cancelDeleteBtn");
    cancelDeleteBtn && cancelDeleteBtn.addEventListener("click", () => {
      $("#optionsMenuRoot").style.display = "block";
      $("#deleteConfirmView").style.display = "none";
    });

    const confirmDeleteBtn = $("#confirmDeleteBtn");
    confirmDeleteBtn && confirmDeleteBtn.addEventListener("click", async () => {
      if (!currentActiveRoadmap) return;
      confirmDeleteBtn.disabled = true;
      try {
        await window.TasklyAPI.deleteRoadmap(currentActiveRoadmap.id);
        closeModal("roadmapOptionsOverlay");
        showToast("Roadmap deleted.", "success");
        await fetchUserRoadmaps();
      } catch (err) {
        showToast(err.message || "Failed to delete roadmap", "error");
      } finally {
        confirmDeleteBtn.disabled = false;
      }
    });
  }

  /* ---------- Create Roadmap Handlers (POST /roadmaps) ---------- */

  function wireCreateRoadmapModal() {
    const openBtn = $("#openAddRoadmapBtn") || $("#topbarCreateBtn");
    const textarea = $("#modalGoalInput");
    const charCount = $("#modalCharCount");
    const generateBtn = $("#generateRoadmapBtn");
    const formView = $("#addRoadmapFormView");
    const genState = $("#generationState");

    if (openBtn) {
      openBtn.addEventListener("click", () => {
        openModal("addRoadmapOverlay");
        if (formView) formView.classList.remove("is-hidden");
        if (genState) genState.classList.remove("is-active");
        setTimeout(() => textarea && textarea.focus(), 250);
      });
    }

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

    if (generateBtn) {
      generateBtn.addEventListener("click", async () => {
        const text = (textarea.value || "").trim();
        if (!text) return;

        generateBtn.disabled = true;
        if (formView) formView.classList.add("is-hidden");
        if (genState) genState.classList.add("is-active");

        try {
          const res = await window.TasklyAPI.createRoadmap({ title: text, goal_text: text });
          const newId = (res && (res.id || (res.roadmap && res.roadmap.id))) || res;
          
          if (!newId) throw new Error("Could not retrieve roadmap ID from server");

          closeModal("addRoadmapOverlay");
          window.location.href = `roadmap.html?id=${encodeURIComponent(newId)}`;

        } catch (err) {
          console.error("Roadmap creation failed:", err);
          showToast(err.message || "Failed to create roadmap", "error");
          if (formView) formView.classList.remove("is-hidden");
          if (genState) genState.classList.remove("is-active");
          generateBtn.disabled = false;
        }
      });
    }
  }

  function wireInlineInput() {
    const input = $("#inlineGoalInput");
    const btn = $("#inlineGenerateBtn");
    if (!input || !btn) return;

    async function handleInlineSubmit() {
      const text = (input.value || "").trim();
      if (!text) return;

      btn.disabled = true;
      try {
        const res = await window.TasklyAPI.createRoadmap({ title: text, goal_text: text });
        const newId = (res && (res.id || (res.roadmap && res.roadmap.id))) || res;
        if (!newId) throw new Error("Could not retrieve roadmap ID from server");

        window.location.href = `roadmap.html?id=${encodeURIComponent(newId)}`;
      } catch (err) {
        showToast(err.message || "Failed to create roadmap", "error");
        btn.disabled = false;
      }
    }

    btn.addEventListener("click", handleInlineSubmit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleInlineSubmit();
    });
  }

  /* ---------- Ask Nodi ---------- */

  const nodiReplies = [
    "I'm here to help you turn your goals into clear, actionable roadmaps.",
    "Whenever you want to start learning something new, enter your goal and I'll generate a step-by-step path for you.",
    "Tip: Breaking tasks down into smaller milestones makes them much easier to finish!"
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
        appendBubble(nodiReplies[Math.floor(Math.random() * nodiReplies.length)], "nodi");
      }, 900);
    }

    sendBtn && sendBtn.addEventListener("click", () => sendMessage());
    input && input.addEventListener("keydown", (e) => { if (e.key === "Enter") sendMessage(); });
    $all(".suggestion-chip").forEach((chip) => chip.addEventListener("click", () => sendMessage(chip.textContent)));
  }

  /* ---------- Initialization ---------- */

  async function init() {
    const run = async () => {
      wireGenericModalClosers();
      wireDrawer();
      wireStreakPopup();
      wireNotifDropdown();
      wireNodiModal();
      wireCreateRoadmapModal();
      wireInlineInput();
      wireRoadmapOptionsMenu();

      updateGreeting();
      await Promise.all([
        fetchUserRoadmaps(),
        loadStreak(),
        loadNotifications()
      ]);
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", run);
    } else {
      run();
    }
  }

  return { init, fetchUserRoadmaps };
})();

if (typeof window !== "undefined" && window.TasklyDashboard) {
  window.TasklyDashboard.init();
}
