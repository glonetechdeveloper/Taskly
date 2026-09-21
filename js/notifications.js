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

  function wireNotifDropdown() {
    const btn = $("#notifBtn");
    const panel = $("#notifPanel");
    const dot = $("#notifDot");
    if (!btn || !panel) return;

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const willOpen = !panel.classList.contains("is-open");
      if (willOpen) {
        panel.classList.add("is-open");
        if (dot) dot.style.display = "none";
      } else {
        panel.classList.remove("is-open");
      }
    });

    document.addEventListener("click", (e) => {
      if (panel.classList.contains("is-open") && !panel.contains(e.target) && !btn.contains(e.target)) {
        panel.classList.remove("is-open");
      }
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
    if (window.TasklyAPI && typeof window.TasklyAPI.getStoredNotifications === "function") {
      return window.TasklyAPI.getStoredNotifications();
    }
    try {
      const raw = localStorage.getItem("taskly_notifications");
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveStoredNotifications(notifs) {
    if (window.TasklyAPI && typeof window.TasklyAPI.saveStoredNotifications === "function") {
      window.TasklyAPI.saveStoredNotifications(notifs);
    } else {
      try {
        localStorage.setItem("taskly_notifications", JSON.stringify(notifs));
      } catch (e) {}
    }
  }

  async function fetchNotificationsFromServer() {
    try {
      if (window.TasklyAPI && typeof window.TasklyAPI.getNotifications === "function") {
        await window.TasklyAPI.getNotifications();
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

    const unread = notifs.filter(n => !n.read);
    const read = notifs.filter(n => n.read);

    let html = "";

    // 1. Unread section
    if (unread.length > 0) {
      html += '<div class="notif-group" style="margin-bottom: 24px;">';
      html += `<p class="notif-group-label" style="font-weight:700; color:var(--color-teal); display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
        <span>Unread (${unread.length})</span>
        <button id="markAllReadPageBtn" type="button" style="background:none; border:none; color:var(--color-teal); font-weight:700; font-size:12.5px; cursor:pointer;">Mark all as read</button>
      </p>`;
      html += '<div class="notif-page-list">';
      unread.forEach((n, i) => {
        const isMilestone = n.type === "milestone";
        const icon = isMilestone ? "ic-flame" : "ic-check";
        const variant = isMilestone ? "is-teal" : "";
        const timeStr = n.created_at ? new Date(n.created_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "Just now";

        html += `<div class="notif-page-item is-unread" data-id="${n.id}" data-roadmap-id="${escapeHtml(n.roadmap_id || '')}" style="background: rgba(13, 148, 136, 0.05); border-left: 4px solid var(--color-teal); margin-bottom: 8px; border-radius: 12px; padding: 12px 16px; cursor: pointer;">
          <div style="display:flex; gap:12px; align-items:flex-start;">
            <div class="notif-page-icon ${variant}">
              <svg viewBox="0 0 24 24" fill="${isMilestone ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.8">
                <use href="#${icon}"></use>
              </svg>
            </div>
            <div class="notif-page-body" style="flex:1;">
              <p class="notif-page-text" style="font-weight:700; margin:0 0 4px 0;">${escapeHtml(n.message || 'Notification update')}</p>
              <p class="notif-page-time" style="font-size:11.5px; color:#94A3B8; margin:0;">${timeStr}</p>
            </div>
          </div>
        </div>`;
      });
      html += '</div></div>';
    }

    // 2. Read section
    if (read.length > 0) {
      html += '<div class="notif-group">';
      html += `<p class="notif-group-label" style="font-weight:700; color:var(--color-ink-soft); margin-bottom:12px;">Read (${read.length})</p>`;
      html += '<div class="notif-page-list">';
      read.forEach((n, i) => {
        const isMilestone = n.type === "milestone";
        const icon = isMilestone ? "ic-flame" : "ic-check";
        const timeStr = n.created_at ? new Date(n.created_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "Previously";

        html += `<div class="notif-page-item is-read" data-id="${n.id}" data-roadmap-id="${escapeHtml(n.roadmap_id || '')}" style="opacity: 0.75; margin-bottom: 8px; border-radius: 12px; padding: 12px 16px; cursor: pointer;">
          <div style="display:flex; gap:12px; align-items:flex-start;">
            <div class="notif-page-icon" style="background:#F1F5F9; color:#94A3B8;">
              <svg viewBox="0 0 24 24" fill="${isMilestone ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.8">
                <use href="#${icon}"></use>
              </svg>
            </div>
            <div class="notif-page-body" style="flex:1;">
              <p class="notif-page-text" style="font-weight:500; margin:0 0 4px 0;">${escapeHtml(n.message || 'Notification update')}</p>
              <p class="notif-page-time" style="font-size:11.5px; color:#94A3B8; margin:0;">${timeStr}</p>
            </div>
          </div>
        </div>`;
      });
      html += '</div></div>';
    }

    container.innerHTML = html;

    // Wire clicks on items
    $all(".notif-page-item").forEach(item => {
      item.addEventListener("click", () => {
        const id = item.dataset.id;
        const rmId = item.dataset.roadmapId;
        const target = notifs.find(n => n.id === id);
        if (target) {
          target.read = true;
          saveStoredNotifications(notifs);
        }
        if (rmId) {
          window.location.href = `roadmap.html?id=${encodeURIComponent(rmId)}`;
        } else {
          renderNotificationsPage();
        }
      });
    });

    const markAllBtn = $("#markAllReadPageBtn");
    if (markAllBtn) {
      markAllBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (window.TasklyAPI && typeof window.TasklyAPI.markAllNotificationsRead === "function") {
          window.TasklyAPI.markAllNotificationsRead();
        } else {
          notifs.forEach(n => n.read = true);
          saveStoredNotifications(notifs);
          renderNotificationsPage();
        }
        showToast("All notifications marked as read.", "success");
      });
    }
  }

  function wireClearAllBtn() {
    const btn = $("#markAllReadBtn");
    if (!btn) return;

    btn.addEventListener("click", () => {
      if (window.TasklyAPI && typeof window.TasklyAPI.markAllNotificationsRead === "function") {
        window.TasklyAPI.markAllNotificationsRead();
      } else {
        const notifs = getStoredNotifications();
        notifs.forEach(n => n.read = true);
        saveStoredNotifications(notifs);
        renderNotificationsPage();
      }
      showToast("All notifications marked as read.", "success");
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
      wireClearAllBtn();

      await Promise.all([
        fetchNotificationsFromServer(),
        loadStreak()
      ]);

      window.addEventListener("taskly:notifications-updated", () => renderNotificationsPage());
      window.addEventListener("storage", (e) => {
        if (e.key === "taskly_notifications") renderNotificationsPage();
      });
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", run);
    } else {
      run();
    }
  }

  return { init, renderNotificationsPage };
})();

if (typeof window !== "undefined" && window.TasklyNotifications) {
  window.TasklyNotifications.init();
}
