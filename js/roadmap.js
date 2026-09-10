/* ==========================================================
   TASKLY — roadmap.js
   Dynamic Graph Roadmap Engine with Real Backend Integration
   ========================================================== */
window.TasklyRoadmap = (function () {

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
      window.location.href = "notifications.html";
    });
  }

  /* ==========================================================
     API CLIENT HELPER ACCESS
     ========================================================== */

  async function apiGet(path) {
    if (window.apiFetch) {
      const res = await window.apiFetch(path);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    }
    const token = localStorage.getItem("access_token") || localStorage.getItem("taskly_access_token");
    const base = window.API_BASE || localStorage.getItem("TASKLY_API_BASE") || "";
    const res = await fetch(`${base}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...(token ? { "Authorization": `Bearer ${token}` } : {})
      }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  }

  async function apiSend(path, method = "POST", body = null) {
    const opts = { method };
    if (body) opts.body = JSON.stringify(body);

    if (window.apiFetch) {
      const res = await window.apiFetch(path, opts);
      let data = {};
      try { data = await res.json(); } catch (e) {}
      if (!res.ok) {
        throw new Error(data.detail || data.message || `Request failed (${res.status})`);
      }
      return data;
    }

    const token = localStorage.getItem("access_token") || localStorage.getItem("taskly_access_token");
    const base = window.API_BASE || localStorage.getItem("TASKLY_API_BASE") || "";
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${base}${path}`, {
      method,
      headers,
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    let data = {};
    try { data = await res.json(); } catch (e) {}
    if (!res.ok) {
      throw new Error(data.detail || data.message || `Request failed (${res.status})`);
    }
    return data;
  }

  /* ==========================================================
     STATE & DATA MANAGEMENT
     ========================================================== */

  let roadmap = null;
  let roadmapId = null;
  let pollIntervalId = null;

  function getNodeMap() {
    const map = {};
    if (!roadmap || !Array.isArray(roadmap.nodes)) return map;
    roadmap.nodes.forEach(n => {
      map[String(n.id)] = n;
    });
    return map;
  }

  function getNodeState(node, nodeMap) {
    if (node.completed) return "complete";

    const deps = Array.isArray(node.depends_on) ? node.depends_on : [];
    if (deps.length === 0) return "available";

    // Available if ALL dependencies are completed
    const allDepsMet = deps.every(depId => {
      const parent = nodeMap[String(depId)];
      return parent && Boolean(parent.completed);
    });

    return allDepsMet ? "available" : "locked";
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
    if (typeof roadmap.progress === "number") {
      return Math.round(roadmap.progress);
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
      let data = null;
      if (window.TasklyAPI && window.TasklyAPI.getRoadmapById) {
        data = await window.TasklyAPI.getRoadmapById(roadmapId);
      } else {
        data = await apiGet(`/roadmaps/${roadmapId}`);
      }

      roadmap = (data && (data.roadmap || data.data)) ? (data.roadmap || data.data) : data;

      if (!roadmap || !roadmap.id) {
        renderErrorState("Roadmap not found. Please check the URL or return to Roadmap Manager.");
        return;
      }

      // Check status: pending | generating_phases | generating_tasks | done | failed
      const status = (roadmap.status || "").toLowerCase();

      if (status === "done") {
        stopPolling();
        render();
      } else if (status === "failed") {
        stopPolling();
        renderFailedState();
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
        let statusData = null;
        if (window.TasklyAPI && window.TasklyAPI.getRoadmapGenerationStatus) {
          statusData = await window.TasklyAPI.getRoadmapGenerationStatus(roadmapId);
        } else {
          statusData = await apiGet(`/roadmaps/${roadmapId}/generation-status`);
        }

        const currentStatus = (statusData && (statusData.status || (statusData.roadmap && statusData.roadmap.status) || "")).toLowerCase();

        if (currentStatus === "done") {
          stopPolling();
          showToast("Roadmap is ready!", "success");
          await loadRoadmap(roadmapId);
        } else if (currentStatus === "failed") {
          stopPolling();
          renderFailedState();
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
    const title = (roadmap && (roadmap.title || roadmap.name || roadmap.goal_text)) || "Roadmap";
    if (titleEl) titleEl.textContent = title;

    const badge = $("#roadmapTypeBadge");
    const label = $("#roadmapTypeLabel");
    const icon = $("#roadmapTypeIcon");
    const legend = $("#stateLegend");

    if (badge) badge.classList.remove("is-flat");
    if (label) label.textContent = "Milestone Graph";
    if (icon && typeof icon.setAttribute === "function") icon.setAttribute("href", "#ic-layers");
    if (legend) legend.style.display = "";

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
    if (state === "complete") return "#ic-check";
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

  function renderFailedState() {
    const body = $("#roadmapBody");
    const addBtn = $("#addTaskBtn");
    if (addBtn) addBtn.style.display = "none";

    body.innerHTML = `
      <div class="empty-roadmaps is-visible" style="border-color:var(--color-error-tint);">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="color:var(--color-error);">
          <use href="#ic-warn"/>
        </svg>
        <strong style="color:var(--color-error);">Roadmap generation failed</strong>
        <p style="margin-top:6px; margin-bottom:16px;">We were unable to complete generation for this roadmap.</p>
        <a href="roadmapmanager.html" class="btn-solid" style="display:inline-flex; text-decoration:none;">Back to Roadmap Manager</a>
      </div>
    `;
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
          <p style="margin-top:4px;">Tap "Add a task" below to start building your milestone graph.</p>
        </div>
      `;
      return;
    }

    const nodeMap = getNodeMap();

    // Group nodes by phase if any phase exists
    const hasPhases = nodes.some(n => Boolean(n.phase));

    let groups = [];
    if (hasPhases) {
      const phaseMap = new Map();
      nodes.forEach(node => {
        const phaseName = (node.phase && node.phase.trim()) || "General Tasks";
        if (!phaseMap.has(phaseName)) {
          phaseMap.set(phaseName, []);
        }
        phaseMap.get(phaseName).push(node);
      });

      phaseMap.forEach((pNodes, label) => {
        // Sort within phase by order if present
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

      group.nodes.forEach((node, nIdx) => {
        const state = getNodeState(node, nodeMap);
        const lineDone = node.completed ? "is-done" : "";
        const title = node.name || node.title || "Untitled task";
        const estimate = node.time_estimate || node.estimate || "—";
        const depNames = getDependencyNames(node, nodeMap);

        html += '<div class="node-item is-' + state + '" data-node-id="' + escapeHtml(String(node.id)) + '">';
        html += '  <div class="node-chain-line ' + lineDone + '"></div>';
        html += '  <div class="node-icon-circle"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><use href="' + iconForState(state) + '"></use></svg></div>';
        html += '  <div class="node-card" data-node-id="' + escapeHtml(String(node.id)) + '">';
        html += '    <p class="node-title">' + escapeHtml(title) + '</p>';
        if (node.description) {
          html += '    <p class="node-meta-item" style="margin-bottom:6px; color:var(--color-ink-soft); font-size:12.5px; line-height:1.4;">' + escapeHtml(node.description) + '</p>';
        }
        html += '    <div class="node-meta-row">';
        html += '      <span class="node-meta-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><use href="#ic-clock-small"></use></svg>' + escapeHtml(estimate) + '</span>';
        if (state === "locked") {
          html += '      <span class="locked-tag">Locked' + (depNames.length ? ' — requires ' + escapeHtml(depNames.join(", ")) : '') + '</span>';
        } else if (state === "available") {
          html += '      <span style="color:var(--color-orange-deep); font-weight:600; font-size:11px;">Available now</span>';
        } else if (state === "complete") {
          html += '      <span style="color:var(--color-success); font-weight:600; font-size:11px;">Completed</span>';
        }
        html += '    </div>';
        html += '  </div>';
        html += '</div>';
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

        const nodeMap = getNodeMap();
        const state = getNodeState(node, nodeMap);

        if (state === "locked") {
          const depNames = getDependencyNames(node, nodeMap);
          const reqText = depNames.length ? `Complete "${depNames.join(', ')}" first.` : "Finish the earlier tasks first to unlock this one.";
          showToast(reqText);
          return;
        }
        openNodeDetail(nodeId);
      });
    });
  }

  let currentNodeId = null;

  function openNodeDetail(id) {
    const node = findNodeById(id);
    if (!node) return;
    currentNodeId = id;

    const title = node.name || node.title || "Task";
    const desc = node.description || "No description provided.";
    const estimate = node.time_estimate || node.estimate || "—";

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
      const actionLabel = isCompleted ? "uncomplete" : "complete";
      const targetPath = `/roadmaps/${roadmapId}/nodes/${node.id}/${actionLabel}`;

      completeBtn.disabled = true;

      try {
        if (isCompleted) {
          if (window.TasklyAPI && window.TasklyAPI.uncompleteRoadmapNode) {
            await window.TasklyAPI.uncompleteRoadmapNode(roadmapId, node.id);
          } else {
            await apiSend(targetPath, "POST");
          }
          node.completed = false;
          showToast("Marked incomplete.");
        } else {
          if (window.TasklyAPI && window.TasklyAPI.completeRoadmapNode) {
            await window.TasklyAPI.completeRoadmapNode(roadmapId, node.id);
          } else {
            await apiSend(targetPath, "POST");
          }
          node.completed = true;
          showToast("Nice work! Task complete.", "success");
        }

        closeModal("nodeDetailOverlay");

        // Re-fetch roadmap to ensure full sync with backend progress_percentage
        try {
          let freshData = null;
          if (window.TasklyAPI && window.TasklyAPI.getRoadmapById) {
            freshData = await window.TasklyAPI.getRoadmapById(roadmapId);
          } else {
            freshData = await apiGet(`/roadmaps/${roadmapId}`);
          }
          if (freshData) {
            roadmap = (freshData.roadmap || freshData.data) || freshData;
          }
        } catch (e) {
          // If refetch fails, local node state was already updated
        }

        render();
      } catch (err) {
        console.error(`Failed to ${actionLabel} node:`, err);
        showToast(err.message || `Failed to update task status`, "error");
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
      if (node) $("#deleteTaskTitle").textContent = node.name || node.title || "this task";
      openModal("deleteTaskOverlay");
    });

    $("#confirmDeleteTaskBtn").addEventListener("click", async () => {
      if (!currentNodeId || !roadmapId) return;
      const delBtn = $("#confirmDeleteTaskBtn");
      delBtn.disabled = true;

      try {
        if (window.TasklyAPI && window.TasklyAPI.deleteRoadmapNode) {
          await window.TasklyAPI.deleteRoadmapNode(roadmapId, currentNodeId);
        } else {
          await apiSend(`/roadmaps/${roadmapId}/nodes/${currentNodeId}`, "DELETE");
        }

        roadmap.nodes = (roadmap.nodes || []).filter(n => String(n.id) !== String(currentNodeId));
        closeModal("deleteTaskOverlay");
        showToast("Task deleted.");

        // Refetch to sync progress
        try {
          const fresh = await apiGet(`/roadmaps/${roadmapId}`);
          if (fresh) roadmap = (fresh.roadmap || fresh.data) || fresh;
        } catch (e) {}

        render();
      } catch (err) {
        console.error("Failed to delete node:", err);
        showToast(err.message || "Failed to delete task", "error");
      } finally {
        delBtn.disabled = false;
      }
    });
  }

  /* ==========================================================
     ADD / EDIT TASK FORM & DIRECT API CRUD
     ========================================================== */

  let editingNodeId = null;

  function populateDependencySelect(excludeId, selectedDepId) {
    const select = $("#taskPositionSelect");
    if (!select) return;

    const nodes = (roadmap && Array.isArray(roadmap.nodes)) ? roadmap.nodes : [];
    const availableParents = nodes.filter(n => String(n.id) !== String(excludeId));

    let html = '<option value="">None (Available from start)</option>';
    availableParents.forEach((n) => {
      const title = n.name || n.title || `Task #${n.id}`;
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
      nameInput.value = (node && (node.name || node.title)) || "";
      descInput.value = (node && node.description) || "";
      estInput.value = (node && (node.time_estimate || node.estimate)) || "";
      if (phaseInput) phaseInput.value = (node && node.phase) || "";

      const primaryDep = (node && Array.isArray(node.depends_on) && node.depends_on.length > 0) ? node.depends_on[0] : null;
      populateDependencySelect(nodeId, primaryDep);
    } else {
      heading.textContent = "Add a task";
      nameInput.value = "";
      descInput.value = "";
      estInput.value = "";
      if (phaseInput) phaseInput.value = "";

      // Default dependency to last node in list if available
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
          // Edit Node (PATCH /roadmaps/{id}/nodes/{node_id})
          const patchPayload = {
            name,
            description,
            time_estimate: estimate || "—",
            depends_on: dependsOn,
            phase: phase || null
          };

          if (window.TasklyAPI && window.TasklyAPI.updateRoadmapNode) {
            await window.TasklyAPI.updateRoadmapNode(roadmapId, editingNodeId, patchPayload);
          } else {
            await apiSend(`/roadmaps/${roadmapId}/nodes/${editingNodeId}`, "PATCH", patchPayload);
          }

          showToast("Task updated.", "success");
        } else {
          // Add Node (POST /roadmaps/{id}/nodes)
          const postPayload = {
            name,
            description,
            time_estimate: estimate || "—",
            depends_on: dependsOn,
            phase: phase || null,
            order: (roadmap.nodes || []).length + 1
          };

          if (window.TasklyAPI && window.TasklyAPI.createRoadmapNode) {
            await window.TasklyAPI.createRoadmapNode(roadmapId, postPayload);
          } else {
            await apiSend(`/roadmaps/${roadmapId}/nodes`, "POST", postPayload);
          }

          showToast("Task added.", "success");
        }

        closeModal("taskFormOverlay");

        // Refetch full roadmap to sync order and dependencies
        let fresh = null;
        if (window.TasklyAPI && window.TasklyAPI.getRoadmapById) {
          fresh = await window.TasklyAPI.getRoadmapById(roadmapId);
        } else {
          fresh = await apiGet(`/roadmaps/${roadmapId}`);
        }
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
     ROADMAP-LEVEL OPTIONS (Rename / Delete)
     ========================================================== */

  function wireRoadmapMenu() {
    const menuBtn = $("#roadmapMenuBtn");
    if (menuBtn) menuBtn.addEventListener("click", () => openModal("roadmapMenuOverlay"));

    const renameBtn = $("#renameRoadmapBtn");
    renameBtn && renameBtn.addEventListener("click", async () => {
      const current = (roadmap && (roadmap.title || roadmap.name || roadmap.goal_text)) || "";
      const next = window.prompt("Rename roadmap", current);
      if (next && next.trim()) {
        const trimmed = next.trim();
        closeModal("roadmapMenuOverlay");
        try {
          if (window.TasklyAPI && window.TasklyAPI.updateRoadmap) {
            await window.TasklyAPI.updateRoadmap(roadmapId, { title: trimmed });
          } else {
            await apiSend(`/roadmaps/${roadmapId}`, "PUT", { title: trimmed });
          }
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
      // Prompt notes there is no /ai/generate-roadmap endpoint; remove or disable client simulation
      regenBtn.addEventListener("click", () => {
        closeModal("roadmapMenuOverlay");
        showToast("Roadmap regeneration is managed via the Roadmap Manager.", "info");
      });
    }

    const deleteBtn = $("#deleteRoadmapBtn");
    deleteBtn && deleteBtn.addEventListener("click", async () => {
      closeModal("roadmapMenuOverlay");
      const title = (roadmap && (roadmap.title || roadmap.name)) || "this roadmap";
      if (window.confirm(`Delete "${title}"? This cannot be undone.`)) {
        try {
          if (window.TasklyAPI && window.TasklyAPI.deleteRoadmap) {
            await window.TasklyAPI.deleteRoadmap(roadmapId);
          } else {
            await apiSend(`/roadmaps/${roadmapId}`, "DELETE");
          }
          showToast("Roadmap deleted. Returning to Roadmap Manager…");
          setTimeout(() => { window.location.href = "roadmapmanager.html"; }, 800);
        } catch (err) {
          showToast(err.message || "Failed to delete roadmap", "error");
        }
      }
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
      wireNodeDetailModal();
      wireTaskForm();
      wireRoadmapMenu();

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

