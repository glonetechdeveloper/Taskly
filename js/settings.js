/* ==========================================================
   TASKLY — settings.js
   Settings management with live FastAPI backend preferences
   ========================================================== */

window.TasklySettings = (function () {

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

  /* ---------- Notifications Dropdown ---------- */

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
      console.warn("Could not fetch notifications:", err);
    }
    renderNotificationDropdown();
  }

  function renderNotificationDropdown() {
    const panel = $("#notifPanel");
    const dot = $("#notifDot");
    if (!panel) return;

    const notifs = getStoredNotifications();
    if (dot) dot.style.display = notifs.length > 0 ? "block" : "none";

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

  /* ---------- Notification Preferences (GET & PATCH /notifications/preferences) ---------- */

  async function initNotificationPreferences() {
    const milestoneToggle = $("#milestoneNotifToggle") || $("#pushNotifToggle");
    const emailToggle = $("#emailNotifToggle");

    // Load from backend
    try {
      const prefs = await window.TasklyAPI.getNotificationPreferences();
      if (prefs) {
        if (milestoneToggle && typeof prefs.milestone_notifications === "boolean") {
          milestoneToggle.checked = prefs.milestone_notifications;
        }
        if (emailToggle && typeof prefs.email_enabled === "boolean") {
          emailToggle.checked = prefs.email_enabled;
        }
      }
    } catch (err) {
      console.warn("Could not fetch notification preferences:", err);
    }

    // Wire auto-save on change
    const savePrefs = async () => {
      const payload = {
        milestone_notifications: milestoneToggle ? milestoneToggle.checked : true,
        email_enabled: emailToggle ? emailToggle.checked : true
      };

      try {
        await window.TasklyAPI.updateNotificationPreferences(payload);
        showToast("Notification preferences updated.", "success");
      } catch (err) {
        console.error("Failed to update preferences:", err);
        showToast(err.message || "Failed to save preferences", "error");
      }
    };

    milestoneToggle && milestoneToggle.addEventListener("change", savePrefs);
    emailToggle && emailToggle.addEventListener("change", savePrefs);
  }

  /* ---------- Local Preferences (Sound, Language, Timezone) ---------- */

  function initLocalPreferences() {
    const soundToggle = $("#soundEffectsToggle");
    const langSelect = $("#languageSelect");
    const tzSelect = $("#timezoneSelect");

    try {
      const localPrefs = JSON.parse(localStorage.getItem("taskly_local_settings") || "{}");
      if (soundToggle && typeof localPrefs.sound === "boolean") soundToggle.checked = localPrefs.sound;
      if (langSelect && localPrefs.language) langSelect.value = localPrefs.language;
      if (tzSelect && localPrefs.timezone) tzSelect.value = localPrefs.timezone;
    } catch (e) {}

    const saveLocal = () => {
      const prefs = {
        sound: soundToggle ? soundToggle.checked : true,
        language: langSelect ? langSelect.value : "en",
        timezone: tzSelect ? tzSelect.value : "gmt+1"
      };
      try {
        localStorage.setItem("taskly_local_settings", JSON.stringify(prefs));
      } catch (e) {}
      showToast("Settings saved.", "success");
    };

    soundToggle && soundToggle.addEventListener("change", saveLocal);
    langSelect && langSelect.addEventListener("change", saveLocal);
    tzSelect && tzSelect.addEventListener("change", saveLocal);
  }

  /* ---------- Ask Nodi ---------- */

  const nodiReplies = [
    "You can manage your email alerts, milestone notifications, and timezone preferences right here.",
    "Looking to change how often you receive updates? Toggle Email Reminders or Milestone Notifications above.",
    "Settings are automatically synced across your devices when you're signed in."
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
      wireNotifDropdown();
      wireNodiModal();
      wireSidebarLogout();
      initLocalPreferences();

      await Promise.all([
        initNotificationPreferences(),
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

  return { init };
})();

if (typeof window !== "undefined" && window.TasklySettings) {
  window.TasklySettings.init();
}
