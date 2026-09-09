/* ==========================================================
   TASKLY — roadmap.js
   Dynamic Roadmap Engine, Domain-Aware Goal Generator & Persistence
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
    if (typeof document !== "undefined" && typeof document.createElement === "function") {
      const d = document.createElement("div");
      d.textContent = str || "";
      return d.innerHTML;
    }
    return String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
      window.location.href = "notifications.html";
    });
  }

  /* ---------- Dynamic Goal Generator & Storage Helpers ---------- */

  function getStorageKey() {
    const email = localStorage.getItem("taskly_user_email") || "default";
    return "taskly_roadmaps_" + email.replace(/[^a-zA-Z0-9_]/g, "_");
  }

  function getStoredRoadmaps() {
    try {
      const raw = localStorage.getItem(getStorageKey()) || localStorage.getItem("taskly_user_roadmaps");
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveStoredRoadmaps(roadmaps) {
    try {
      const serialized = JSON.stringify(roadmaps);
      localStorage.setItem(getStorageKey(), serialized);
      localStorage.setItem("taskly_user_roadmaps", serialized);
    } catch (e) {
      console.warn("Could not save roadmaps to storage", e);
    }
  }

  function generateDomainPhases(goal, title) {
    const text = (title + " " + goal).toLowerCase();

    // 1. Coding & Software Development (Rust, Python, React, JS, Go, Web, Backend, etc.)
    if (text.includes("rust") || text.includes("python") || text.includes("code") || text.includes("program") || text.includes("react") || text.includes("javascript") || text.includes("java") || text.includes("web") || text.includes("app") || text.includes("developer") || text.includes("backend") || text.includes("frontend") || text.includes("node") || text.includes("golang") || text.includes("c++")) {
      const subject = title || "Programming";
      return [
        {
          label: "Getting Started & Environment",
          nodes: [
            { id: "n1", title: `Install toolchain & IDE for ${subject}`, description: "Set up the compiler/runtime, code editor, and verify environment setup with a Hello World program.", estimate: "20 minutes", completed: true },
            { id: "n2", title: "Syntax fundamentals & data types", description: "Learn variables, control flow, functions, loops, and basic error handling.", estimate: "45 minutes", completed: false },
            { id: "n3", title: "Working with data structures", description: "Understand arrays, lists, maps/hashmaps, and memory representation.", estimate: "40 minutes", completed: false }
          ]
        },
        {
          label: "Core Architecture & Patterns",
          nodes: [
            { id: "n4", title: "Modular code & dependencies", description: "Organize project packages, imports, and third-party libraries.", estimate: "50 minutes", completed: false },
            { id: "n5", title: "Asynchronous programming & I/O", description: "Master concurrency, async/await, file handling, and network requests.", estimate: "60 minutes", completed: false },
            { id: "n6", title: "Unit testing & debugging", description: "Write automated test cases, inspect stack traces, and handle edge cases.", estimate: "35 minutes", completed: false }
          ]
        },
        {
          label: "Project Building & Polish",
          nodes: [
            { id: "n7", title: `Build a complete working ${subject} project`, description: "Develop an end-to-end practical application showcasing core features.", estimate: "90 minutes", completed: false },
            { id: "n8", title: "Code review & optimization", description: "Refactor code for performance, readability, and write documentation.", estimate: "30 minutes", completed: false }
          ]
        }
      ];
    }

    // 2. UI / UX & Design (Figma, Sketch, UI, UX, Wireframe)
    if (text.includes("figma") || text.includes("design") || text.includes("ui") || text.includes("ux") || text.includes("prototyp") || text.includes("wireframe") || text.includes("graphic")) {
      return [
        {
          label: "Getting Started",
          nodes: [
            { id: "n1", title: "Install Figma & create workspace", description: "Download the desktop app or use browser, then create your design project canvas.", estimate: "15 minutes", completed: true },
            { id: "n2", title: "Master canvas & vector tools", description: "Learn toolbars, layers panel, pen tools, and typography hierarchy.", estimate: "30 minutes", completed: false },
            { id: "n3", title: "Layout grids & spacing systems", description: "Set up 8pt spacing grids, margins, and column layouts for responsive design.", estimate: "25 minutes", completed: false }
          ]
        },
        {
          label: "Auto Layout & Design Systems",
          nodes: [
            { id: "n4", title: "Understand Auto Layout & constraints", description: "Build adaptive components that scale seamlessly with text and screen resize.", estimate: "45 minutes", completed: false },
            { id: "n5", title: "Build reusable components & variants", description: "Create component sets with interactive variant properties and booleans.", estimate: "40 minutes", completed: false },
            { id: "n6", title: "Design tokens & style guides", description: "Create color variables, typography styles, and elevation standards.", estimate: "30 minutes", completed: false }
          ]
        },
        {
          label: "Prototyping & Handoff",
          nodes: [
            { id: "n7", title: "Wire up interactions & animations", description: "Connect frames with smart animate transitions and prototype flows.", estimate: "40 minutes", completed: false },
            { id: "n8", title: "Dev handoff & presentation", description: "Organize specs for developers and present prototype to stakeholders.", estimate: "20 minutes", completed: false }
          ]
        }
      ];
    }

    // 3. Event Planning & Travel (Wedding, Party, Vacation, Trip)
    if (text.includes("wedding") || text.includes("plan") || text.includes("trip") || text.includes("travel") || text.includes("event") || text.includes("party") || text.includes("vacation")) {
      return [
        {
          label: "Vision & Budgeting",
          nodes: [
            { id: "n1", title: "Define scope, date & budget", description: "Set the core objectives, target dates, guest/attendee headcount, and budget allocation.", estimate: "30 minutes", completed: true },
            { id: "n2", title: "Research & shortlist venues / destinations", description: "Compare top options based on availability, capacity, and logistics.", estimate: "60 minutes", completed: false },
            { id: "n3", title: "Finalize reservations & key bookings", description: "Lock in core venue, travel arrangements, and essential vendors.", estimate: "45 minutes", completed: false }
          ]
        },
        {
          label: "Details & Operations",
          nodes: [
            { id: "n4", title: "Coordinate vendors & equipment", description: "Confirm catering, photography, sound/equipment, and specific contracts.", estimate: "50 minutes", completed: false },
            { id: "n5", title: "Send invitations & track RSVPs", description: "Distribute digital/physical invites and manage guest confirmations.", estimate: "40 minutes", completed: false },
            { id: "n6", title: "Prepare detailed day-of timeline", description: "Create hour-by-hour operational run of show.", estimate: "30 minutes", completed: false }
          ]
        },
        {
          label: "Final Countdown",
          nodes: [
            { id: "n7", title: "Pre-event walk-through & rehearsal", description: "Conduct dry run and review backup contingencies.", estimate: "45 minutes", completed: false },
            { id: "n8", title: "Execution & follow-up", description: "Enjoy the milestone and handle post-event wrap up and thank-yous.", estimate: "30 minutes", completed: false }
          ]
        }
      ];
    }

    // 4. Fitness, Sports & Health
    if (text.includes("fitness") || text.includes("workout") || text.includes("gym") || text.includes("run") || text.includes("marathon") || text.includes("health") || text.includes("diet") || text.includes("weight")) {
      return [
        {
          label: "Foundation & Baseline",
          nodes: [
            { id: "n1", title: "Set measurable fitness benchmarks", description: "Record baseline metrics, clear training space, and check essential gear.", estimate: "20 minutes", completed: true },
            { id: "n2", title: "Establish workout routine & schedule", description: "Block dedicated 30-45 minute training sessions 4 times a week.", estimate: "25 minutes", completed: false },
            { id: "n3", title: "Form & movement fundamentals", description: "Master proper breathing and technique on foundational exercises.", estimate: "40 minutes", completed: false }
          ]
        },
        {
          label: "Progression & Nutrition",
          nodes: [
            { id: "n4", title: "Daily hydration & meal planning", description: "Align daily caloric intake, protein targets, and meal prep routines.", estimate: "35 minutes", completed: false },
            { id: "n5", title: "Progressive intensity boost", description: "Increase volume, resistance, or pace across weekly targets.", estimate: "45 minutes", completed: false },
            { id: "n6", title: "Active recovery & mobility", description: "Incorporate stretching, foam rolling, and sleep optimization.", estimate: "25 minutes", completed: false }
          ]
        },
        {
          label: "Target Benchmark",
          nodes: [
            { id: "n7", title: "Midway assessment & adjustments", description: "Test milestone performance and refine training splits.", estimate: "30 minutes", completed: false },
            { id: "n8", title: "Reach peak goal milestone", description: "Execute target distance, personal record, or fitness achievement.", estimate: "60 minutes", completed: false }
          ]
        }
      ];
    }

    // 5. Default General Goal
    const goalTitle = title || "Goal";
    return [
      {
        label: "Phase 1: Discovery & Foundation",
        nodes: [
          { id: "n1", title: `Define success criteria for ${goalTitle}`, description: "Clarify the target outcome, gather reference material, and set realistic milestones.", estimate: "20 minutes", completed: true },
          { id: "n2", title: "Gather required resources & tools", description: "Set up the workspace, acquire necessary tools, and eliminate distractions.", estimate: "30 minutes", completed: false },
          { id: "n3", title: "Complete initial foundation exercises", description: "Build initial momentum with the first actionable steps.", estimate: "45 minutes", completed: false }
        ]
      },
      {
        label: "Phase 2: Core Execution & Milestones",
        nodes: [
          { id: "n4", title: "Execute primary milestone deliverables", description: "Work through the most challenging core components systematically.", estimate: "60 minutes", completed: false },
          { id: "n5", title: "Review progress & iterate", description: "Assess quality against initial standards and make needed course corrections.", estimate: "40 minutes", completed: false },
          { id: "n6", title: "Deep dive into advanced aspects", description: "Refine technique, streamline workflow, and master the details.", estimate: "50 minutes", completed: false }
        ]
      },
      {
        label: "Phase 3: Finalization & Mastery",
        nodes: [
          { id: "n7", title: "Assemble final deliverables", description: "Bring all pieces together into a cohesive, polished final result.", estimate: "45 minutes", completed: false },
          { id: "n8", title: "Review, evaluate & celebrate success", description: "Verify completion against your goal and establish habits to sustain results.", estimate: "25 minutes", completed: false }
        ]
      }
    ];
  }

  function generateDomainTasks(goal, title) {
    const text = (title + " " + goal).toLowerCase();
    if (text.includes("grocer") || text.includes("shop") || text.includes("buy") || text.includes("market") || text.includes("food")) {
      return [
        { id: "t1", title: "Fresh produce (Fruits & vegetables)", description: "Tomatoes, onions, spinach, bananas, apples.", estimate: "10 minutes", completed: false },
        { id: "t2", title: "Protein & Dairy", description: "Eggs, milk, chicken breast or tofu, Greek yogurt.", estimate: "10 minutes", completed: false },
        { id: "t3", title: "Grains & Pantry essentials", description: "Rice, whole wheat pasta, olive oil, spices.", estimate: "5 minutes", completed: false },
        { id: "t4", title: "Healthy snacks & Breakfast", description: "Oats, peanut butter, mixed nuts.", estimate: "5 minutes", completed: false },
        { id: "t5", title: "Household & cleaning items", description: "Dish soap, paper towels, sponges.", estimate: "5 minutes", completed: false }
      ];
    }
    if (text.includes("pack") || text.includes("trip") || text.includes("travel")) {
      return [
        { id: "t1", title: "Travel documents & ID", description: "Passport, tickets, insurance, wallet.", estimate: "10 minutes", completed: false },
        { id: "t2", title: "Electronics & chargers", description: "Phone charger, power bank, adapter, laptop/headphones.", estimate: "15 minutes", completed: false },
        { id: "t3", title: "Clothing & footwear", description: "Outfits for each day, jacket, comfortable shoes.", estimate: "25 minutes", completed: false },
        { id: "t4", title: "Toiletries & medications", description: "Toothbrush, shampoo, essential meds, skincare.", estimate: "15 minutes", completed: false },
        { id: "t5", title: "Pre-departure home check", description: "Lock doors, turn off appliances, adjust thermostat.", estimate: "10 minutes", completed: false }
      ];
    }
    const name = title || "Checklist";
    return [
      { id: "t1", title: `Initial prep for ${name}`, description: "Gather materials and list requirements.", estimate: "15 minutes", completed: false },
      { id: "t2", title: "Primary task item 1", description: "Complete high-priority milestone first.", estimate: "25 minutes", completed: false },
      { id: "t3", title: "Primary task item 2", description: "Execute second milestone.", estimate: "25 minutes", completed: false },
      { id: "t4", title: "Review and quality check", description: "Ensure everything meets requirements.", estimate: "15 minutes", completed: false },
      { id: "t5", title: "Wrap up & next actions", description: "Finalize and archive completed checklist.", estimate: "10 minutes", completed: false }
    ];
  }

  function buildOrLoadRoadmapData(id, type, title, blank) {
    if (id) {
      const stored = window.TasklyAPI ? window.TasklyAPI.getStoredRoadmapDetail(id) : null;
      if (stored && (stored.phases || stored.tasks)) {
        return stored;
      }
    }

    if (blank) {
      return {
        id: id || ("rm-" + Date.now()),
        title: title || "New checklist",
        type: "flat",
        tasks: []
      };
    }

    const goalTitle = title || "My Roadmap";
    if (type === "flat") {
      const tasks = generateDomainTasks(goalTitle, goalTitle);
      return {
        id: id || ("rm-" + Date.now()),
        title: goalTitle,
        goal_text: goalTitle,
        type: "flat",
        tasks
      };
    }

    const phases = generateDomainPhases(goalTitle, goalTitle);
    return {
      id: id || ("rm-" + Date.now()),
      title: goalTitle,
      goal_text: goalTitle,
      type: "sequential",
      phases
    };
  }

  let roadmap = null;

  /* ---------- helpers over the data model ---------- */

  function flattenNodes() {
    if (!roadmap) return [];
    if (roadmap.type === "flat") return roadmap.tasks || [];
    const all = [];
    (roadmap.phases || []).forEach((p) => (p.nodes || []).forEach((n) => all.push(n)));
    return all;
  }

  function computeProgress() {
    const all = flattenNodes();
    if (all.length === 0) return 0;
    const done = all.filter((n) => n.completed).length;
    return Math.round((done / all.length) * 100);
  }

  function persistRoadmapChanges() {
    if (!roadmap || !roadmap.id) return;

    const all = flattenNodes();
    const total = all.length;
    const completed = all.filter(n => n.completed).length;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

    roadmap.total_tasks = total;
    roadmap.completed_tasks = completed;
    roadmap.progress = progress;

    if (window.TasklyAPI) {
      window.TasklyAPI.saveStoredRoadmapDetail(roadmap.id, roadmap);
      window.TasklyAPI.updateRoadmap(roadmap.id, {
        title: roadmap.title,
        type: roadmap.type,
        total_tasks: total,
        completed_tasks: completed,
        progress: progress
      });
    } else {
      try {
        localStorage.setItem(`taskly_roadmap_detail_${roadmap.id}`, JSON.stringify(roadmap));
      } catch (e) {}
    }
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
    const titleEl = $("#roadmapTitle");
    if (titleEl && roadmap) titleEl.textContent = roadmap.title;
    const badge = $("#roadmapTypeBadge");
    const label = $("#roadmapTypeLabel");
    const icon = $("#roadmapTypeIcon");
    const legend = $("#stateLegend");
    if (roadmap && roadmap.type === "flat") {
      if (badge) badge.classList.add("is-flat");
      if (label) label.textContent = "Flat checklist";
      if (icon && typeof icon.setAttribute === "function") icon.setAttribute("href", "#ic-list");
      if (legend) legend.style.display = "none";
    } else {
      if (badge) badge.classList.remove("is-flat");
      if (label) label.textContent = "Sequential";
      if (icon && typeof icon.setAttribute === "function") icon.setAttribute("href", "#ic-layers");
      if (legend) legend.style.display = "";
    }
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

  function renderSequential() {
    const body = $("#roadmapBody");
    const flat = flattenNodes();
    let flatIndex = 0;
    let html = "";

    (roadmap.phases || []).forEach((phase, pIdx) => {
      html += '<div class="phase-block">';
      html += '<div class="phase-label"><span class="phase-index">' + (pIdx + 1) + '</span>' + escapeHtml(phase.label) + '</div>';
      html += '<div class="node-chain">';

      (phase.nodes || []).forEach((node) => {
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
    if (!roadmap.tasks || roadmap.tasks.length === 0) {
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
    persistRoadmapChanges();
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
        if (window.TasklyAPI && window.TasklyAPI.checkInStreak) {
          window.TasklyAPI.checkInStreak().catch(() => {});
        }
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
      const node = findNodeById(currentNodeId);
      if (node) $("#deleteTaskTitle").textContent = node.title;
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
      roadmap.tasks = (roadmap.tasks || []).filter((n) => n.id !== id);
    } else {
      (roadmap.phases || []).forEach((p) => { p.nodes = (p.nodes || []).filter((n) => n.id !== id); });
    }
    render();
  }

  /* ---------- add / edit task form ---------- */

  let editingNodeId = null;

  function siblingListForForm() {
    if (roadmap.type === "flat") {
      if (!roadmap.tasks) roadmap.tasks = [];
      return roadmap.tasks;
    }
    if (!roadmap.phases || roadmap.phases.length === 0) {
      roadmap.phases = [{ label: "Phase 1", nodes: [] }];
    }
    const lastPhase = roadmap.phases[roadmap.phases.length - 1];
    if (!lastPhase.nodes) lastPhase.nodes = [];
    return lastPhase.nodes;
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
        render();
        showToast("Roadmap renamed.", "success");
      }
      closeModal("roadmapMenuOverlay");
    });

    $("#regenerateRoadmapBtn").addEventListener("click", () => {
      closeModal("roadmapMenuOverlay");
      showToast("Regenerating tailored roadmap milestones…");
      setTimeout(() => {
        if (roadmap.type === "flat") {
          roadmap.tasks = generateDomainTasks(roadmap.title, roadmap.title);
        } else {
          roadmap.phases = generateDomainPhases(roadmap.title, roadmap.title);
        }
        render();
        showToast("Roadmap generated.", "success");
      }, 1000);
    });

    $("#deleteRoadmapBtn").addEventListener("click", () => {
      closeModal("roadmapMenuOverlay");
      if (window.confirm('Delete "' + roadmap.title + '"? This can\'t be undone.')) {
        if (window.TasklyAPI && window.TasklyAPI.deleteRoadmap) {
          window.TasklyAPI.deleteRoadmap(roadmap.id);
        } else {
          try {
            localStorage.removeItem(`taskly_roadmap_detail_${roadmap.id}`);
            const remaining = getStoredRoadmaps().filter(r => r.id !== roadmap.id);
            saveStoredRoadmaps(remaining);
          } catch (e) {}
        }
        showToast("Roadmap deleted. Returning to Roadmap Manager…");
        setTimeout(() => { window.location.href = "roadmapmanager.html"; }, 900);
      }
    });
  }

  /* ---------- Ask Nodi modal ---------- */

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

    async function sendMessage(text) {
      const msg = (text || input.value).trim();
      if (!msg) return;
      appendBubble(msg, "user");
      input.value = "";

      const typing = document.createElement("div");
      typing.className = "chat-bubble from-nodi";
      typing.innerHTML = '<span class="typing-dots"><span></span><span></span><span></span></span>';
      body.appendChild(typing);
      body.scrollTop = body.scrollHeight;

      if (window.TasklyAPI && window.TasklyAPI.askNodiAI) {
        try {
          const res = await window.TasklyAPI.askNodiAI(msg, { roadmapTitle: roadmap.title, progress: computeProgress() });
          typing.remove();
          appendBubble(res.reply, "nodi");
          return;
        } catch (e) {}
      }

      setTimeout(() => {
        typing.remove();
        appendBubble(`For "${roadmap.title}", try breaking down the next available step into a 20-minute session. Consistent daily practice is key!`, "nodi");
      }, 900);
    }

    sendBtn.addEventListener("click", () => sendMessage());
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") sendMessage(); });
    $all(".suggestion-chip").forEach((chip) => {
      chip.addEventListener("click", () => sendMessage(chip.textContent));
    });
  }

  /* ---------- init ---------- */

  async function init() {
    const run = async () => {
      const search = (typeof window !== "undefined" && window.location && window.location.search) ? window.location.search : "";
      const params = new URLSearchParams(search);
      const id = params.get("id");
      const type = params.get("type") === "flat" ? "flat" : "sequential";
      const blank = params.get("blank") === "1";
      const title = params.get("title");

      roadmap = buildOrLoadRoadmapData(id, type, title, blank);
      if (title && !id) roadmap.title = title;

      // Save initial state so other views immediately see this roadmap
      persistRoadmapChanges();

      wireGenericModalClosers();
      wireDrawer();
      wireStreakPopup();
      wireNotifications();
      wireNodeDetailModal();
      wireTaskForm();
      wireRoadmapMenu();
      wireNodiModal();

      render();
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", run);
    } else {
      run();
    }
  }

  return { init, getRoadmapData: () => roadmap };
})();

if (typeof window !== "undefined" && window.TasklyRoadmap) {
  window.TasklyRoadmap.init();
}
