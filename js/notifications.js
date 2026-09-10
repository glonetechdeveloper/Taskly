/* ==========================================================
   TASKLY — notifications.js
   Notifications view with live FastAPI backend synchronization
   ========================================================== */

window.TasklyNotifications = (function () {

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

  /* ---------- Streak Handling ---------- */

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

  /* ---------- Notifications Data & Synchronization ---------- */

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

  async function fetchNotificationsFromServer() {
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
    renderNotificationsPage();
  }

  function renderNotificationsPage() {
    const container = $("#notifGroups");
    const emptyState = $("#notifEmptyState");
    const notifs = getStoredNotifications();

    if (!container) return;

    if (notifs.length === 0) {
      container.innerHTML = "";
      if (emptyState) emptyState.classList.add("is-visible");
      return;
    }

    if (emptyState) emptyState.classList.remove("is-visible");

    let html = '<div class="notif-group">';
    html += '<p class="notif-group-label">Recent Notifications</p>';
    html += '<div class="notif-page-list">';

    notifs.forEach((n, i) => {
      const isMilestone = n.type === "milestone";
      const icon = isMilestone ? "ic-flame" : "ic-check";
      const variant = isMilestone ? "is-teal" : "";
      const timeStr = n.created_at ? new Date(n.created_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "Recently";

      html += `<div class="notif-page-item" data-roadmap-id="${escapeHtml(n.roadmap_id || '')}" style="animation-delay:${i * 0.04}s; cursor: ${n.roadmap_id ? 'pointer' : 'default'};">
        <div class="notif-page-icon ${variant}">
          <svg viewBox="0 0 24 24" fill="${isMilestone ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <use href="#${icon}"></use>
          </svg>
        </div>
        <div class="notif-page-body">
          <p class="notif-page-text">${escapeHtml(n.message || 'Notification update')}</p>
          <p class="notif-page-time">${timeStr}</p>
        </div>
      </div>`;
    });

    html += '</div></div>';
    container.innerHTML = html;

    // Wire clicks on items with roadmap_id
    $all(".notif-page-item[data-roadmap-id]").forEach(item => {
      const rmId = item.dataset.roadmapId;
      if (rmId) {
        item.addEventListener("click", () => {
          window.location.href = `roadmap.html?id=${encodeURIComponent(rmId)}`;
        });
      }
    });
  }

  function wireClearAllBtn() {
    const btn = $("#markAllReadBtn");
    if (!btn) return;

    btn.addEventListener("click", () => {
      localStorage.removeItem("taskly_notifications");
      renderNotificationsPage();
      showToast("All notifications cleared.", "success");
    });
  }

  /* ---------- Ask Nodi ---------- */

  const nodiReplies = [
    "Notifications keep you updated whenever a roadmap finishes generation or reaches a milestone threshold.",
    "You can clear notifications anytime using the button in the top right.",
    "Complete tasks to build your streak and unlock new milestones!"
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

  /* ---------- Sidebar Logout ---------- */

  function wireSidebarLogout() {
    const btn = $("#sidebarLogoutBtn");
    if (!btn) return;
    btn.addEventListener("click", () => {
      if (typeof window.TasklyAPI !== "undefined") {
        window.TasklyAPI.clearToken();
      }
      try {
        localStorage.removeItem("taskly_user_email");
        localStorage.removeItem("taskly_user_name");
        localStorage.removeItem("taskly_user_avatar");
      } catch (e) {}
      window.location.href = "login.html";
    });
  }

  /* ---------- Initialization ---------- */

  async function init() {
    const run = async () => {
      wireGenericModalClosers();
      wireDrawer();
      wireStreakPopup();
      wireNodiModal();
      wireSidebarLogout();
      wireClearAllBtn();

      await Promise.all([
        fetchNotificationsFromServer(),
        loadStreak()
      ]);
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", run);
    } else {
      run();
    }
  }

  return { init };
})();

if (typeof window !== "undefined" && window.TasklyNotifications) {
  window.TasklyNotifications.init();
}
