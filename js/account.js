/* ==========================================================
   TASKLY — account.js
   ========================================================== */
window.TasklyAccount = (function () {

  const TOKEN_KEY = "taskly_access_token";

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
    viewAll && viewAll.addEventListener("click", () => { window.location.href = "notifications.html"; });
  }

  const nodiReplies = [
    "Good question — you can manage your personal information, update your profile picture, and adjust your password right here.",
    "Looking to customize your learning roadmaps? Head over to the Roadmap Manager to adjust your milestones and pace.",
    "Here's a tip: keeping your daily streak active boosts your learning retention by over 40%!"
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
      }, 1000);
    }

    sendBtn.addEventListener("click", () => sendMessage());
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") sendMessage(); });
    $all(".suggestion-chip").forEach((chip) => chip.addEventListener("click", () => sendMessage(chip.textContent)));
  }

  /* ---------- password visibility toggles ---------- */

  function wirePasswordToggle() {
    $all(".field-toggle-visibility").forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetId = btn.dataset.target;
        const input = document.getElementById(targetId);
        if (!input) return;
        const nowVisible = input.type === "password";
        input.type = nowVisible ? "text" : "password";
        btn.setAttribute("aria-label", nowVisible ? "Hide password" : "Show password");
      });
    });
  }

  /* ---------- avatar upload ---------- */

  function wireAvatarUpload() {
    const fileInput = $("#avatarFileInput");
    const badge = $("#avatarEditBadge");
    const editBtn = $("#editProfilePicBtn");
    const profileImg = $("#profileAvatarImg");
    const topbarImg = $("#topbarAvatar");
    if (!fileInput) return;

    function openPicker() { fileInput.click(); }
    badge && badge.addEventListener("click", openPicker);
    editBtn && editBtn.addEventListener("click", openPicker);

    fileInput.addEventListener("change", () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        showToast("Please choose a valid image file.", "error");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        profileImg.src = reader.result;
        topbarImg.src = reader.result;
        showToast("Profile picture updated.", "success");
      };
      reader.readAsDataURL(file);
    });
  }

  /* ---------- personal details edit/save/cancel ---------- */

  function wireProfileDetailsForm() {
    const inputs = [$("#fullNameInput"), $("#emailInput"), $("#usernameInput"), $("#timezoneInput")].filter(Boolean);
    const editBtn = $("#editDetailsBtn");
    const actions = $("#profileEditActions");
    const cancelBtn = $("#cancelProfileEditBtn");
    const saveBtn = $("#saveProfileBtn");
    const successMsg = $("#profileSuccessMsg");
    const nameDisplay = $("#profileNameDisplay");
    const emailDisplay = $("#profileEmailDisplay");

    let snapshot = inputs.map((i) => i.value);

    function enterEditMode() {
      if (successMsg) successMsg.classList.remove("is-visible");
      inputs.forEach((i) => { i.disabled = false; });
      if (editBtn) editBtn.style.display = "none";
      if (actions) actions.style.display = "flex";
      const first = $("#fullNameInput");
      first && first.focus();
    }

    function exitEditMode() {
      inputs.forEach((i) => { i.disabled = true; });
      if (editBtn) editBtn.style.display = "";
      if (actions) actions.style.display = "none";
    }

    if (editBtn) editBtn.addEventListener("click", enterEditMode);

    if (cancelBtn) cancelBtn.addEventListener("click", () => {
      inputs.forEach((i, idx) => { i.value = snapshot[idx]; });
      exitEditMode();
    });

    if (saveBtn) saveBtn.addEventListener("click", () => {
      const name = $("#fullNameInput") ? $("#fullNameInput").value.trim() : "";
      const email = $("#emailInput") ? $("#emailInput").value.trim() : "";
      if (!name || !email) {
        showToast("Name and email cannot be empty.", "error");
        return;
      }
      snapshot = inputs.map((i) => i.value);
      if (nameDisplay) nameDisplay.textContent = name;
      if (emailDisplay) emailDisplay.textContent = email;
      exitEditMode();
      if (successMsg) successMsg.classList.add("is-visible");
      showToast("Profile updated successfully.", "success");
    });
  }

  /* ---------- password changing ---------- */

  function wirePasswordForm() {
    const editBtn = $("#editPasswordBtn");
    const staticGrid = $("#passwordStaticGrid");
    const editFields = $("#passwordEditFields");
    const cancelBtn = $("#cancelPasswordEditBtn");
    const saveBtn = $("#savePasswordBtn");
    const successMsg = $("#passwordSuccessMsg");
    const currentPass = $("#currentPasswordInput");
    const newPass = $("#newPasswordInput");
    const mainPass = $("#passwordInput");

    if (!editBtn) return;

    editBtn.addEventListener("click", () => {
      if (successMsg) successMsg.classList.remove("is-visible");
      staticGrid.style.display = "none";
      editFields.style.display = "block";
      editBtn.style.display = "none";
      currentPass && currentPass.focus();
    });

    function closePasswordEdit() {
      if (currentPass) currentPass.value = "";
      if (newPass) newPass.value = "";
      staticGrid.style.display = "block";
      editFields.style.display = "none";
      editBtn.style.display = "";
    }

    cancelBtn && cancelBtn.addEventListener("click", closePasswordEdit);

    saveBtn && saveBtn.addEventListener("click", () => {
      const cur = currentPass ? currentPass.value.trim() : "";
      const nxt = newPass ? newPass.value.trim() : "";
      if (!cur || !nxt) {
        showToast("Please fill in both current and new password fields.", "error");
        return;
      }
      if (nxt.length < 6) {
        showToast("New password must be at least 6 characters.", "error");
        return;
      }
      if (mainPass) mainPass.value = nxt;
      closePasswordEdit();
      if (successMsg) successMsg.classList.add("is-visible");
      showToast("Password updated successfully.", "success");
    });
  }

  /* ---------- logout ---------- */

  /* ---------- logout ---------- */

  function wireLogout() {
    const openBtn = $("#openLogoutBtn");
    const confirmBtn = $("#confirmLogoutBtn");
    if (!openBtn) return;

    openBtn.addEventListener("click", () => openModal("logoutOverlay"));

    confirmBtn && confirmBtn.addEventListener("click", () => {
      try {
        localStorage.removeItem("access_token");
        localStorage.removeItem("taskly_access_token");
      } catch (e) { /* storage unavailable */ }
      closeModal("logoutOverlay");
      showToast("You've been logged out.");
      setTimeout(() => { window.location.href = "login.html"; }, 500);
    });
  }

  /* ---------- load profile ---------- */

  async function loadUserProfile() {
    try {
      if (typeof authGetMe === "function") {
        const user = await authGetMe();
        if (user && user.email) {
          const emailDisplay = $("#userEmailDisplay");
          const emailInput = $("#emailInput");
          if (emailDisplay) emailDisplay.textContent = user.email;
          if (emailInput) emailInput.value = user.email;
        }
      }
    } catch (e) {
      console.warn("Could not load user profile:", e);
    }
  }

  /* ---------- init ---------- */

  function init() {
    document.addEventListener("DOMContentLoaded", () => {
      wireGenericModalClosers();
      wireDrawer();
      wireStreakPopup();
      wireNotifications();
      wireNodiModal();
      wirePasswordToggle();
      wireAvatarUpload();
      wireProfileDetailsForm();
      wirePasswordForm();
      wireLogout();
      loadUserProfile();
    });
  }

  return { init };
})();

TasklyAccount.init();
