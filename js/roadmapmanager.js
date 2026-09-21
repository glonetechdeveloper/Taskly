/* ==========================================================
   TASKLY — roadmapmanager.js
   Roadmap Manager logic connected to live FastAPI backend
   ========================================================== */

window.TasklyManager = (function () {

  let userRoadmaps = [];
  let currentFilter = "all";
  let activeRoadmap = null;

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

  /* ---------- Notifications Handling ---------- */

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

  async function loadNotifications() {
    try {
      if (window.TasklyAPI && typeof window.TasklyAPI.getNotifications === "function") {
        await window.TasklyAPI.getNotifications();
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
    const unread = notifs.filter(n => !n.read);
    if (dot) {
      dot.style.display = unread.length > 0 ? "block" : "none";
    }

    const formatRelativeTime = (iso) => {
      if (!iso) return "Just now";
      try {
        const diff = (Date.now() - new Date(iso).getTime()) / 1000;
        if (diff < 60) return "Just now";
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
      } catch (e) {
        return "Recently";
      }
    };

    panel.innerHTML = `
      <div class="dropdown-header" style="display:flex; justify-content:space-between; align-items:center; padding:12px 16px; border-bottom:1px solid var(--color-border, #f1f5f9);">
        <span style="font-weight:700; font-size:13.5px;">Notifications</span>
        ${unread.length > 0 ? '<button id="clearNotifsBtn" type="button" style="background:none; border:none; color:var(--color-teal, #0d9488); font-size:11.5px; font-weight:700; cursor:pointer; padding:2px 6px;">Mark all read</button>' : ''}
      </div>
      <div class="notif-dropdown-list" style="max-height: 320px; overflow-y: auto;">
        ${notifs.length === 0 ? `
          <div style="padding: 24px 16px; text-align: center; color: var(--color-ink-soft); font-size: 13px;">
            No new notifications
          </div>
        ` : notifs.slice(0, 15).map(n => `
          <div class="notif-item ${n.read ? 'is-read' : 'is-unread'}" data-notif-id="${n.id}" data-roadmap-id="${escapeHtml(n.roadmap_id || '')}" style="cursor: pointer; padding: 10px 14px; border-bottom: 1px solid var(--color-border, #f1f5f9); background: ${n.read ? 'transparent' : 'rgba(13, 148, 136, 0.06)'};">
            <div style="display:flex; gap:10px; align-items:flex-start;">
              <div class="notif-icon ${n.type === 'milestone' || n.type === 'roadmap' ? 'is-teal' : ''}" style="width:28px; height:28px; border-radius:50%; background: ${n.read ? '#F1F5F9' : '#CCFBF1'}; color: ${n.read ? '#94A3B8' : '#0D9488'}; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="${n.type === 'milestone' ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                  <path d="M6 9a6 6 0 0 1 12 0c0 4 1.5 5.5 2 6H4c.5-.5 2-2 2-6Z"/>
                </svg>
              </div>
              <div style="flex:1; min-width:0;">
                <p class="notif-text" style="font-size:12.5px; line-height:1.4; margin:0; font-weight:${n.read ? '500' : '700'}; color:var(--color-ink, #0f172a);">${escapeHtml(n.message || 'Notification update')}</p>
                <p class="notif-time" style="font-size:11px; color:#94A3B8; margin-top:3px;">${formatRelativeTime(n.created_at)}</p>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
      <div class="dropdown-footer" style="padding:8px; text-align:center; border-top:1px solid var(--color-border, #f1f5f9);">
        <button class="view-all-btn" id="viewAllNotifsBtn" type="button" style="color:var(--color-teal, #0d9488); font-weight:700; font-size:12.5px; background:none; border:none; cursor:pointer;">View all notifications</button>
      </div>
    `;

    const clearBtn = $("#clearNotifsBtn", panel);
    if (clearBtn) {
      clearBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (window.TasklyAPI && typeof window.TasklyAPI.markAllNotificationsRead === "function") {
          window.TasklyAPI.markAllNotificationsRead();
        } else {
          notifs.forEach(n => n.read = true);
          saveStoredNotifications(notifs);
        }
        renderNotificationDropdown();
        showToast("All notifications marked as read.", "success");
      });
    }

    const viewAllBtn = $("#viewAllNotifsBtn", panel);
    if (viewAllBtn) {
      viewAllBtn.addEventListener("click", () => {
        panel.classList.remove("is-open");
        window.location.href = "notifications.html";
      });
    }

    $all(".notif-item", panel).forEach(item => {
      item.addEventListener("click", () => {
        const id = item.dataset.notifId;
        const rmId = item.dataset.roadmapId;
        const found = notifs.find(n => n.id === id);
        if (found) {
          found.read = true;
          saveStoredNotifications(notifs);
          renderNotificationDropdown();
        }
        if (rmId) {
          panel.classList.remove("is-open");
          window.location.href = `roadmap.html?id=${encodeURIComponent(rmId)}`;
        }
      });
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

    window.addEventListener("taskly:notifications-updated", () => renderNotificationDropdown());
    window.addEventListener("storage", (e) => {
      if (e.key === "taskly_notifications") renderNotificationDropdown();
    });
  }

  /* ---------- Fetch Roadmaps (GET /roadmaps) ---------- */

  async function fetchUserRoadmaps() {
    try {
      const data = await window.TasklyAPI.getRoadmaps();
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
      console.warn("Error fetching roadmaps:", err);
      userRoadmaps = [];
    }

    renderRoadmapList();
  }

  let roadmapPollInterval = null;

  function startRoadmapGenerationPolling() {
    if (roadmapPollInterval) clearInterval(roadmapPollInterval);

    const pollTick = async () => {
      const generating = userRoadmaps.filter(r => {
        const s = (r.status || "done").toLowerCase();
        return s !== "done" && s !== "failed";
      });

      if (generating.length === 0) {
        if (roadmapPollInterval) {
          clearInterval(roadmapPollInterval);
          roadmapPollInterval = null;
        }
        return;
      }

      let anyDone = false;

      for (const rm of generating) {
        try {
          const statusData = await window.TasklyAPI.getGenerationStatus(rm.id);
          const currentStatus = (statusData && (statusData.status || (statusData.roadmap && statusData.roadmap.status) || "")).toLowerCase();

          if (currentStatus && currentStatus !== (rm.status || "").toLowerCase()) {
            rm.status = currentStatus;

            const card = document.querySelector(`article.roadmap-card[data-id="${rm.id}"]`);
            if (card) {
              if (currentStatus === "done") {
                anyDone = true;
                if (window.TasklyAPI && typeof window.TasklyAPI.addNotification === "function") {
                  window.TasklyAPI.addNotification({
                    message: `"${rm.title || rm.goal_text || 'Roadmap'}" generation complete!`,
                    type: "roadmap",
                    roadmap_id: rm.id
                  });
                }
                const metaEl = card.querySelector(".roadmap-body span") || card.querySelector(".roadmap-meta");
                if (metaEl) metaEl.outerHTML = `<p class="roadmap-meta">0% completed</p>`;
                const progressFill = card.querySelector(".progress-fill");
                if (progressFill) {
                  progressFill.classList.remove("is-pulse");
                  progressFill.style.width = "0%";
                }
              } else if (currentStatus === "failed") {
                const metaEl = card.querySelector(".roadmap-body span") || card.querySelector(".roadmap-meta");
                if (metaEl) metaEl.outerHTML = `<span style="color:var(--color-error); font-weight:600; font-size:12px;">Generation failed</span>`;
                const progressFill = card.querySelector(".progress-fill");
                if (progressFill) progressFill.classList.remove("is-pulse");
              } else {
                const metaEl = card.querySelector(".roadmap-body span");
                if (metaEl) {
                  const stageLabel = currentStatus === "generating_tasks" ? "Generating tasks…" : "Generating phases…";
                  metaEl.innerHTML = `<span class="spinner-ring" style="width:12px; height:12px; border-width:1.5px; border-top-color:var(--color-orange-deep);"></span> ${stageLabel}`;
                }
              }
            }
          }
        } catch (e) {
          console.warn("Roadmap generation poll error:", e);
        }
      }

      if (anyDone) {
        showToast("Roadmap generation complete!", "success");
        await fetchUserRoadmaps();
      }
    };

    roadmapPollInterval = setInterval(pollTick, 500);
  }

  function renderRoadmapList() {
    const grid = $("#managerList") || $("#roadmapGrid");
    if (!grid) return;
    grid.innerHTML = "";

    const filtered = filterRoadmaps(userRoadmaps, currentFilter);

    filtered.forEach((rm, index) => {
      const card = createCardElement(rm, index);
      grid.appendChild(card);
      wireCardEvents(card, rm);
    });

    updateEmptyFilterState(filtered.length);
    startRoadmapGenerationPolling();
  }

  function filterRoadmaps(list, filter) {
    if (!list) return [];
    if (filter === "all") return list;
    if (filter === "sequential") return list.filter(r => r.type !== "flat" && r.type !== "checklist");
    if (filter === "flat") return list.filter(r => r.type === "flat" || r.type === "checklist");
    if (filter === "completed") return list.filter(r => (r.progress_percentage || 0) === 100);
    return list;
  }

  function createCardElement(rm, index) {
    const variant = index % 2 === 0 ? "is-teal" : "";
    const title = rm.title || rm.goal_text || "Roadmap";
    const iconId = getIconForTitle(title);
    const type = rm.type === "flat" || rm.type === "checklist" ? "flat" : "sequential";
    const typeLabel = type === "flat" ? "Checklist" : "Milestone Graph";
    const status = (rm.status || "done").toLowerCase();
    const isDone = status === "done";
    const isFailed = status === "failed";
    const isGenerating = !isDone && !isFailed;

    const progress = typeof rm.progress_percentage === "number" ? Math.round(rm.progress_percentage) : (typeof rm.progress === "number" ? Math.round(rm.progress) : 0);

    const card = document.createElement("article");
    card.className = "roadmap-card";
    card.dataset.id = rm.id;
    card.dataset.type = type;

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
      <div class="roadmap-card-header">
        <div class="roadmap-icon ${variant}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <use href="#${iconId}"></use>
          </svg>
        </div>
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

  function wireCardEvents(card, rm) {
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

  function updateEmptyFilterState(count) {
    const empty = $("#managerEmptyFilter") || $("#emptyFilterState");
    if (!empty) return;
    const hasItems = count > 0;
    empty.classList.toggle("is-visible", !hasItems);
  }

  function wireFilterChips() {
    $all(".filter-tab, .filter-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $all(".filter-tab, .filter-chip").forEach(c => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        currentFilter = chip.dataset.filter || "all";
        renderRoadmapList();
      });
    });
  }

  /* ---------- Roadmap Options Modal (Rename, Regenerate, Delete) ---------- */

  function openRoadmapOptionsMenu(rm) {
    activeRoadmap = rm;
    const title = rm.title || rm.goal_text || "Roadmap";
    const status = (rm.status || "done").toLowerCase();

    const titleEl = $("#optionsRoadmapTitle");
    if (titleEl) titleEl.textContent = title;

    const metaEl = $("#optionsRoadmapMeta");
    if (metaEl) metaEl.textContent = status === "done" ? `${rm.progress_percentage || 0}% completed` : status;

    const iconUse = $("#optionsRoadmapIconUse");
    if (iconUse) {
      iconUse.setAttribute("href", "#" + getIconForTitle(title));
    }

    const optionsView = $("#roadmapOptionsView") || $("#optionsMenuRoot");
    const confirmView = $("#deleteConfirmView");
    if (optionsView) optionsView.style.display = "block";
    if (confirmView) confirmView.style.display = "none";

    openModal("roadmapOptionsOverlay");
  }

  function wireRoadmapOptionsMenu() {
    const viewBtn = $("#viewRoadmapOption");
    viewBtn && viewBtn.addEventListener("click", () => {
      closeModal("roadmapOptionsOverlay");
      if (activeRoadmap) {
        window.location.href = `roadmap.html?id=${encodeURIComponent(activeRoadmap.id)}`;
      }
    });

    const renameBtn = $("#renameRoadmapOption");
    const customRenameInput = $("#customRenameInput");
    const customRenameSaveBtn = $("#customRenameSaveBtn");

    renameBtn && renameBtn.addEventListener("click", () => {
      if (!activeRoadmap) return;
      closeModal("roadmapOptionsOverlay");
      if (customRenameInput) customRenameInput.value = activeRoadmap.title || activeRoadmap.goal_text || "";
      openModal("renameRoadmapModal");
      setTimeout(() => customRenameInput && customRenameInput.focus(), 50);
    });

    const submitCustomRename = async () => {
      if (!activeRoadmap || !customRenameInput) return;
      const newTitle = customRenameInput.value.trim();
      if (newTitle) {
        activeRoadmap.title = newTitle;
        closeModal("renameRoadmapModal");
        renderRoadmapList();
        if (window.TasklyAPI && typeof window.TasklyAPI.addNotification === "function") {
          window.TasklyAPI.addNotification({
            message: `Renamed roadmap to "${newTitle}"`,
            type: "roadmap",
            roadmap_id: activeRoadmap.id
          });
        }
        showToast("Roadmap renamed.", "success");
        try {
          await window.TasklyAPI.updateRoadmap(activeRoadmap.id, { title: newTitle });
        } catch (err) {
          showToast(err.message || "Failed to rename roadmap", "error");
        }
      }
    };

    if (customRenameSaveBtn) customRenameSaveBtn.onclick = submitCustomRename;
    if (customRenameInput) {
      customRenameInput.onkeydown = (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          submitCustomRename();
        }
      };
    }

    const regenBtn = $("#regenerateRoadmapOption");
    regenBtn && regenBtn.addEventListener("click", async () => {
      if (!activeRoadmap) return;
      const title = activeRoadmap.title || activeRoadmap.goal_text || "Roadmap";
      closeModal("roadmapOptionsOverlay");
      try {
        await window.TasklyAPI.regenerateRoadmap(activeRoadmap.id);
        if (window.TasklyAPI && typeof window.TasklyAPI.addNotification === "function") {
          window.TasklyAPI.addNotification({
            message: `Regeneration started for "${title}"`,
            type: "roadmap",
            roadmap_id: activeRoadmap.id
          });
        }
        showToast("Roadmap regeneration started.", "success");
        window.location.href = `roadmap.html?id=${encodeURIComponent(activeRoadmap.id)}`;
      } catch (err) {
        showToast(err.message || "Failed to regenerate roadmap", "error");
      }
    });

    const optionsView = $("#roadmapOptionsView") || $("#optionsMenuRoot");
    const confirmView = $("#deleteConfirmView");

    const deleteOptionBtn = $("#deleteRoadmapOption");
    deleteOptionBtn && deleteOptionBtn.addEventListener("click", () => {
      if (!activeRoadmap) return;
      const titleEl = $("#deleteConfirmTitle");
      if (titleEl) titleEl.textContent = activeRoadmap.title || activeRoadmap.goal_text || "this roadmap";
      if (optionsView) optionsView.style.display = "none";
      if (confirmView) confirmView.style.display = "block";
    });

    const cancelDeleteBtn = $("#cancelDeleteBtn");
    cancelDeleteBtn && cancelDeleteBtn.addEventListener("click", () => {
      if (optionsView) optionsView.style.display = "block";
      if (confirmView) confirmView.style.display = "none";
    });

    const confirmDeleteBtn = $("#confirmDeleteBtn");
    confirmDeleteBtn && confirmDeleteBtn.addEventListener("click", async () => {
      if (!activeRoadmap) return;
      confirmDeleteBtn.disabled = true;
      const deletedTitle = activeRoadmap.title || activeRoadmap.goal_text || "Roadmap";
      try {
        await window.TasklyAPI.deleteRoadmap(activeRoadmap.id);
        if (window.TasklyAPI && typeof window.TasklyAPI.addNotification === "function") {
          window.TasklyAPI.addNotification({
            message: `Deleted roadmap "${deletedTitle}"`,
            type: "system"
          });
        }
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

  /* ---------- Create New Roadmap Modal (POST /roadmaps) ---------- */

  function wireAddRoadmapModal() {
    const openBtn = $("#addRoadmapBtn");
    const textarea = $("#modalGoalInput");
    const charCount = $("#modalCharCount");
    const generateBtn = $("#generateRoadmapBtn");
    const formView = $("#addRoadmapFormView");
    const genState = $("#generationState");
    const modalTitle = $("#addRoadmapModalTitle");
    const modalSub = $("#addRoadmapModalSub");

    function openForRoadmap() {
      if (modalTitle) modalTitle.textContent = "Start a new roadmap";
      if (modalSub) modalSub.textContent = "Type any goal, from a skill to an errand. Taskly will figure out whether it needs a step-by-step path or a simple checklist.";
      if (textarea) textarea.placeholder = "e.g. Learn Rust, plan a wedding, buy groceries for the week…";
      openModal("addRoadmapOverlay");
      if (formView) formView.classList.remove("is-hidden");
      if (genState) genState.classList.remove("is-active");
      setTimeout(() => textarea && textarea.focus(), 250);
    }

    if (openBtn) openBtn.addEventListener("click", openForRoadmap);

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

        if (window.TasklyAPI && window.TasklyAPI.isGeneratingRoadmap && window.TasklyAPI.isGeneratingRoadmap()) {
          showToast("A roadmap is currently being generated. Please wait for it to finish before creating another.", "error");
          return;
        }

        generateBtn.disabled = true;
        if (formView) formView.classList.add("is-hidden");
        if (genState) genState.classList.add("is-active");

        try {
          const res = await window.TasklyAPI.createRoadmap({ goal_text: text, type: "sequential" });
          const newId = (res && (res.id || (res.roadmap && res.roadmap.id))) || res;

          if (!newId) throw new Error("Could not retrieve roadmap ID from server");

          if (window.TasklyAPI && typeof window.TasklyAPI.addNotification === "function") {
            window.TasklyAPI.addNotification({
              message: `Created new roadmap: "${text}"`,
              type: "roadmap",
              roadmap_id: newId
            });
          }

          closeModal("addRoadmapOverlay");
          window.location.href = `roadmap.html?id=${encodeURIComponent(newId)}`;

        } catch (err) {
          console.error("Roadmap creation failed:", err);
          showToast(window.TasklyAPI ? window.TasklyAPI.sanitizeError(err) : "Failed to create roadmap", "error");
          if (formView) formView.classList.remove("is-hidden");
          if (genState) genState.classList.remove("is-active");
          generateBtn.disabled = false;
        }
      });
    }
  }

  /* ---------- Create Manual Checklist Modal (type: "flat") ---------- */

  function wireCreateChecklistModal() {
    const checklistBtn = $("#createChecklistBtn");
    const checklistInput = $("#checklistNameInput");
    const checklistSaveBtn = $("#createChecklistSaveBtn");

    if (checklistBtn) {
      checklistBtn.addEventListener("click", () => {
        if (checklistInput) checklistInput.value = "";
        if (checklistSaveBtn) checklistSaveBtn.disabled = true;
        openModal("createChecklistOverlay");
        setTimeout(() => checklistInput && checklistInput.focus(), 250);
      });
    }

    if (checklistInput && checklistSaveBtn) {
      checklistInput.addEventListener("input", () => {
        checklistSaveBtn.disabled = !checklistInput.value.trim();
      });

      checklistInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !checklistSaveBtn.disabled) {
          e.preventDefault();
          checklistSaveBtn.click();
        }
      });
    }

    if (checklistSaveBtn) {
      checklistSaveBtn.addEventListener("click", async () => {
        const name = (checklistInput ? checklistInput.value : "").trim();
        if (!name) return;

        checklistSaveBtn.disabled = true;
        try {
          const res = await window.TasklyAPI.createRoadmap({ goal_text: name, type: "flat" });
          const newId = (res && (res.id || (res.roadmap && res.roadmap.id))) || res;

          if (!newId) throw new Error("Could not create checklist");

          if (window.TasklyAPI && typeof window.TasklyAPI.addNotification === "function") {
            window.TasklyAPI.addNotification({
              message: `Created new checklist: "${name}"`,
              type: "roadmap",
              roadmap_id: newId
            });
          }

          closeModal("createChecklistOverlay");
          window.location.href = `roadmap.html?id=${encodeURIComponent(newId)}`;
        } catch (err) {
          console.error("Checklist creation failed:", err);
          showToast(window.TasklyAPI ? window.TasklyAPI.sanitizeError(err) : "Failed to create checklist", "error");
          checklistSaveBtn.disabled = false;
        }
      });
    }
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
      wireFilterChips();
      wireAddRoadmapModal();
      wireCreateChecklistModal();
      wireRoadmapOptionsMenu();

      fetchUserRoadmaps();
      loadStreak();
      loadNotifications();

      window.addEventListener("focus", () => fetchUserRoadmaps());
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) fetchUserRoadmaps();
      });
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", run);
    } else {
      run();
    }
  }

  return { init, fetchUserRoadmaps };
})();

if (typeof window !== "undefined" && window.TasklyManager) {
  window.TasklyManager.init();
}
