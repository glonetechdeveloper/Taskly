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
    if (typeof roadmap.progress_percentage === "number") {
      return Math.round(roadmap.progress_percentage);
    }
    const nodes = Array.isArray(roadmap.nodes) ? roadmap.nodes : [];
    if (nodes.length === 0) return 0;
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

      if (status === "done") {
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

  function startPolling() {
    stopPolling();
    pollIntervalId = setInterval(async () => {
      try {
        const statusData = await window.TasklyAPI.getGenerationStatus(roadmapId);
        const currentStatus = (statusData && (statusData.status || (statusData.roadmap && statusData.roadmap.status) || "")).toLowerCase();

        if (currentStatus === "done") {
          stopPolling();
          showToast("Roadmap generation complete!", "success");
          // Fetch full roadmap with generated nodes
          const freshData = await window.TasklyAPI.getRoadmap(roadmapId);
          roadmap = (freshData && (freshData.roadmap || freshData.data)) || freshData;
          render();
          await loadNotifications();
        } else if (currentStatus === "failed") {
          stopPolling();
          renderFailedState(statusData && statusData.error_message);
        } else if (currentStatus) {
          roadmap.status = currentStatus;
          renderWaitingState(currentStatus);
        }
      } catch (e) {
        console.warn("Polling generation status error:", e);
      }
    }, 2500);
  }

  function stopPolling() {
    if (pollIntervalId) {
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
    const label = $("#roadmapTypeLabel");
    const icon = $("#roadmapTypeIcon");
    const legend = $("#stateLegend");

    if (type === "flat") {
      if (badge) badge.classList.add("is-flat");
      if (label) label.textContent = "Checklist";
      if (icon && typeof icon.setAttribute === "function") icon.setAttribute("href", "#ic-list");
      if (legend) legend.style.display = "none";
    } else {
      if (badge) badge.classList.remove("is-flat");
      if (label) label.textContent = "Milestone Graph";
      if (icon && typeof icon.setAttribute === "function") icon.setAttribute("href", "#ic-layers");
      if (legend) legend.style.display = "";
    }

    const addBtn = $("#addTaskBtn");
    if (addBtn) addBtn.style.display = "";

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

    body.innerHTML = `
      <div class="generation-state is-active" style="background:var(--color-cream); border:1.5px solid var(--color-border); border-radius:var(--radius-md); padding:var(--sp-6) var(--sp-4); margin-top:var(--sp-4);">
        <div class="gen-ring"></div>
        <p class="generation-message">${escapeHtml(message)}</p>
        <p class="generation-submessage">${escapeHtml(submessage)}</p>
      </div>
    `;
  }

  function renderFailedState(errMsg) {
    const body = $("#roadmapBody");
    const addBtn = $("#addTaskBtn");
    if (addBtn) addBtn.style.display = "none";

    body.innerHTML = `
      <div class="empty-roadmaps is-visible" style="border-color:var(--color-error-tint);">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="color:var(--color-error);">
          <use href="#ic-warn"/>
        </svg>
        <strong style="color:var(--color-error);">Roadmap generation failed</strong>
        <p style="margin-top:6px; margin-bottom:16px;">${escapeHtml(errMsg || "We were unable to complete generation for this roadmap.")}</p>
        <div style="display:flex; gap:12px; justify-content:center;">
          <button class="btn-solid" id="retryRegenBtn" type="button" style="display:inline-flex;">Retry Generation</button>
          <a href="roadmapmanager.html" class="btn-ghost" style="display:inline-flex; text-decoration:none;">Back to Manager</a>
        </div>
      </div>
    `;

    const retryBtn = $("#retryRegenBtn");
    if (retryBtn) {
      retryBtn.addEventListener("click", async () => {
        try {
          await window.TasklyAPI.regenerateRoadmap(roadmapId);
          showToast("Retrying roadmap generation…", "success");
          await loadRoadmap(roadmapId);
        } catch (err) {
          showToast(err.message || "Failed to regenerate", "error");
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
      // Flat / Checklist Mode: Sorted by order, no phase grouping, no lock states
      const sorted = [...nodes].sort((a, b) => (a.order || 0) - (b.order || 0));
      let html = '<div class="phase-block"><div class="node-chain">';

      sorted.forEach((node) => {
        const state = node.completed ? "completed" : "available";
        const lineDone = node.completed ? "is-done" : "";
        const title = node.name || "Untitled task";
        const estimate = node.time_estimate || "—";

        html += `<div class="node-item is-${state}" data-node-id="${escapeHtml(String(node.id))}">
          <div class="node-chain-line ${lineDone}"></div>
          <div class="node-icon-circle">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
              <use href="#ic-check"></use>
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
              ${node.completed ? '<span style="color:var(--color-success); font-weight:600; font-size:11px;">Completed</span>' : '<span style="color:var(--color-ink-soft); font-weight:600; font-size:11px;">To Do</span>'}
            </div>
          </div>
        </div>`;
      });

      html += '</div></div>';
      body.innerHTML = html;
      wireNodeCards();
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
     NODE INTERACTIONS & COMPLETION API
     ========================================================== */

  function wireNodeCards() {
    $all(".node-item").forEach((item) => {
      item.addEventListener("click", () => {
        const nodeId = item.dataset.nodeId;
        const node = findNodeById(nodeId);
        if (!node) return;

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
      });
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
      completeBtn.disabled = true;

      try {
        if (isCompleted) {
          await window.TasklyAPI.uncompleteNode(roadmapId, node.id);
          node.completed = false;
          showToast("Marked incomplete.");
        } else {
          await window.TasklyAPI.completeNode(roadmapId, node.id);
          node.completed = true;
          showToast("Nice work! Task complete.", "success");
        }

        closeModal("nodeDetailOverlay");

        // Sync with live backend progress
        try {
          const freshData = await window.TasklyAPI.getRoadmap(roadmapId);
          if (freshData) roadmap = (freshData.roadmap || freshData.data) || freshData;
          await loadStreak();
          await loadNotifications();
        } catch (e) {}

        render();
      } catch (err) {
        console.error("Failed to toggle completion:", err);
        showToast(err.message || "Failed to update task status", "error");
      } finally {
        completeBtn.disabled = false;
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
        await window.TasklyAPI.deleteNode(roadmapId, currentNodeId);
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
      const estimate = ($("#taskEstimateInput").value || "").trim() || "15m";
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
            description,
            time_estimate: estimate,
            depends_on: dependsOn
          });
          showToast("Task updated.", "success");
        } else {
          // POST /roadmaps/{roadmap_id}/nodes
          await window.TasklyAPI.createNode(roadmapId, {
            name,
            description,
            time_estimate: estimate,
            depends_on: dependsOn
          });
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

  /* ==========================================================
     ROADMAP-LEVEL OPTIONS (Rename / Regenerate / Delete)
     ========================================================== */

  function wireRoadmapMenu() {
    const menuBtn = $("#roadmapMenuBtn");
    if (menuBtn) menuBtn.addEventListener("click", () => openModal("roadmapMenuOverlay"));

    const renameBtn = $("#renameRoadmapBtn");
    renameBtn && renameBtn.addEventListener("click", async () => {
      const current = (roadmap && (roadmap.title || roadmap.goal_text)) || "";
      const next = window.prompt("Rename roadmap", current);
      if (next && next.trim()) {
        const trimmed = next.trim();
        closeModal("roadmapMenuOverlay");
        try {
          await window.TasklyAPI.updateRoadmap(roadmapId, { title: trimmed });
          if (roadmap) roadmap.title = trimmed;
          renderHeader();
          showToast("Roadmap renamed.", "success");
        } catch (err) {
          showToast(err.message || "Could not rename roadmap", "error");
        }
      } else {
        closeModal("roadmapMenuOverlay");
      }
    });

    const regenBtn = $("#regenerateRoadmapBtn");
    if (regenBtn) {
      regenBtn.addEventListener("click", async () => {
        closeModal("roadmapMenuOverlay");
        if (window.confirm("Regenerate roadmap? This will clear current tasks and re-generate milestones.")) {
          try {
            await window.TasklyAPI.regenerateRoadmap(roadmapId);
            showToast("Roadmap regeneration started.", "success");
            await loadRoadmap(roadmapId);
          } catch (err) {
            showToast(err.message || "Could not regenerate roadmap", "error");
          }
        }
      });
    }

    const deleteBtn = $("#deleteRoadmapBtn");
    deleteBtn && deleteBtn.addEventListener("click", async () => {
      closeModal("roadmapMenuOverlay");
      const title = (roadmap && (roadmap.title || roadmap.goal_text)) || "this roadmap";
      if (window.confirm(`Delete "${title}"? This cannot be undone.`)) {
        try {
          await window.TasklyAPI.deleteRoadmap(roadmapId);
          showToast("Roadmap deleted. Returning to Roadmap Manager…");
          setTimeout(() => { window.location.href = "roadmapmanager.html"; }, 700);
        } catch (err) {
          showToast(err.message || "Failed to delete roadmap", "error");
        }
      }
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
      wireNodiModal();
      wireSidebarLogout();
      wireNodeDetailModal();
      wireTaskForm();
      wireRoadmapMenu();

      await Promise.all([
        loadStreak(),
        loadNotifications()
      ]);

      if (id) {
        await loadRoadmap(id);
      } else {
        renderNoIdState();
      }
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
