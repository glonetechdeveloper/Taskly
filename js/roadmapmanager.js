/* ==========================================================
   TASKLY — roadmap-manager.js
   ========================================================== */
window.TasklyManager = (function () {

  const API_BASE = window.API_BASE || window.TASKLY_API_BASE || localStorage.getItem("TASKLY_API_BASE") || "https://your-service.onrender.com";
  const TOKEN_KEY = "access_token";

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

  function goToRoadmap(type, title, blank) {
    let url = "roadmap.html?type=" + encodeURIComponent(type) + "&title=" + encodeURIComponent(title);
    if (blank) url += "&blank=1";
    window.location.href = url;
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
      showToast("A full notifications page is coming soon.");
    });
  }

  /* ---------- filter tabs ---------- */

  function updateEmptyFilterState() {
    const anyVisible = $all(".roadmap-card").some((c) => c.style.display !== "none");
    $("#managerEmptyFilter").classList.toggle("is-visible", !anyVisible);
  }

  function wireFilterTabs() {
    $all(".filter-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        $all(".filter-tab").forEach((t) => t.classList.remove("is-active"));
        tab.classList.add("is-active");
        const filter = tab.dataset.filter;
        $all(".roadmap-card").forEach((card) => {
          const match = filter === "all" || card.dataset.type === filter;
          card.style.display = match ? "" : "none";
        });
        updateEmptyFilterState();
      });
    });
  }

  /* ---------- roadmap cards: click to open, menu for options ---------- */

  let currentOptionsCard = null;

  function wireManagerCards() {
    $all(".roadmap-card").forEach((card) => {
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
    });
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
        currentOptionsCard.dataset.title = trimmed;
        currentOptionsCard.querySelector(".roadmap-title").firstChild.textContent = trimmed + " ";
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
        updateEmptyFilterState();
      }, 250);
      showToast("Roadmap deleted.");
    });
  }

  /* ---------- Add New Roadmap (AI) — generates, then opens the result ---------- */

  async function createRoadmapRequest(goalText) {
    const token = getToken();
    const res = await fetch(API_BASE + "/roadmaps", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ goal_text: goalText })
    });
    if (!res.ok) throw new Error("Request failed");
    return res.json().catch(() => ({}));
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

    const messages = ["Breaking this into phases…", "Figuring out what needs to come first…", "Filling in the details…"];

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

      createRoadmapRequest(goal).catch(() => {});

      setTimeout(() => {
        clearInterval(msgInterval);
        // No real generated content without a backend yet — land on a
        // fresh, empty roadmap page ready for manual tasks rather than
        // fabricate fake AI output.
        goToRoadmap("sequential", goal, true);
      }, 3200);
    });
  }

  /* ---------- Create Checklist (manual) ---------- */

  function wireCreateChecklistModal() {
    const openBtn = $("#createChecklistBtn");
    const nameInput = $("#checklistNameInput");
    const saveBtn = $("#createChecklistSaveBtn");
    if (!openBtn) return;

    openBtn.addEventListener("click", () => {
      openModal("createChecklistOverlay");
      nameInput.value = "";
      saveBtn.disabled = true;
      setTimeout(() => nameInput.focus(), 250);
    });

    nameInput.addEventListener("input", () => {
      saveBtn.disabled = nameInput.value.trim().length === 0;
    });

    saveBtn.addEventListener("click", () => {
      const name = nameInput.value.trim();
      if (!name) return;
      goToRoadmap("flat", name, true);
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
      wireStreakPopup();
      wireNotifications();
      wireFilterTabs();
      wireManagerCards();
      wireOptionsModalActions();
      wireAddRoadmapModal();
      wireCreateChecklistModal();
      wireNodiModal();
      updateEmptyFilterState();
    });
  }

  return { init };
})();

TasklyManager.init();
