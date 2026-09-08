/* ==========================================================
   TASKLY — roadmap.js
   ========================================================== */
window.TasklyRoadmap = (function () {

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

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
    d.textContent = str;
    return d.innerHTML;
  }

  /* ---------- generic modal plumbing (mirrors dashboard.js) ---------- */

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
      showToast("A full notifications page is coming soon.");
    });
  }

  /* ---------- sample data ---------- */

  function buildSampleData(type, blank) {
    if (blank) {
      return { title: "New checklist", type: "flat", tasks: [] };
    }
    if (type === "flat") {
      return {
        title: "Weekly groceries",
        type: "flat",
        tasks: [
          { id: "t1", title: "Milk & eggs", description: "2% milk, one dozen eggs.", estimate: "10 minutes", completed: true },
          { id: "t2", title: "Fresh vegetables", description: "Tomatoes, onions, peppers, spinach.", estimate: "15 minutes", completed: true },
          { id: "t3", title: "Rice & pasta", description: "One bag of rice, two boxes of pasta.", estimate: "5 minutes", completed: false },
          { id: "t4", title: "Chicken breast", description: "About 1kg, for the week's meals.", estimate: "5 minutes", completed: false },
          { id: "t5", title: "Snacks", description: "Something for the kids' lunchboxes.", estimate: "10 minutes", completed: false },
          { id: "t6", title: "Dish soap & sponges", description: "Running low under the sink.", estimate: "5 minutes", completed: false }
        ]
      };
    }
    return {
      title: "My Figma course",
      type: "sequential",
      phases: [
        {
          label: "Getting Started",
          nodes: [
            { id: "n1", title: "Install Figma & create an account", description: "Download the desktop app or use the browser version, then create your free account.", estimate: "15 minutes", completed: true },
            { id: "n2", title: "Learn the interface", description: "Get familiar with the toolbar, layers panel, and canvas navigation.", estimate: "30 minutes", completed: true },
            { id: "n3", title: "Create your first frame", description: "Set up a frame and understand artboard basics.", estimate: "20 minutes", completed: false }
          ]
        },
        {
          label: "Auto Layout & Components",
          nodes: [
            { id: "n4", title: "Understand Auto Layout", description: "Learn how auto layout handles spacing and resizing automatically.", estimate: "45 minutes", completed: false },
            { id: "n5", title: "Build reusable components", description: "Create your first component and a variant set.", estimate: "40 minutes", completed: false },
            { id: "n6", title: "Style with color & text styles", description: "Set up shared styles for consistency across your file.", estimate: "25 minutes", completed: false }
          ]
        },
        {
          label: "Prototyping",
          nodes: [
            { id: "n7", title: "Wire up interactions", description: "Connect frames with prototype links and transitions.", estimate: "40 minutes", completed: false },
            { id: "n8", title: "Present & share your file", description: "Learn to share view/edit links and use presentation mode.", estimate: "15 minutes", completed: false }
          ]
        }
      ]
    };
  }

  let roadmap = null;

  /* ---------- helpers over the data model ---------- */

  function flattenNodes() {
    if (roadmap.type === "flat") return roadmap.tasks;
    const all = [];
    roadmap.phases.forEach((p) => p.nodes.forEach((n) => all.push(n)));
    return all;
  }

  function computeProgress() {
    const all = flattenNodes();
    if (all.length === 0) return 0;
    const done = all.filter((n) => n.completed).length;
    return Math.round((done / all.length) * 100);
  }

  function hasAnyTasks() {
    return flattenNodes().length > 0;
  }

  function nodeState(node, indexInFlat, flat) {
    if (node.completed) return "complete";
    const allPreviousComplete = flat.slice(0, indexInFlat).every((n) => n.completed);
    return allPreviousComplete ? "available" : "locked";
  }

  function findNodeById(id) {
    const all = flattenNodes();
    return all.find((n) => n.id === id) || null;
  }

  /* ---------- rendering ---------- */

  function renderHeader() {
    $("#roadmapTitle").textContent = roadmap.title;
    const badge = $("#roadmapTypeBadge");
    const label = $("#roadmapTypeLabel");
    const icon = $("#roadmapTypeIcon");
    if (roadmap.type === "flat") {
      badge.classList.add("is-flat");
      label.textContent = "Flat checklist";
      icon.setAttribute("href", "#ic-list");
      $("#stateLegend").style.display = "none";
    } else {
      badge.classList.remove("is-flat");
      label.textContent = "Sequential";
      icon.setAttribute("href", "#ic-layers");
      $("#stateLegend").style.display = "";
    }
    renderProgressRing();
  }

  function renderProgressRing() {
    const pct = computeProgress();
    const circumference = 150.8;
    const offset = circumference - (pct / 100) * circumference;
    $("#progressRingFill").style.strokeDashoffset = offset;
    $("#progressRingLabel").textContent = pct + "%";
  }

  function iconForState(state) {
    if (state === "complete") return "#ic-check";
    if (state === "locked") return "#ic-lock";
    return "#ic-check";
  }

  function renderSequential() {
    const body = $("#roadmapBody");
    const flat = flattenNodes();
    let flatIndex = 0;
    let html = "";

    roadmap.phases.forEach((phase, pIdx) => {
      html += '<div class="phase-block">';
      html += '<div class="phase-label"><span class="phase-index">' + (pIdx + 1) + '</span>' + escapeHtml(phase.label) + '</div>';
      html += '<div class="node-chain">';

      phase.nodes.forEach((node) => {
        const state = nodeState(node, flatIndex, flat);
        const lineDone = node.completed ? "is-done" : "";
        html += '<div class="node-item is-' + state + '" data-node-id="' + node.id + '">';
        html += '  <div class="node-chain-line ' + lineDone + '"></div>';
        html += '  <div class="node-icon-circle"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><use href="' + iconForState(state) + '"></use></svg></div>';
        html += '  <div class="node-card" data-node-id="' + node.id + '">';
        html += '    <p class="node-title">' + escapeHtml(node.title) + '</p>';
        html += '    <div class="node-meta-row">';
        html += '      <span class="node-meta-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><use href="#ic-clock-small"></use></svg>' + escapeHtml(node.estimate) + '</span>';
        if (state === "locked") html += '      <span class="locked-tag">Locked</span>';
        html += '    </div>';
        html += '  </div>';
        html += '</div>';
        flatIndex++;
      });

      html += '</div></div>';
    });

    body.innerHTML = html;
    wireNodeCards();
  }

  function renderFlat() {
    const body = $("#roadmapBody");
    if (roadmap.tasks.length === 0) {
      body.innerHTML =
        '<div class="empty-roadmaps is-visible">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><use href="#ic-list"></use></svg>' +
        '<strong>Nothing on this list yet</strong>' +
        'Tap "Add a task" below to start building it out.' +
        '</div>';
      return;
    }
    let html = '<div class="checklist">';
    roadmap.tasks.forEach((task, i) => {
      html += '<div class="checklist-item ' + (task.completed ? "is-complete" : "") + '" data-node-id="' + task.id + '" style="animation-delay:' + (i * 0.05) + 's">';
      html += '  <span class="checklist-checkbox" data-checkbox-id="' + task.id + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><use href="#ic-check"></use></svg></span>';
      html += '  <div class="checklist-body">';
      html += '    <p class="checklist-title">' + escapeHtml(task.title) + '</p>';
      html += '    <p class="checklist-meta">' + escapeHtml(task.estimate) + '</p>';
      html += '  </div>';
      html += '</div>';
    });
    html += '</div>';
    body.innerHTML = html;
    wireNodeCards();
  }

  function render() {
    renderHeader();
    if (roadmap.type === "flat") renderFlat(); else renderSequential();
    renderProgressRing();
  }

  /* ---------- node interactions ---------- */

  function wireNodeCards() {
    if (roadmap.type === "flat") {
      $all(".checklist-item").forEach((item) => {
        item.addEventListener("click", () => openNodeDetail(item.dataset.nodeId));
      });
    } else {
      $all(".node-item").forEach((item) => {
        item.addEventListener("click", () => {
          if (item.classList.contains("is-locked")) {
            showToast("Finish the earlier tasks first to unlock this one.");
            return;
          }
          openNodeDetail(item.dataset.nodeId);
        });
      });
    }
  }

  let currentNodeId = null;

  function openNodeDetail(id) {
    const node = findNodeById(id);
    if (!node) return;
    currentNodeId = id;
    $("#nodeDetailTitle").textContent = node.title;
    $("#nodeDetailDesc").textContent = node.description;
    $("#nodeDetailEstimate").textContent = node.estimate;
    const toggle = $("#nodeCompleteToggle");
    const label = $("#nodeCompleteToggleLabel");
    toggle.classList.toggle("is-complete", node.completed);
    label.textContent = node.completed ? "Completed — tap to undo" : "Mark as complete";
    openModal("nodeDetailOverlay");
  }

  function wireNodeDetailModal() {
    $("#nodeCompleteToggle").addEventListener("click", () => {
      const node = findNodeById(currentNodeId);
      if (!node) return;

      if (node.completed) {
        // Uncompleting cascades forward so the chain stays consistent.
        const flat = flattenNodes();
        const idx = flat.findIndex((n) => n.id === node.id);
        let cascaded = false;
        flat.slice(idx).forEach((n) => { if (n.completed) cascaded = true; n.completed = false; });
        if (cascaded && flat.slice(idx + 1).some((n) => n.completed === false)) {
          showToast("Marked incomplete. Later tasks in the chain were reset too.");
        } else {
          showToast("Marked incomplete.");
        }
      } else {
        node.completed = true;
        showToast("Nice work! Task complete.", "success");
      }
      render();
      closeModal("nodeDetailOverlay");
    });

    $("#nodeEditBtn").addEventListener("click", () => {
      closeModal("nodeDetailOverlay");
      openTaskForm(currentNodeId);
    });

    $("#nodeDeleteBtn").addEventListener("click", () => {
      closeModal("nodeDetailOverlay");
      $("#deleteTaskTitle").textContent = findNodeById(currentNodeId).title;
      openModal("deleteTaskOverlay");
    });

    $("#confirmDeleteTaskBtn").addEventListener("click", () => {
      deleteNode(currentNodeId);
      closeModal("deleteTaskOverlay");
      showToast("Task deleted.");
    });
  }

  function deleteNode(id) {
    if (roadmap.type === "flat") {
      roadmap.tasks = roadmap.tasks.filter((n) => n.id !== id);
    } else {
      roadmap.phases.forEach((p) => { p.nodes = p.nodes.filter((n) => n.id !== id); });
    }
    render();
  }

  /* ---------- add / edit task form ---------- */

  let editingNodeId = null;

  function siblingListForForm() {
    // Sequential: siblings = last phase's nodes (new tasks are appended there by default).
    // Flat: siblings = the whole list.
    if (roadmap.type === "flat") return roadmap.tasks;
    return roadmap.phases[roadmap.phases.length - 1].nodes;
  }

  function populatePositionSelect(excludeId) {
    const select = $("#taskPositionSelect");
    const siblings = siblingListForForm().filter((n) => n.id !== excludeId);
    let html = '<option value="">Start of the list</option>';
    siblings.forEach((n) => {
      html += '<option value="' + n.id + '">' + escapeHtml(n.title) + '</option>';
    });
    select.innerHTML = html;
    if (siblings.length) select.value = siblings[siblings.length - 1].id;
  }

  function openTaskForm(nodeId) {
    editingNodeId = nodeId || null;
    const heading = $("#taskFormHeading");
    const nameInput = $("#taskNameInput");
    const descInput = $("#taskDescInput");
    const estInput = $("#taskEstimateInput");

    populatePositionSelect(nodeId);

    if (nodeId) {
      const node = findNodeById(nodeId);
      heading.textContent = "Edit task";
      nameInput.value = node.title;
      descInput.value = node.description;
      estInput.value = node.estimate;
    } else {
      heading.textContent = "Add a task";
      nameInput.value = "";
      descInput.value = "";
      estInput.value = "";
    }
    openModal("taskFormOverlay");
    setTimeout(() => nameInput.focus(), 200);
  }

  function wireTaskForm() {
    $("#addTaskBtn").addEventListener("click", () => openTaskForm(null));

    $("#taskFormSaveBtn").addEventListener("click", () => {
      const name = $("#taskNameInput").value.trim();
      if (!name) { $("#taskNameInput").focus(); return; }
      const description = $("#taskDescInput").value.trim() || "No description yet.";
      const estimate = $("#taskEstimateInput").value.trim() || "—";
      const afterId = $("#taskPositionSelect").value;

      if (editingNodeId) {
        const node = findNodeById(editingNodeId);
        node.title = name;
        node.description = description;
        node.estimate = estimate;
        showToast("Task updated.", "success");
      } else {
        const newNode = { id: "n" + Date.now(), title: name, description, estimate, completed: false };
        const siblings = siblingListForForm();
        if (!afterId) {
          siblings.unshift(newNode);
        } else {
          const idx = siblings.findIndex((n) => n.id === afterId);
          siblings.splice(idx + 1, 0, newNode);
        }
        showToast("Task added.", "success");
      }
      closeModal("taskFormOverlay");
      render();
    });
  }

  /* ---------- roadmap-level menu ---------- */

  function wireRoadmapMenu() {
    $("#roadmapMenuBtn").addEventListener("click", () => openModal("roadmapMenuOverlay"));

    $("#renameRoadmapBtn").addEventListener("click", () => {
      const next = window.prompt("Rename roadmap", roadmap.title);
      if (next && next.trim()) {
        roadmap.title = next.trim();
        renderHeader();
        showToast("Roadmap renamed.", "success");
      }
      closeModal("roadmapMenuOverlay");
    });

    $("#regenerateRoadmapBtn").addEventListener("click", () => {
      closeModal("roadmapMenuOverlay");
      showToast("Regenerating roadmap…");
      setTimeout(() => {
        flattenNodes().forEach((n, i) => { n.completed = i === 0; });
        render();
        showToast("Roadmap regenerated.", "success");
      }, 1400);
    });

    $("#deleteRoadmapBtn").addEventListener("click", () => {
      closeModal("roadmapMenuOverlay");
      if (window.confirm('Delete "' + roadmap.title + '"? This can\'t be undone.')) {
        showToast("Roadmap deleted. Returning to dashboard…");
        setTimeout(() => { window.location.href = "dashboard.html"; }, 900);
      }
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
      const params = new URLSearchParams(window.location.search);
      const type = params.get("type") === "flat" ? "flat" : "sequential";
      const blank = params.get("blank") === "1";
      roadmap = buildSampleData(type, blank);
      if (params.get("title")) roadmap.title = params.get("title");

      wireGenericModalClosers();
      wireDrawer();
      wireStreakPopup();
      wireNotifications();
      wireNodeDetailModal();
      wireTaskForm();
      wireRoadmapMenu();
      wireNodiModal();

      render();
    });
  }

  return { init };
})();

TasklyRoadmap.init();
