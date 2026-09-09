/* ==========================================================
   TASKLY — dashboard.js
   ========================================================== */
window.TasklyDashboard = (function () {

  const DEFAULT_PLACEHOLDER = "https://your-service.onrender.com";
  const API_BASE = window.API_BASE || window.TASKLY_API_BASE || localStorage.getItem("TASKLY_API_BASE") || DEFAULT_PLACEHOLDER;
  const TOKEN_KEY = "access_token";
  const MAX_CHARS = 500;

  let userRoadmaps = [];

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

  /* ---------- Local storage persistence for user roadmaps ---------- */

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

  /* ---------- Icon & Style helpers ---------- */

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

  /* ---------- Personalization & Greeting ---------- */

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

  /* ---------- Generic modal + dropdown plumbing ---------- */

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

  /* ---------- Mobile drawer ---------- */

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

  /* ---------- Fetch and normalize roadmaps (GET /roadmaps) ---------- */

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
      total_tasks: totalTasks,
      completed_tasks: completedTasks,
      progress,
      icon,
      created_at: raw.created_at || raw.createdAt || new Date().toISOString()
    };
  }

  /* ---------- Render Roadmap List Cards ---------- */

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
      wireOneRoadmapCard(card);
    });

    updateEmptyState();
    animateProgressBars();
  }

  function createCardElement(rm, index) {
    const variant = index % 2 === 0 ? "is-teal" : "";
    const iconId = rm.icon || getIconForTitle(rm.title);
    const title = rm.title || rm.goal_text || "Roadmap";
    const total = rm.total_tasks || 8;
    const completed = rm.completed_tasks || 0;
    const progress = typeof rm.progress === "number" ? rm.progress : Math.round((completed / total) * 100);

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
        <p class="roadmap-title">${escapeHtml(title)}</p>
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

  function addRoadmapCardToList(roadmapData) {
    const list = $("#roadmapList");
    if (!list) return;

    const normalized = normalizeRoadmapData(roadmapData);

    userRoadmaps.unshift(normalized);
    saveStoredRoadmaps(userRoadmaps);

    const card = createCardElement(normalized, 0);
    card.style.opacity = "0";
    card.style.transform = "translateY(14px)";

    list.prepend(card);
    wireOneRoadmapCard(card);

    requestAnimationFrame(() => {
      card.style.transition = "opacity .4s ease, transform .4s ease";
      card.style.opacity = "1";
      card.style.transform = "translateY(0)";
      const bar = card.querySelector(".progress-fill");
      if (bar) bar.style.width = (normalized.progress || 0) + "%";
    });

    updateEmptyState();
  }

  function updateEmptyState() {
    const list = $("#roadmapList");
    const empty = $("#emptyRoadmaps");
    if (!list || !empty) return;
    const hasItems = list.children ? (list.children.length > 0) : (userRoadmaps && userRoadmaps.length > 0);
    if (empty && empty.classList) empty.classList.toggle("is-visible", !hasItems);
  }

  /* ---------- Create roadmap endpoint handler (POST /roadmaps) ---------- */

  async function createRoadmapRequest(goalText) {
    const token = getToken();
    const isPlaceholder = API_BASE.includes("your-service.onrender.com");

    let createdRoadmap = null;

    if (!isPlaceholder && token) {
      try {
        const res = await fetch(API_BASE + "/roadmaps", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({
            goal_text: goalText,
            title: goalText
          })
        });

        if (res.ok) {
          const data = await res.json();
          createdRoadmap = data.roadmap || data.data || data;
        }
      } catch (err) {
        console.warn("POST /roadmaps endpoint unreachable, saving roadmap locally:", err);
      }
    }

    if (!createdRoadmap || !createdRoadmap.id) {
      createdRoadmap = {
        id: "rm-" + Date.now(),
        title: goalText,
        goal_text: goalText,
        completed_tasks: 0,
        total_tasks: 8,
        progress: 0,
        icon: getIconForTitle(goalText),
        created_at: new Date().toISOString()
      };
    }

    addRoadmapCardToList(createdRoadmap);
    return createdRoadmap;
  }

  /* ---------- Inline goal / chat card (dashboard body) ---------- */

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

      sendBtn.disabled = true;
      textarea.value = "";
      updateCount();
      showToast("Generating your roadmap…");

      try {
        await createRoadmapRequest(goal);
        showToast("Your roadmap is ready!", "success");
      } catch (err) {
        showToast("Roadmap created.", "success");
      } finally {
        sendBtn.disabled = false;
      }
    }

    sendBtn && sendBtn.addEventListener("click", submitInlineGoal);
    textarea.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitInlineGoal(); }
    });
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

    generateBtn.addEventListener("click", async () => {
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
      }, 900);

      try {
        await createRoadmapRequest(goal);
      } catch (err) {
        console.warn("Generation completed with fallback", err);
      }

      setTimeout(() => {
        clearInterval(msgInterval);
        closeModal("addRoadmapOverlay");
        formView.classList.remove("is-hidden");
        genState.classList.remove("is-active");
        textarea.value = "";
        updateCount();
        showToast("Your roadmap is ready!", "success");
      }, 2400);
    });
  }

  /* ---------- Roadmap cards + options modal ---------- */

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
      if (e.target.closest(".card-menu-btn")) return;
      const title = card.dataset.title || "";
      const id = card.dataset.id || "";
      const type = card.dataset.type || "sequential";
      window.location.href = `roadmap.html?title=${encodeURIComponent(title)}&id=${encodeURIComponent(id)}&type=${encodeURIComponent(type)}`;
    });
    const menuBtn = card.querySelector(".card-menu-btn");
    if (menuBtn) {
      menuBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openOptionsForCard(card);
      });
    }
  }

  function wireOptionsModalActions() {
    $("#viewRoadmapOption").addEventListener("click", () => {
      if (!currentOptionsCard) return;
      const title = currentOptionsCard.dataset.title || "";
      const id = currentOptionsCard.dataset.id || "";
      const type = currentOptionsCard.dataset.type || "sequential";
      closeModal("roadmapOptionsOverlay");
      window.location.href = `roadmap.html?title=${encodeURIComponent(title)}&id=${encodeURIComponent(id)}&type=${encodeURIComponent(type)}`;
    });

    $("#renameRoadmapOption").addEventListener("click", () => {
      if (!currentOptionsCard) return;
      const current = currentOptionsCard.dataset.title;
      const next = window.prompt("Rename roadmap", current);
      if (next && next.trim()) {
        const trimmed = next.trim();
        const id = currentOptionsCard.dataset.id;
        currentOptionsCard.dataset.title = trimmed;
        currentOptionsCard.querySelector(".roadmap-title").textContent = trimmed;
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
        updateEmptyState();
      }, 250);
      showToast("Roadmap deleted.");
    });
  }

  /* ---------- Streak popup ---------- */

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

  /* ---------- Notifications dropdown ---------- */

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
      window.location.href = "notifications.html";
    });
  }

  /* ---------- Ask Nodi modal ---------- */

  const nodiReplies = [
    "Good question — I'm ready to help you with your roadmap tasks. Try breaking your next goal into small 15-minute steps to get momentum.",
    "Here's a tip: Focus on one task at a time and mark it complete to keep your streak going!",
    "If a task feels stuck, try tackling the easiest piece first. That often builds the momentum you need."
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
      }, 1000);
    }

    sendBtn.addEventListener("click", () => sendMessage());
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") sendMessage(); });
    $all(".suggestion-chip").forEach((chip) => {
      chip.addEventListener("click", () => sendMessage(chip.textContent));
    });
  }

  /* ---------- init ---------- */

  function init() {
    const run = () => {
      updateGreeting();
      wireGenericModalClosers();
      wireDrawer();
      wireChatCard();
      wireAddRoadmapModal();
      wireOptionsModalActions();
      wireStreakPopup();
      wireNotifications();
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
    addRoadmapCardToList,
  };
})();

if (typeof window !== "undefined" && window.TasklyDashboard) {
  window.TasklyDashboard.init();
}
