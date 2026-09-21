/* ==========================================================
   TASKLY — roadmap.js
   Dynamic Graph Roadmap Engine with Real Backend Integration
   ========================================================== */

window.TasklyRoadmap = (function () {

  let roadmap = null;
  let roadmapId = null;
  let pollIntervalId = null;
  let currentNodeId = null;
  let editingNodeId = null;

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
    if (typeof document !== "undefined" && typeof document.createElement === "function") {
      const d = document.createElement("div");
      d.textContent = str || "";
      return d.innerHTML;
    }
    return String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* ---------- generic modal plumbing ---------- */

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

  /* ---------- shared shell: drawer, streak, notifications ---------- */

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
    if (dot) dot.style.display = unread.length > 0 ? "block" : "none";

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
        if (rmId && rmId !== roadmapId) {
          panel.classList.remove("is-open");
          window.location.href = `roadmap.html?id=${encodeURIComponent(rmId)}`;
        }
      });
    });
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

  /* ==========================================================
     STATE & NODE HELPERS
     ========================================================== */

  function getNodeMap() {
    const map = {};
    if (!roadmap || !Array.isArray(roadmap.nodes)) return map;
    roadmap.nodes.forEach(n => {
      map[String(n.id)] = n;
    });
    return map;
  }

  function getNodeState(node, nodeMap) {
    return window.TasklyAPI.computeNodeState(node, nodeMap);
  }

  function getDependencyNames(node, nodeMap) {
    const deps = Array.isArray(node.depends_on) ? node.depends_on : [];
    if (deps.length === 0) return [];
    return deps.map(depId => {
      const parent = nodeMap[String(depId)];
      return parent ? (parent.name || parent.title || `Task #${depId}`) : `Task #${depId}`;
    });
  }

  function computeProgress() {
    if (!roadmap) return 0;
    const nodes = Array.isArray(roadmap.nodes) ? roadmap.nodes : [];
    if (nodes.length === 0) {
      if (typeof roadmap.progress_percentage === "number") {
        return Math.round(roadmap.progress_percentage);
      }
      return 0;
    }
    const completed = nodes.filter(n => n.completed).length;
    return Math.round((completed / nodes.length) * 100);
  }

  function findNodeById(id) {
    if (!roadmap || !Array.isArray(roadmap.nodes)) return null;
    return roadmap.nodes.find(n => String(n.id) === String(id)) || null;
  }

  /* ==========================================================
     FETCHING & STATUS POLLING
     ========================================================== */

  async function loadRoadmap(id) {
    roadmapId = id;
    if (!roadmapId) {
      renderNoIdState();
      return;
    }

    renderLoadingState("Loading roadmap…");

    try {
      const data = await window.TasklyAPI.getRoadmap(roadmapId);
      roadmap = (data && (data.roadmap || data.data)) ? (data.roadmap || data.data) : data;

      if (!roadmap || !roadmap.id) {
        renderErrorState("Roadmap not found. Please check the URL or return to Roadmap Manager.");
        return;
      }

      const status = (roadmap.status || "").toLowerCase();
      const hasNodes = Array.isArray(roadmap.nodes) && roadmap.nodes.length > 0;

      if (status === "done" || hasNodes) {
        stopPolling();
        render();
      } else if (status === "failed") {
        stopPolling();
        renderFailedState(roadmap.error_message);
      } else {
        // Status is pending, generating_phases, or generating_tasks
        renderWaitingState(status);
        startPolling();
      }
    } catch (err) {
      console.error("Failed to load roadmap:", err);
      renderErrorState("Could not load roadmap from the server. Please check your connection and try again.");
    }
  }

  let isPolling = false;

  function startPolling() {
    stopPolling();
    isPolling = true;

    const pollFn = async () => {
      if (!isPolling || !roadmapId) return;

      try {
        // Direct roadmap fetch gets both the updated status and nodes in a single fast request
        const data = await window.TasklyAPI.getRoadmap(roadmapId);
        const fresh = (data && (data.roadmap || data.data)) ? (data.roadmap || data.data) : data;

        if (fresh && fresh.id) {
          roadmap = fresh;
          const currentStatus = (fresh.status || "").toLowerCase();
          const hasNodes = Array.isArray(fresh.nodes) && fresh.nodes.length > 0;

          if (currentStatus === "done" || hasNodes) {
            stopPolling();
            if (window.TasklyAPI && window.TasklyAPI.clearActiveGeneration) {
              window.TasklyAPI.clearActiveGeneration(roadmapId);
            }
            if (window.TasklyAPI && typeof window.TasklyAPI.addNotification === "function") {
              window.TasklyAPI.addNotification({
                message: `"${fresh.title || roadmap.title || 'Roadmap'}" generation complete!`,
                type: "milestone",
                roadmap_id: roadmapId
              });
            }
            showToast("Roadmap generation complete!", "success");
            render();
            loadNotifications();
            return;
          } else if (currentStatus === "failed") {
            stopPolling();
            if (window.TasklyAPI && window.TasklyAPI.clearActiveGeneration) {
              window.TasklyAPI.clearActiveGeneration(roadmapId);
            }
            renderFailedState(fresh.error_message);
            return;
          } else if (currentStatus) {
            renderWaitingState(currentStatus);
          }
        }
      } catch (e) {
        console.warn("Polling generation status error:", e);
      }

      if (isPolling) {
        pollIntervalId = setTimeout(pollFn, 400);
      }
    };

    pollIntervalId = setTimeout(pollFn, 400);
  }

  function stopPolling() {
    isPolling = false;
    if (pollIntervalId) {
      clearTimeout(pollIntervalId);
      clearInterval(pollIntervalId);
      pollIntervalId = null;
    }
  }

  /* ==========================================================
     RENDERING
     ========================================================== */

  function renderHeader() {
    const titleEl = $("#roadmapTitle");
    const title = (roadmap && (roadmap.title || roadmap.goal_text)) || "Roadmap";
    if (titleEl) titleEl.textContent = title;

    const type = (roadmap && roadmap.type === "flat") ? "flat" : "sequential";
    const badge = $("#roadmapTypeBadge");
    const legend = $("#stateLegend");

    // Remove write up that says Milestone Graph / Checklist
    if (badge) badge.style.display = "none";
    if (legend) legend.style.display = type === "flat" ? "none" : "";

    const addBtn = $("#addTaskBtn");
    if (addBtn) addBtn.style.display = type === "flat" ? "none" : "";

    renderProgressRing();
  }

  function renderProgressRing() {
    const pct = computeProgress();
    const circumference = 150.8;
    const offset = circumference - (pct / 100) * circumference;
    const ringFill = $("#progressRingFill");
    const ringLabel = $("#progressRingLabel");
    if (ringFill) ringFill.style.strokeDashoffset = offset;
    if (ringLabel) ringLabel.textContent = pct + "%";
  }

  function iconForState(state) {
    if (state === "completed") return "#ic-check";
    if (state === "locked") return "#ic-lock";
    return "#ic-check";
  }

  function renderWaitingState(status) {
    renderHeader();
    const body = $("#roadmapBody");
    const addBtn = $("#addTaskBtn");
    if (addBtn) addBtn.style.display = "none";

    let message = "Generating your roadmap…";
    let submessage = "Analyzing your goal and building milestones.";
    if (status === "generating_phases") {
      message = "Generating roadmap phases…";
      submessage = "Structuring key learning milestones.";
    } else if (status === "generating_tasks") {
      message = "Generating detailed tasks…";
      submessage = "Mapping out dependencies and step-by-step actions.";
    } else if (status === "pending") {
      message = "Queued for generation…";
      submessage = "Your roadmap request has been received.";
    }

    const existingMsg = body ? body.querySelector(".generation-message") : null;
    const existingSub = body ? body.querySelector(".generation-submessage") : null;
    if (existingMsg && existingSub) {
      if (existingMsg.textContent !== message) existingMsg.textContent = message;
      if (existingSub.textContent !== submessage) existingSub.textContent = submessage;
      return;
    }

    if (body) {
      body.innerHTML = `
        <div class="generation-state is-active" style="background:var(--color-cream); border:1.5px solid var(--color-border); border-radius:var(--radius-md); padding:var(--sp-6) var(--sp-4); margin-top:var(--sp-4);">
          <div class="gen-ring"></div>
          <p class="generation-message">${escapeHtml(message)}</p>
          <p class="generation-submessage">${escapeHtml(submessage)}</p>
        </div>
      `;
    }
  }

  function renderFailedState(errMsg) {
    const body = $("#roadmapBody");
    const addBtn = $("#addTaskBtn");
    if (addBtn) addBtn.style.display = "none";

    const cleanMsg = window.TasklyAPI ? window.TasklyAPI.sanitizeError(errMsg) : "We were unable to complete generation for this roadmap. Please try again.";

    body.innerHTML = `
      <div class="empty-roadmaps is-visible" style="border-color:var(--color-error-tint); padding:var(--sp-6) var(--sp-4);">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="color:var(--color-error); width:36px; height:36px; margin:0 auto var(--sp-2);">
          <use href="#ic-warn"/>
        </svg>
        <strong style="color:var(--color-error); font-size:16px;">Roadmap generation failed</strong>
        <p style="margin-top:6px; margin-bottom:18px; line-height:1.5; color:var(--color-ink-soft); max-width:440px; margin-left:auto; margin-right:auto;">${escapeHtml(cleanMsg)}</p>
        <div style="display:flex; gap:12px; justify-content:center;">
          <button class="btn-solid" id="retryRegenBtn" type="button" style="display:inline-flex;">Retry Generation</button>
          <a href="roadmapmanager.html" class="btn-ghost" style="display:inline-flex; text-decoration:none;">Back to Manager</a>
        </div>
      </div>
    `;

    const retryBtn = $("#retryRegenBtn");
    if (retryBtn) {
      retryBtn.addEventListener("click", async () => {
        retryBtn.disabled = true;
        renderWaitingState("generating_tasks");
        try {
          await window.TasklyAPI.regenerateRoadmap(roadmapId);
          startPolling();
        } catch (err) {
          console.warn("Regenerate request failed:", err);
          renderFailedState(err);
        }
      });
    }
  }

  function renderLoadingState(msg) {
    const body = $("#roadmapBody");
    body.innerHTML = `
      <div class="generation-state is-active" style="padding:var(--sp-8) var(--sp-4);">
        <div class="gen-ring"></div>
        <p class="generation-message">${escapeHtml(msg || "Loading roadmap…")}</p>
      </div>
    `;
  }

  function renderErrorState(msg) {
    const body = $("#roadmapBody");
    const addBtn = $("#addTaskBtn");
    if (addBtn) addBtn.style.display = "none";

    body.innerHTML = `
      <div class="empty-roadmaps is-visible">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <use href="#ic-warn"/>
        </svg>
        <strong>Unable to load roadmap</strong>
        <p style="margin-top:6px; margin-bottom:16px;">${escapeHtml(msg)}</p>
        <a href="roadmapmanager.html" class="btn-solid" style="display:inline-flex; text-decoration:none;">Back to Roadmap Manager</a>
      </div>
    `;
  }

  function renderNoIdState() {
    const titleEl = $("#roadmapTitle");
    if (titleEl) titleEl.textContent = "Roadmap";
    const body = $("#roadmapBody");
    const addBtn = $("#addTaskBtn");
    if (addBtn) addBtn.style.display = "none";

    body.innerHTML = `
      <div class="empty-roadmaps is-visible">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <use href="#ic-route"/>
        </svg>
        <strong>No roadmap selected</strong>
        <p style="margin-top:6px; margin-bottom:16px;">Please choose a roadmap from the Roadmap Manager or Dashboard.</p>
        <a href="roadmapmanager.html" class="btn-solid" style="display:inline-flex; text-decoration:none;">Go to Roadmap Manager</a>
      </div>
    `;
  }

  function renderNodes() {
    const body = $("#roadmapBody");
    const nodes = Array.isArray(roadmap.nodes) ? roadmap.nodes : [];

    if (nodes.length === 0) {
      body.innerHTML = `
        <div class="empty-roadmaps is-visible">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><use href="#ic-list"/></svg>
          <strong>No tasks in this roadmap yet</strong>
          <p style="margin-top:4px;">Tap "Add a task" below to start building your steps.</p>
        </div>
      `;
      return;
    }

    const type = (roadmap.type === "flat") ? "flat" : "sequential";

    if (type === "flat") {
      // Manual Simple Checklist Mode: Tick boxes at the beginning
      const sorted = [...nodes].sort((a, b) => (a.order || 0) - (b.order || 0));
      let html = '<div class="checklist-container">';

      if (sorted.length === 0) {
        html += `
          <div class="empty-roadmaps is-visible" style="margin-bottom:12px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><use href="#ic-list"/></svg>
            <strong>Empty checklist</strong>
            <p style="margin-top:4px;">Add your first task below.</p>
          </div>
        `;
      } else {
        sorted.forEach((node) => {
          const isDone = Boolean(node.completed);
          const title = node.name || "Untitled task";
          const estimate = node.time_estimate || "";

          html += `
            <div class="checklist-row ${isDone ? 'is-completed' : ''}" data-node-id="${escapeHtml(String(node.id))}">
              <div class="checklist-tickbox" data-action="toggle-check" title="${isDone ? 'Mark uncompleted' : 'Mark completed'}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="20 6 9 17 4 12"></polyline></svg>
              </div>
              <div class="checklist-content" data-action="edit-node">
                <span class="checklist-item-title">${escapeHtml(title)}</span>
                ${node.description ? `<span class="checklist-item-desc">${escapeHtml(node.description)}</span>` : ''}
                ${estimate ? `<span class="checklist-item-meta"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><use href="#ic-clock-small"/></svg>${escapeHtml(estimate)}</span>` : ''}
              </div>
              <button class="checklist-del-btn" data-action="delete-node" title="Delete task" aria-label="Delete task">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
            </div>
          `;
        });
      }

      // Add task row for easy manual checklist item creation
      html += `
        <div class="checklist-add-box">
          <input type="text" class="checklist-add-input" id="checklistQuickInput" placeholder="Add a new checklist item and press Enter…" maxlength="200">
          <button type="button" class="checklist-add-btn" id="checklistQuickBtn">Add</button>
        </div>
      `;

      html += '</div>';
      body.innerHTML = html;
      wireChecklistEvents();
      return;
    }

    // Sequential Mode: Graph grouped by phase with computed locked/available/completed states
    const nodeMap = getNodeMap();
    const hasPhases = nodes.some(n => Boolean(n.phase));

    let groups = [];
    if (hasPhases) {
      const phaseMap = new Map();
      nodes.forEach(node => {
        const phaseName = (node.phase && node.phase.trim()) || "General Tasks";
        if (!phaseMap.has(phaseName)) phaseMap.set(phaseName, []);
        phaseMap.get(phaseName).push(node);
      });

      phaseMap.forEach((pNodes, label) => {
        pNodes.sort((a, b) => (a.order || 0) - (b.order || 0));
        groups.push({ label, nodes: pNodes });
      });
    } else {
      const sorted = [...nodes].sort((a, b) => (a.order || 0) - (b.order || 0));
      groups.push({ label: null, nodes: sorted });
    }

    let html = "";
    groups.forEach((group, gIdx) => {
      html += '<div class="phase-block">';
      if (group.label) {
        html += '<div class="phase-label"><span class="phase-index">' + (gIdx + 1) + '</span>' + escapeHtml(group.label) + '</div>';
      }
      html += '<div class="node-chain">';

      group.nodes.forEach((node) => {
        const state = getNodeState(node, nodeMap);
        const lineDone = node.completed ? "is-done" : "";
        const title = node.name || "Untitled task";
        const estimate = node.time_estimate || "—";
        const depNames = getDependencyNames(node, nodeMap);

        html += `<div class="node-item is-${state}" data-node-id="${escapeHtml(String(node.id))}">
          <div class="node-chain-line ${lineDone}"></div>
          <div class="node-icon-circle">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
              <use href="${iconForState(state)}"></use>
            </svg>
          </div>
          <div class="node-card" data-node-id="${escapeHtml(String(node.id))}">
            <p class="node-title">${escapeHtml(title)}</p>
            ${node.description ? `<p class="node-meta-item" style="margin-bottom:6px; color:var(--color-ink-soft); font-size:12.5px; line-height:1.4;">${escapeHtml(node.description)}</p>` : ''}
            <div class="node-meta-row">
              <span class="node-meta-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><use href="#ic-clock-small"></use></svg>
                ${escapeHtml(estimate)}
              </span>
              ${state === "locked" ? `<span class="locked-tag">Locked${depNames.length ? ' — complete ' + escapeHtml(depNames.join(", ")) + ' first' : ''}</span>` : ''}
              ${state === "available" ? '<span style="color:var(--color-orange-deep); font-weight:600; font-size:11px;">Available now</span>' : ''}
              ${state === "completed" ? '<span style="color:var(--color-success); font-weight:600; font-size:11px;">Completed</span>' : ''}
            </div>
          </div>
        </div>`;
      });

      html += '</div></div>';
    });

    body.innerHTML = html;
    wireNodeCards();
  }

  function render() {
    renderHeader();
    renderNodes();
    renderProgressRing();
  }

  /* ==========================================================
     CHECKLIST INTERACTIONS
     ========================================================== */

  function wireChecklistEvents() {
    // Checkbox and row clicks
    $all(".checklist-row").forEach((row) => {
      const nodeId = row.dataset.nodeId;
      const node = findNodeById(nodeId);
      if (!node) return;

      const tickbox = row.querySelector('[data-action="toggle-check"]');
      const content = row.querySelector('[data-action="edit-node"]');
      const delBtn = row.querySelector('[data-action="delete-node"]');

      const toggleDone = async () => {
        const isDone = Boolean(node.completed);
        node.completed = !isDone;
        render(); // Immediate instant re-render!

        try {
          if (isDone) {
            await window.TasklyAPI.uncompleteNode(roadmapId, node.id);
            if (window.TasklyAPI && typeof window.TasklyAPI.addNotification === "function") {
              window.TasklyAPI.addNotification({
                message: `Reopened task "${node.name || 'item'}"`,
                type: "action",
                roadmap_id: roadmapId
              });
            }
          } else {
            await window.TasklyAPI.completeNode(roadmapId, node.id);
            if (window.TasklyAPI && typeof window.TasklyAPI.addNotification === "function") {
              window.TasklyAPI.addNotification({
                message: `Completed "${node.name || 'item'}" in ${(roadmap && (roadmap.title || roadmap.goal_text)) || 'checklist'}`,
                type: "milestone",
                roadmap_id: roadmapId
              });
            }
          }
          if (window.StreakManager && typeof window.StreakManager.loadStreak === "function") {
            window.StreakManager.loadStreak();
          }
        } catch (err) {
          node.completed = isDone;
          render();
          showToast(err.message || "Failed to update status", "error");
        }
      };

      if (tickbox) tickbox.addEventListener("click", toggleDone);
      if (content) content.addEventListener("click", () => openNodeDetail(nodeId));

      if (delBtn) {
        delBtn.addEventListener("click", async (e) => {
          e.stopPropagation();
          try {
            await window.TasklyAPI.deleteNode(roadmapId, node.id);
            if (window.TasklyAPI && typeof window.TasklyAPI.addNotification === "function") {
              window.TasklyAPI.addNotification({
                message: `Deleted task "${node.name || 'item'}"`,
                type: "action",
                roadmap_id: roadmapId
              });
            }
            showToast("Item deleted.");
            const fresh = await window.TasklyAPI.getRoadmap(roadmapId);
            if (fresh) roadmap = (fresh.roadmap || fresh.data) || fresh;
            render();
          } catch (err) {
            showToast(err.message || "Failed to delete item", "error");
          }
        });
      }
    });

    // Quick add input
    const addInput = document.getElementById("checklistQuickInput");
    const addBtn = document.getElementById("checklistQuickBtn");

    const submitQuickAdd = async () => {
      if (!addInput || !roadmapId) return;
      const name = addInput.value.trim();
      if (!name) return;

      try {
        const nodes = Array.isArray(roadmap.nodes) ? roadmap.nodes : [];
        const nextOrder = nodes.length > 0 ? Math.max(...nodes.map(n => n.order || 0)) + 1 : 1;
        
        await window.TasklyAPI.createNode(roadmapId, {
          name: name,
          order: nextOrder,
          time_estimate: "15 min"
        });

        if (window.TasklyAPI && typeof window.TasklyAPI.addNotification === "function") {
          window.TasklyAPI.addNotification({
            message: `Added task "${name}" to ${(roadmap && (roadmap.title || roadmap.goal_text)) || 'checklist'}`,
            type: "action",
            roadmap_id: roadmapId
          });
        }

        addInput.value = "";
        showToast("Item added!", "success");

        const fresh = await window.TasklyAPI.getRoadmap(roadmapId);
        if (fresh) roadmap = (fresh.roadmap || fresh.data) || fresh;
        render();
      } catch (err) {
        showToast(err.message || "Failed to add item", "error");
      }
    };

    if (addBtn) addBtn.addEventListener("click", submitQuickAdd);
    if (addInput) {
      addInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          submitQuickAdd();
        }
      });
    }
  }

  /* ==========================================================
     NODE INTERACTIONS & COMPLETION API
     ========================================================== */

  function wireNodeCards() {
    $all(".node-item").forEach((item) => {
      const nodeId = item.dataset.nodeId;
      const node = findNodeById(nodeId);
      if (!node) return;

      const circle = item.querySelector(".node-icon-circle");
      const card = item.querySelector(".node-card");

      // Clicking circle icon directly toggles complete for available tasks
      if (circle) {
        circle.style.cursor = "pointer";
        circle.addEventListener("click", async (e) => {
          e.stopPropagation();
          const nodeMap = getNodeMap();
          const state = getNodeState(node, nodeMap);

          if (state === "locked") {
            const depNames = getDependencyNames(node, nodeMap);
            const reqText = depNames.length ? `Complete "${depNames.join(', ')}" first.` : "Finish prerequisite tasks first to unlock this milestone.";
            showToast(reqText, "error");
            return;
          }

          const isCompleted = Boolean(node.completed);
          node.completed = !isCompleted;
          render();

          try {
            if (isCompleted) {
              await window.TasklyAPI.uncompleteNode(roadmapId, node.id);
              if (window.TasklyAPI && typeof window.TasklyAPI.addNotification === "function") {
                window.TasklyAPI.addNotification({
                  message: `Reopened milestone "${node.name || 'task'}"`,
                  type: "action",
                  roadmap_id: roadmapId
                });
              }
            } else {
              await window.TasklyAPI.completeNode(roadmapId, node.id);
              if (window.TasklyAPI && typeof window.TasklyAPI.addNotification === "function") {
                window.TasklyAPI.addNotification({
                  message: `Completed milestone "${node.name || 'task'}" in ${(roadmap && (roadmap.title || roadmap.goal_text)) || 'roadmap'}`,
                  type: "milestone",
                  roadmap_id: roadmapId
                });
              }
              showToast("Nice work! Task complete.", "success");
            }
            if (window.StreakManager && typeof window.StreakManager.loadStreak === "function") {
              window.StreakManager.loadStreak();
            }
          } catch (err) {
            node.completed = isCompleted;
            render();
            showToast(err.message || "Failed to update task status", "error");
          }
        });
      }

      const openDetailHandler = (e) => {
        const type = (roadmap && roadmap.type === "flat") ? "flat" : "sequential";

        if (type !== "flat") {
          const nodeMap = getNodeMap();
          const state = getNodeState(node, nodeMap);

          if (state === "locked") {
            const depNames = getDependencyNames(node, nodeMap);
            const reqText = depNames.length ? `Complete "${depNames.join(', ')}" first.` : "Finish prerequisite tasks first to unlock this milestone.";
            showToast(reqText, "error");
            return;
          }
        }

        openNodeDetail(nodeId);
      };

      if (card) {
        card.addEventListener("click", openDetailHandler);
      } else {
        item.addEventListener("click", openDetailHandler);
      }
    });
  }

  function openNodeDetail(id) {
    const node = findNodeById(id);
    if (!node) return;
    currentNodeId = id;

    const title = node.name || "Task";
    const desc = node.description || "No description provided.";
    const estimate = node.time_estimate || "—";

    $("#nodeDetailTitle").textContent = title;
    $("#nodeDetailDesc").textContent = desc;
    $("#nodeDetailEstimate").textContent = estimate;

    const toggle = $("#nodeCompleteToggle");
    const label = $("#nodeCompleteToggleLabel");
    toggle.classList.toggle("is-complete", Boolean(node.completed));
    label.textContent = node.completed ? "Completed — tap to undo" : "Mark as complete";

    openModal("nodeDetailOverlay");
  }

  function wireNodeDetailModal() {
    const completeBtn = $("#nodeCompleteToggle");
    if (!completeBtn) return;

    completeBtn.addEventListener("click", async () => {
      const node = findNodeById(currentNodeId);
      if (!node || !roadmapId) return;

      const isCompleted = Boolean(node.completed);
      node.completed = !isCompleted;
      closeModal("nodeDetailOverlay");
      render();

      try {
        if (isCompleted) {
          await window.TasklyAPI.uncompleteNode(roadmapId, node.id);
          if (window.TasklyAPI && typeof window.TasklyAPI.addNotification === "function") {
            window.TasklyAPI.addNotification({
              message: `Reopened task "${node.name || 'item'}"`,
              type: "action",
              roadmap_id: roadmapId
            });
          }
          showToast("Marked incomplete.");
        } else {
          await window.TasklyAPI.completeNode(roadmapId, node.id);
          if (window.TasklyAPI && typeof window.TasklyAPI.addNotification === "function") {
            window.TasklyAPI.addNotification({
              message: `Completed milestone "${node.name || 'item'}" in ${(roadmap && (roadmap.title || roadmap.goal_text)) || 'roadmap'}`,
              type: "milestone",
              roadmap_id: roadmapId
            });
          }
          showToast("Nice work! Task complete.", "success");
        }
        await loadStreak();
      } catch (err) {
        node.completed = isCompleted;
        render();
        showToast(err.message || "Failed to update task status", "error");
      }
    });

    $("#nodeEditBtn").addEventListener("click", () => {
      closeModal("nodeDetailOverlay");
      openTaskForm(currentNodeId);
    });

    $("#nodeDeleteBtn").addEventListener("click", () => {
      closeModal("nodeDetailOverlay");
      const node = findNodeById(currentNodeId);
      if (node) $("#deleteTaskTitle").textContent = node.name || "this task";
      openModal("deleteTaskOverlay");
    });

    $("#confirmDeleteTaskBtn").addEventListener("click", async () => {
      if (!currentNodeId || !roadmapId) return;
      const delBtn = $("#confirmDeleteTaskBtn");
      delBtn.disabled = true;

      try {
        const node = findNodeById(currentNodeId);
        const nodeName = (node && node.name) || "task";
        await window.TasklyAPI.deleteNode(roadmapId, currentNodeId);
        if (window.TasklyAPI && typeof window.TasklyAPI.addNotification === "function") {
          window.TasklyAPI.addNotification({
            message: `Deleted task "${nodeName}"`,
            type: "action",
            roadmap_id: roadmapId
          });
        }
        showToast("Task deleted.");
        closeModal("deleteTaskOverlay");

        // Refetch full roadmap
        const fresh = await window.TasklyAPI.getRoadmap(roadmapId);
        if (fresh) roadmap = (fresh.roadmap || fresh.data) || fresh;

        render();
      } catch (err) {
        console.error("Failed to delete node:", err);
        if (err.status === 409) {
          showToast("Cannot delete: another task depends on this one.", "error");
        } else {
          showToast(err.message || "Failed to delete task", "error");
        }
      } finally {
        delBtn.disabled = false;
      }
    });
  }

  /* ==========================================================
     ADD / EDIT TASK FORM & DIRECT API CRUD
     ========================================================== */

  function populateDependencySelect(excludeId, selectedDepId) {
    const select = $("#taskPositionSelect");
    if (!select) return;

    const nodes = (roadmap && Array.isArray(roadmap.nodes)) ? roadmap.nodes : [];
    const availableParents = nodes.filter(n => String(n.id) !== String(excludeId));

    let html = '<option value="">None (Available from start)</option>';
    availableParents.forEach((n) => {
      const title = n.name || `Task #${n.id}`;
      html += `<option value="${escapeHtml(String(n.id))}">${escapeHtml(title)}</option>`;
    });
    select.innerHTML = html;

    if (selectedDepId) {
      select.value = String(selectedDepId);
    } else {
      select.value = "";
    }
  }

  function openTaskForm(nodeId) {
    editingNodeId = nodeId || null;
    const heading = $("#taskFormHeading");
    const nameInput = $("#taskNameInput");
    const descInput = $("#taskDescInput");
    const estInput = $("#taskEstimateInput");
    const phaseInput = $("#taskPhaseInput");

    if (nodeId) {
      const node = findNodeById(nodeId);
      heading.textContent = "Edit task";
      nameInput.value = (node && node.name) || "";
      descInput.value = (node && node.description) || "";
      estInput.value = (node && node.time_estimate) || "";
      if (phaseInput) phaseInput.value = (node && node.phase) || "";

      const primaryDep = (node && Array.isArray(node.depends_on) && node.depends_on.length > 0) ? node.depends_on[0] : null;
      populateDependencySelect(nodeId, primaryDep);
    } else {
      heading.textContent = "Add a task";
      nameInput.value = "";
      descInput.value = "";
      estInput.value = "";
      if (phaseInput) phaseInput.value = "";

      const nodes = (roadmap && Array.isArray(roadmap.nodes)) ? roadmap.nodes : [];
      const lastNode = nodes.length > 0 ? nodes[nodes.length - 1] : null;
      populateDependencySelect(null, lastNode ? lastNode.id : null);
    }

    openModal("taskFormOverlay");
    setTimeout(() => nameInput && nameInput.focus(), 200);
  }

  function wireTaskForm() {
    const addBtn = $("#addTaskBtn");
    if (addBtn) addBtn.addEventListener("click", () => openTaskForm(null));

    const saveBtn = $("#taskFormSaveBtn");
    if (!saveBtn) return;

    saveBtn.addEventListener("click", async () => {
      const name = ($("#taskNameInput").value || "").trim();
      if (!name) { $("#taskNameInput").focus(); return; }

      const description = ($("#taskDescInput").value || "").trim();
      const estimate = ($("#taskEstimateInput").value || "").trim();
      const phaseInput = $("#taskPhaseInput");
      const phase = phaseInput ? phaseInput.value.trim() : "";
      const dependsOnVal = $("#taskPositionSelect") ? $("#taskPositionSelect").value : "";
      const dependsOn = dependsOnVal ? [dependsOnVal] : [];

      saveBtn.disabled = true;

      try {
        if (editingNodeId) {
          // PATCH /roadmaps/{roadmap_id}/nodes/{node_id}
          await window.TasklyAPI.updateNode(roadmapId, editingNodeId, {
            name,
            phase: phase || null,
            description: description || null,
            time_estimate: estimate || null,
            depends_on: dependsOn
          });
          if (window.TasklyAPI && typeof window.TasklyAPI.addNotification === "function") {
            window.TasklyAPI.addNotification({
              message: `Updated task "${name}"`,
              type: "action",
              roadmap_id: roadmapId
            });
          }
          showToast("Task updated.", "success");
        } else {
          // POST /roadmaps/{roadmap_id}/nodes
          await window.TasklyAPI.createNode(roadmapId, {
            name,
            phase: phase || undefined,
            description: description || undefined,
            time_estimate: estimate || undefined,
            depends_on: dependsOn
          });
          if (window.TasklyAPI && typeof window.TasklyAPI.addNotification === "function") {
            window.TasklyAPI.addNotification({
              message: `Added task "${name}" to ${(roadmap && (roadmap.title || roadmap.goal_text)) || 'roadmap'}`,
              type: "action",
              roadmap_id: roadmapId
            });
          }
          showToast("Task added.", "success");
        }

        closeModal("taskFormOverlay");

        // Refetch full roadmap to sync server truth
        const fresh = await window.TasklyAPI.getRoadmap(roadmapId);
        if (fresh) roadmap = (fresh.roadmap || fresh.data) || fresh;

        render();
      } catch (err) {
        console.error("Failed to save task:", err);
        showToast(err.message || "Failed to save task", "error");
      } finally {
        saveBtn.disabled = false;
      }
    });
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

  /* ==========================================================
     ROADMAP-LEVEL OPTIONS (Rename / Regenerate / Delete)
     ========================================================== */

  function openRoadmapMenu() {
    const title = (roadmap && (roadmap.title || roadmap.goal_text)) || "Roadmap";
    const status = (roadmap && roadmap.status ? roadmap.status : "done").toLowerCase();
    const progress = computeProgress();

    const titleEl = $("#optionsRoadmapTitle");
    if (titleEl) titleEl.textContent = title;

    const metaEl = $("#optionsRoadmapMeta");
    if (metaEl) metaEl.textContent = status === "done" ? `${progress}% completed` : status;

    const iconUse = $("#optionsRoadmapIconUse");
    if (iconUse) {
      iconUse.setAttribute("href", "#" + getIconForTitle(title));
    }

    const optionsView = $("#roadmapOptionsView");
    const confirmView = $("#deleteConfirmView");
    if (optionsView) optionsView.style.display = "block";
    if (confirmView) confirmView.style.display = "none";

    openModal("roadmapMenuOverlay");
  }

  function wireRoadmapMenu() {
    const menuBtn = $("#roadmapMenuBtn");
    if (menuBtn) {
      menuBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        openRoadmapMenu();
      });
    }

    const renameBtn = $("#renameRoadmapBtn");
    const customRenameInput = $("#customRenameInput");
    const customRenameSaveBtn = $("#customRenameSaveBtn");

    renameBtn && renameBtn.addEventListener("click", () => {
      closeModal("roadmapMenuOverlay");
      const current = (roadmap && (roadmap.title || roadmap.goal_text)) || "";
      if (customRenameInput) customRenameInput.value = current;
      openModal("renameRoadmapModal");
      setTimeout(() => customRenameInput && customRenameInput.focus(), 50);
    });

    const submitCustomRename = async () => {
      if (!customRenameInput || !roadmapId) return;
      const trimmed = customRenameInput.value.trim();
      if (!trimmed) return;

      closeModal("renameRoadmapModal");
      try {
        await window.TasklyAPI.updateRoadmap(roadmapId, { title: trimmed });
        if (roadmap) roadmap.title = trimmed;
        if (window.TasklyAPI && typeof window.TasklyAPI.addNotification === "function") {
          window.TasklyAPI.addNotification({
            message: `Renamed roadmap to "${trimmed}"`,
            type: "roadmap",
            roadmap_id: roadmapId
          });
        }
        renderHeader();
        showToast("Roadmap renamed.", "success");
      } catch (err) {
        showToast(err.message || "Could not rename roadmap", "error");
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

    const regenBtn = $("#regenerateRoadmapBtn");
    if (regenBtn) {
      regenBtn.addEventListener("click", async () => {
        const title = (roadmap && (roadmap.title || roadmap.goal_text)) || "Roadmap";
        closeModal("roadmapMenuOverlay");
        try {
          await window.TasklyAPI.regenerateRoadmap(roadmapId);
          if (window.TasklyAPI && typeof window.TasklyAPI.addNotification === "function") {
            window.TasklyAPI.addNotification({
              message: `Regeneration started for "${title}"`,
              type: "roadmap",
              roadmap_id: roadmapId
            });
          }
          showToast("Roadmap regeneration started.", "success");
          await loadRoadmap(roadmapId);
        } catch (err) {
          showToast(err.message || "Could not regenerate roadmap", "error");
        }
      });
    }

    const optionsView = $("#roadmapOptionsView");
    const confirmView = $("#deleteConfirmView");
    const deleteBtn = $("#deleteRoadmapBtn");
    const cancelDeleteBtn = $("#cancelDeleteRoadmapBtn");
    const confirmDeleteBtn = $("#confirmDeleteRoadmapBtn");

    deleteBtn && deleteBtn.addEventListener("click", () => {
      const title = (roadmap && (roadmap.title || roadmap.goal_text)) || "this roadmap";
      const delTitle = $("#deleteConfirmTitle");
      if (delTitle) delTitle.textContent = title;
      if (optionsView) optionsView.style.display = "none";
      if (confirmView) confirmView.style.display = "block";
    });

    cancelDeleteBtn && cancelDeleteBtn.addEventListener("click", () => {
      if (optionsView) optionsView.style.display = "block";
      if (confirmView) confirmView.style.display = "none";
    });

    confirmDeleteBtn && confirmDeleteBtn.addEventListener("click", async () => {
      confirmDeleteBtn.disabled = true;
      const deletedTitle = (roadmap && (roadmap.title || roadmap.goal_text)) || "Roadmap";
      try {
        await window.TasklyAPI.deleteRoadmap(roadmapId);
        if (window.TasklyAPI && typeof window.TasklyAPI.addNotification === "function") {
          window.TasklyAPI.addNotification({
            message: `Deleted roadmap "${deletedTitle}"`,
            type: "system"
          });
        }
        closeModal("roadmapMenuOverlay");
        showToast("Roadmap deleted. Returning to Dashboard…");
        setTimeout(() => { window.location.href = "dashboard.html"; }, 600);
      } catch (err) {
        showToast(err.message || "Failed to delete roadmap", "error");
      } finally {
        confirmDeleteBtn.disabled = false;
      }
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

  /* ==========================================================
     INIT
     ========================================================== */

  async function init() {
    const run = async () => {
      const search = (typeof window !== "undefined" && window.location && window.location.search) ? window.location.search : "";
      const params = new URLSearchParams(search);
      const id = params.get("id");

      wireGenericModalClosers();
      wireDrawer();
      wireStreakPopup();
      wireNotifications();
      wireSidebarLogout();
      wireNodeDetailModal();
      wireTaskForm();
      wireRoadmapMenu();

      // Start loading roadmap immediately without delay
      if (id) {
        loadRoadmap(id);
      } else {
        renderNoIdState();
      }

      // Load streak and notifications in parallel background
      loadStreak();
      loadNotifications();
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", run);
    } else {
      run();
    }
  }

  return {
    init,
    loadRoadmap,
    getRoadmapData: () => roadmap
  };
})();

if (typeof window !== "undefined" && window.TasklyRoadmap) {
  window.TasklyRoadmap.init();
}
