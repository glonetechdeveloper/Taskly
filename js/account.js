/* ==========================================================
   TASKLY — account.js
   User account management and authentication state
   ========================================================== */

window.TasklyAccount = (function () {

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
        const profileStreak = $("#profileStreakDisplay");
        if (profileStreak) {
          profileStreak.textContent = `${count} ${count === 1 ? "Day" : "Days"}`;
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
    if (window.SidebarController && typeof window.SidebarController.renderNavbarNotifications === "function") {
      window.SidebarController.renderNavbarNotifications();
    }
  }

  function wireNotifications() {
    if (window.SidebarController && typeof window.SidebarController.initNotifDropdown === "function") {
      window.SidebarController.initNotifDropdown();
    }
  }

  /* ---------- Ask Nodi ---------- */

  /* ---------- Password Visibility Toggle ---------- */

  const EYE_OPEN_SVG = `<svg class="icon-eye-open" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"/><circle cx="12" cy="3" r="3"/></svg>`;
  const EYE_OFF_SVG = `<svg class="icon-eye-closed" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/></svg>`;

  function wirePasswordToggle() {
    $all(".field-toggle-visibility").forEach((btn) => {
      if (btn._wired) return;
      btn._wired = true;
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const targetId = btn.dataset.target;
        const input = document.getElementById(targetId);
        if (!input) return;
        const nowVisible = input.type === "password";
        input.type = nowVisible ? "text" : "password";
        btn.setAttribute("aria-label", nowVisible ? "Hide password" : "Show password");
        btn.innerHTML = nowVisible ? EYE_OFF_SVG : EYE_OPEN_SVG;
      });
    });
  }

  /* ---------- Avatar Upload ---------- */

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
        if (profileImg) profileImg.src = reader.result;
        if (topbarImg) topbarImg.src = reader.result;
        showToast("Profile picture updated.", "success");
      };
      reader.readAsDataURL(file);
    });
  }

  /* ---------- Profile Details Form ---------- */

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
      try {
        localStorage.setItem("taskly_user_name", name);
        localStorage.setItem("taskly_user_email", email);
      } catch (e) {}
      exitEditMode();
      if (successMsg) successMsg.classList.add("is-visible");
      showToast("Profile updated successfully.", "success");
    });
  }

  /* ---------- Password Form ---------- */

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
      if (staticGrid) staticGrid.style.display = "none";
      if (editFields) editFields.style.display = "block";
      editBtn.style.display = "none";
      currentPass && currentPass.focus();
    });

    function closePasswordEdit() {
      if (currentPass) currentPass.value = "";
      if (newPass) newPass.value = "";
      if (staticGrid) staticGrid.style.display = "block";
      if (editFields) editFields.style.display = "none";
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
      if (nxt.length < 8) {
        showToast("New password must be at least 8 characters.", "error");
        return;
      }
      try {
        localStorage.setItem("taskly_user_password", nxt);
      } catch (e) {}
      if (mainPass) mainPass.value = nxt;
      closePasswordEdit();
      if (successMsg) successMsg.classList.add("is-visible");
      showToast("Password updated.", "success");
    });
  }

  /* ---------- Logout ---------- */

  function wireLogout() {
    const openBtn = $("#openLogoutBtn");
    const confirmBtn = $("#confirmLogoutBtn");
    const sidebarBtn = $("#sidebarLogoutBtn");

    if (openBtn) {
      openBtn.addEventListener("click", () => openModal("logoutOverlay"));
    }

    confirmBtn && confirmBtn.addEventListener("click", () => {
      window.TasklyAPI.clearToken();
      try {
        localStorage.removeItem("taskly_user_email");
        localStorage.removeItem("taskly_user_name");
        localStorage.removeItem("taskly_user_avatar");
        localStorage.removeItem("taskly_user_password");
        localStorage.removeItem("taskly_nodi_history_v2");
        localStorage.removeItem("taskly_nodi_history");
      } catch (e) {}
      closeModal("logoutOverlay");
      showToast("Signed out.");
      setTimeout(() => { window.location.href = "login.html"; }, 300);
    });

    if (sidebarBtn) {
      sidebarBtn.addEventListener("click", () => {
        window.TasklyAPI.clearToken();
        try {
          localStorage.removeItem("taskly_user_email");
          localStorage.removeItem("taskly_user_name");
          localStorage.removeItem("taskly_user_avatar");
          localStorage.removeItem("taskly_user_password");
          localStorage.removeItem("taskly_nodi_history_v2");
          localStorage.removeItem("taskly_nodi_history");
        } catch (e) {}
        window.location.href = "login.html";
      });
    }
  }

  /* ---------- Load Profile (GET /auth/me) ---------- */

  async function loadUserProfile() {
    try {
      const user = await window.TasklyAPI.getMe();
      if (user && user.email) {
        const emailDisplay = $("#userEmailDisplay") || $("#profileEmailDisplay");
        const emailInput = $("#emailInput");
        if (emailDisplay) emailDisplay.textContent = user.email;
        if (emailInput) emailInput.value = user.email;

        const name = user.full_name || localStorage.getItem("taskly_user_name") || user.email.split("@")[0];
        const nameDisplay = $("#profileNameDisplay");
        const nameInput = $("#fullNameInput");
        if (nameDisplay) nameDisplay.textContent = name;
        if (nameInput) nameInput.value = name;
      }
    } catch (e) {
      console.warn("Could not load user profile:", e);
      const email = localStorage.getItem("taskly_user_email") || "";
      const name = localStorage.getItem("taskly_user_name") || "";
      if (email) {
        const emailDisplay = $("#userEmailDisplay") || $("#profileEmailDisplay");
        const emailInput = $("#emailInput");
        if (emailDisplay) emailDisplay.textContent = email;
        if (emailInput) emailInput.value = email;
      }
      if (name) {
        const nameDisplay = $("#profileNameDisplay");
        const nameInput = $("#fullNameInput");
        if (nameDisplay) nameDisplay.textContent = name;
        if (nameInput) nameInput.value = name;
      }
    }

    const savedPass = localStorage.getItem("taskly_user_password") || "";
    const mainPass = $("#passwordInput");
    if (mainPass && savedPass) {
      mainPass.value = savedPass;
    }
  }

  /* ---------- Instant Profile Hydration from localStorage ---------- */

  function hydrateFromLocalStorage() {
    const email = localStorage.getItem("taskly_user_email") || "";
    const name = localStorage.getItem("taskly_user_name") || "";
    const password = localStorage.getItem("taskly_user_password") || "";

    if (name) {
      const nameDisplay = $("#profileNameDisplay");
      const nameInput = $("#fullNameInput");
      if (nameDisplay) nameDisplay.textContent = name;
      if (nameInput && !nameInput.value) nameInput.value = name;
    }
    if (email) {
      const emailDisplay = $("#userEmailDisplay") || $("#profileEmailDisplay");
      const emailInput = $("#emailInput");
      if (emailDisplay) emailDisplay.textContent = email;
      if (emailInput && !emailInput.value) emailInput.value = email;
    }
    if (password) {
      const mainPass = $("#passwordInput");
      if (mainPass) mainPass.value = password;
    }
  }

  /* ---------- Initialization ---------- */

  function init() {
    const run = async () => {
      /* Instantly show cached user info (no waiting for API) */
      hydrateFromLocalStorage();

      wireGenericModalClosers();
      wireDrawer();
      wireStreakPopup();
      wireNotifications();
      wirePasswordToggle();
      wireAvatarUpload();
      wireProfileDetailsForm();
      wirePasswordForm();
      wireLogout();

      await Promise.all([
        loadUserProfile(),
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

if (typeof window !== "undefined" && window.TasklyAccount) {
  window.TasklyAccount.init();
}
