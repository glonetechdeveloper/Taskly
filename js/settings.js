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
          const badge = streakBtn.querySelector(".badge-count") || streakBtn.querySelector(".streak-count") || $("#streakBadge");
          if (badge) badge.textContent = count;
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
    if (window.SidebarController && typeof window.SidebarController.renderNavbarNotifications === "function") {
      window.SidebarController.renderNavbarNotifications();
    }
  }

  function wireNotifDropdown() {
    if (window.SidebarController && typeof window.SidebarController.initNotifDropdown === "function") {
      window.SidebarController.initNotifDropdown();
    }
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
      const savedLang = localStorage.getItem("taskly_language") || "en";
      if (langSelect) langSelect.value = savedLang;

      const localPrefs = JSON.parse(localStorage.getItem("taskly_local_settings") || "{}");
      if (soundToggle && typeof localPrefs.sound === "boolean") soundToggle.checked = localPrefs.sound;
      if (tzSelect && localPrefs.timezone) tzSelect.value = localPrefs.timezone;
    } catch (e) {}

    const saveLocal = () => {
      const selectedLang = langSelect ? langSelect.value : "en";
      const prefs = {
        sound: soundToggle ? soundToggle.checked : true,
        language: selectedLang,
        timezone: tzSelect ? tzSelect.value : "gmt+1"
      };
      try {
        localStorage.setItem("taskly_language", selectedLang);
        localStorage.setItem("taskly_local_settings", JSON.stringify(prefs));
      } catch (e) {}

      const langNames = {
        "en": "English (US)",
        "en-gb": "English (UK)",
        "es": "Español",
        "fr": "Français",
        "de": "Deutsch"
      };
      showToast(`Language updated to ${langNames[selectedLang] || selectedLang}`, "success");
    };

    soundToggle && soundToggle.addEventListener("change", saveLocal);
    langSelect && langSelect.addEventListener("change", saveLocal);
    tzSelect && tzSelect.addEventListener("change", saveLocal);
  }

  /* ---------- Ask Nodi ---------- */

  /* ---------- Appearance / Theme Preference ---------- */

  function initThemePreference() {
    const darkToggle = $("#darkModeToggle");
    const currentTheme = document.documentElement.getAttribute("data-theme") || localStorage.getItem("taskly_theme") || "light";
    
    if (darkToggle) {
      darkToggle.checked = currentTheme === "dark";
      darkToggle.addEventListener("change", () => {
        const newTheme = darkToggle.checked ? "dark" : "light";
        document.documentElement.setAttribute("data-theme", newTheme);
        try {
          localStorage.setItem("taskly_theme", newTheme);
        } catch (e) {}
        if (window.TasklyAPI) {
          window.TasklyAPI.emit("taskly:theme-changed", { theme: newTheme });
        }
      });
    }

    window.addEventListener("taskly:theme-changed", (e) => {
      const t = (e.detail && e.detail.theme) || localStorage.getItem("taskly_theme") || "light";
      if (darkToggle) darkToggle.checked = t === "dark";
      document.documentElement.setAttribute("data-theme", t);
    });
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
        localStorage.removeItem("taskly_user_password");
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
      wireSidebarLogout();
      initThemePreference();
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
