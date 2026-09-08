/* ==========================================================
   TASKLY — notifications.js
   ========================================================== */
window.TasklyNotifications = (function () {

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

  /* ---------- generic modal + dropdown plumbing ---------- */

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

  /* ---------- shared shell ---------- */

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

  function wireNotifDropdown() {
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
    viewAll && viewAll.addEventListener("click", () => panel.classList.remove("is-open"));
  }

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
        appendBubble(nodiReplies[Math.floor(Math.random() * nodiReplies.length)], "nodi");
      }, 1100);
    }
    sendBtn.addEventListener("click", () => sendMessage());
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") sendMessage(); });
    $all(".suggestion-chip").forEach((chip) => chip.addEventListener("click", () => sendMessage(chip.textContent)));
  }

  /* ---------- notifications data ---------- */

  const notifData = [
    {
      group: "Today", unread: true, icon: "ic-check", variant: "",
      text: '<strong>My Figma course</strong> — you finished "Auto layout basics".',
      time: "12 minutes ago", link: { type: "sequential", title: "My Figma course" }
    },
    {
      group: "Today", unread: true, icon: "ic-flame", variant: "is-teal",
      text: "You're on a <strong>5 day streak</strong>. Keep it going today!",
      time: "3 hours ago", link: null, isStreak: true
    },
    {
      group: "Yesterday", unread: true, icon: "ic-route", variant: "",
      text: 'Your <strong>Jollof Rice recipe</strong> roadmap is almost done — 2 tasks left.',
      time: "Yesterday, 6:40 PM", link: { type: "flat", title: "Jollof Rice recipe" }
    },
    {
      group: "Yesterday", unread: false, icon: "ic-plus", variant: "is-teal",
      text: '"Plumbing" roadmap was created and is ready to start.',
      time: "Yesterday, 9:12 AM", link: { type: "flat", title: "Plumbing" }
    },
    {
      group: "Earlier this week", unread: false, icon: "ic-route", variant: "",
      text: '<strong>Learn to drive</strong>: "Parallel parking practice" just unlocked.',
      time: "3 days ago", link: { type: "sequential", title: "Learn to drive" }
    },
    {
      group: "Earlier this week", unread: false, icon: "ic-clock-small", variant: "is-teal",
      text: "You haven't touched <strong>My Figma course</strong> in a few days — pick up where you left off?",
      time: "4 days ago", link: { type: "sequential", title: "My Figma course" }
    }
  ];

  function renderNotifications() {
    const container = $("#notifGroups");
    const groups = ["Today", "Yesterday", "Earlier this week"];
    let html = "";

    groups.forEach((groupName) => {
      const items = notifData.filter((n) => n.group === groupName);
      if (!items.length) return;
      html += '<div class="notif-group">';
      html += '<p class="notif-group-label">' + groupName + '</p>';
      html += '<div class="notif-page-list">';
      items.forEach((n, i) => {
        const idx = notifData.indexOf(n);
        html += '<div class="notif-page-item ' + (n.unread ? "" : "is-read") + '" data-idx="' + idx + '" style="animation-delay:' + (i * 0.05) + 's">';
        html += '  <div class="notif-page-icon ' + n.variant + '"><svg viewBox="0 0 24 24" fill="' + (n.icon === "ic-flame" ? "currentColor" : "none") + '" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><use href="#' + n.icon + '"></use></svg></div>';
        html += '  <div class="notif-page-body">';
        html += '    <p class="notif-page-text">' + n.text + '</p>';
        html += '    <p class="notif-page-time">' + n.time + '</p>';
        html += '  </div>';
        if (n.unread) html += '  <span class="notif-unread-dot"></span>';
        html += '</div>';
      });
      html += '</div></div>';
    });

    container.innerHTML = html;
    wireNotificationClicks();
    updateEmptyState();
  }

  function wireNotificationClicks() {
    $all(".notif-page-item").forEach((item) => {
      item.addEventListener("click", () => {
        const idx = Number(item.dataset.idx);
        const n = notifData[idx];
        n.unread = false;
        item.classList.add("is-read");
        const dot = item.querySelector(".notif-unread-dot");
        if (dot) dot.remove();

        if (n.isStreak) {
          openModal("streakOverlay");
          tickCountdown();
          clearInterval(streakInterval);
          streakInterval = setInterval(tickCountdown, 1000);
        } else if (n.link) {
          window.location.href = "roadmap.html?type=" + encodeURIComponent(n.link.type) + "&title=" + encodeURIComponent(n.link.title);
        }
      });
    });
  }

  function updateEmptyState() {
    $("#notifEmptyState").classList.toggle("is-visible", notifData.length === 0);
  }

  function wireMarkAllRead() {
    $("#markAllReadBtn").addEventListener("click", () => {
      notifData.forEach((n) => { n.unread = false; });
      $all(".notif-page-item").forEach((item) => item.classList.add("is-read"));
      $all(".notif-unread-dot").forEach((dot) => dot.remove());
      const bellDot = $("#notifDot");
      if (bellDot) bellDot.style.display = "none";
      showToast("All caught up.", "success");
    });
  }

  /* ---------- init ---------- */

  function init() {
    document.addEventListener("DOMContentLoaded", () => {
      wireGenericModalClosers();
      wireDrawer();
      wireStreakPopup();
      wireNotifDropdown();
      wireNodiModal();
      renderNotifications();
      wireMarkAllRead();
    });
  }

  return { init };
})();

TasklyNotifications.init();
