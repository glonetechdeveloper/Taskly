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

  function isValidEmail(value) {
    if (!value || typeof value !== "string") return false;
    const trimmed = value.trim().toLowerCase();
    return /^[a-zA-Z0-9._%+-]+@(gmail\.com|yahoo\.com)$/.test(trimmed);
  }

  /* ---------- Profile Details Form ---------- */

  function wireProfileDetailsForm() {
    const nameInput = $("#fullNameInput");
    const emailInput = $("#emailInput");
    const tzInput = $("#timezoneInput");
    const inputs = [nameInput, emailInput, tzInput].filter(Boolean);
    const editBtn = $("#editDetailsBtn");
    const actions = $("#profileEditActions");
    const cancelBtn = $("#cancelProfileEditBtn");
    const saveBtn = $("#saveProfileBtn");
    const successMsg = $("#profileSuccessMsg");
    const nameDisplay = $("#profileNameDisplay");
    const emailDisplay = $("#profileEmailDisplay");
    const emailErrorEl = $("#emailError");
    const nameErrorEl = $("#fullNameError");

    function clearErrors() {
      if (emailErrorEl) { emailErrorEl.textContent = ""; emailErrorEl.style.display = "none"; }
      if (nameErrorEl) { nameErrorEl.textContent = ""; nameErrorEl.style.display = "none"; }
    }

    let snapshot = inputs.map((i) => i ? i.value : "");

    function enterEditMode() {
      if (successMsg) successMsg.classList.remove("is-visible");
      clearErrors();
      inputs.forEach((i) => { if (i !== tzInput) i.disabled = false; });
      if (editBtn) editBtn.style.display = "none";
      if (actions) actions.style.display = "flex";
      nameInput && nameInput.focus();
    }

    function exitEditMode() {
      clearErrors();
      inputs.forEach((i) => { i.disabled = true; });
      if (editBtn) editBtn.style.display = "";
      if (actions) actions.style.display = "none";
    }

    if (editBtn) editBtn.addEventListener("click", enterEditMode);

    if (cancelBtn) cancelBtn.addEventListener("click", () => {
      inputs.forEach((i, idx) => { if (i) i.value = snapshot[idx]; });
      exitEditMode();
    });

    if (saveBtn) saveBtn.addEventListener("click", async () => {
      clearErrors();
      const name = nameInput ? nameInput.value.trim() : "";
      const email = emailInput ? emailInput.value.trim().toLowerCase() : "";

      if (!name) {
        if (nameErrorEl) {
          nameErrorEl.textContent = "Please enter your name.";
          nameErrorEl.style.display = "block";
        }
        showToast("Please enter your name.", "error");
        nameInput && nameInput.focus();
        return;
      }

      if (!isValidEmail(email)) {
        if (emailErrorEl) {
          emailErrorEl.textContent = "Email must be a @gmail.com or @yahoo.com address.";
          emailErrorEl.style.display = "block";
        }
        showToast("Email must be a @gmail.com or @yahoo.com address.", "error");
        emailInput && emailInput.focus();
        return;
      }

      saveBtn.disabled = true;
      const originalHtml = saveBtn.innerHTML;
      saveBtn.innerHTML = '<span class="spinner-ring" style="width:14px; height:14px; border-width:2px; border-top-color:currentColor;"></span> Saving…';

      try {
        const updated = await window.TasklyAPI.updateMe({ name, email });
        
        snapshot = inputs.map((i) => i ? i.value : "");
        const finalName = (updated && updated.name) || name;
        const finalEmail = (updated && updated.email) || email;

        if (nameDisplay) nameDisplay.textContent = finalName;
        if (emailDisplay) emailDisplay.textContent = finalEmail;

        try {
          localStorage.setItem("taskly_user_name", finalName);
          localStorage.setItem("taskly_user_email", finalEmail);
        } catch (e) {}

        exitEditMode();
        if (successMsg) successMsg.classList.add("is-visible");
        showToast("Profile updated successfully.", "success");

        if (window.SidebarController && typeof window.SidebarController.initUserInfo === "function") {
          window.SidebarController.initUserInfo();
        }
      } catch (err) {
        console.error("Profile update failed:", err);
        const status = err.status;
        const msg = (err && err.message) ? err.message : "";

        if (status === 409 || msg.toLowerCase().includes("already registered")) {
          if (emailErrorEl) {
            emailErrorEl.textContent = "Email is already registered by another account.";
            emailErrorEl.style.display = "block";
          }
          showToast("Email is already registered.", "error");
        } else if (status === 401) {
          showToast("Session expired. Redirecting to login…", "error");
          setTimeout(() => { window.location.href = "login.html"; }, 800);
        } else if (status === 422) {
          if (emailErrorEl) {
            emailErrorEl.textContent = msg || "Validation error with email format.";
            emailErrorEl.style.display = "block";
          }
          showToast(msg || "Validation error.", "error");
        } else {
          showToast(window.TasklyAPI ? window.TasklyAPI.sanitizeError(err) : (msg || "Failed to update profile."), "error");
        }
      } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalHtml;
      }
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
    const currentPassErr = $("#currentPasswordError");
    const newPassErr = $("#newPasswordError");

    function clearPassErrors() {
      if (currentPassErr) { currentPassErr.textContent = ""; currentPassErr.style.display = "none"; }
      if (newPassErr) { newPassErr.textContent = ""; newPassErr.style.display = "none"; }
    }

    if (!editBtn) return;

    editBtn.addEventListener("click", () => {
      clearPassErrors();
      if (successMsg) successMsg.classList.remove("is-visible");
      if (staticGrid) staticGrid.style.display = "none";
      if (editFields) editFields.style.display = "block";
      editBtn.style.display = "none";
      currentPass && currentPass.focus();
    });

    function closePasswordEdit() {
      clearPassErrors();
      if (currentPass) currentPass.value = "";
      if (newPass) newPass.value = "";
      if (staticGrid) staticGrid.style.display = "block";
      if (editFields) editFields.style.display = "none";
      editBtn.style.display = "";
    }

    cancelBtn && cancelBtn.addEventListener("click", closePasswordEdit);

    saveBtn && saveBtn.addEventListener("click", async () => {
      clearPassErrors();
      const cur = currentPass ? currentPass.value : "";
      const nxt = newPass ? newPass.value : "";

      if (!cur) {
        if (currentPassErr) {
          currentPassErr.textContent = "Please enter your current password.";
          currentPassErr.style.display = "block";
        }
        showToast("Please enter your current password.", "error");
        currentPass && currentPass.focus();
        return;
      }

      if (!nxt || nxt.length < 8 || nxt.length > 72) {
        if (newPassErr) {
          newPassErr.textContent = "New password must be between 8 and 72 characters.";
          newPassErr.style.display = "block";
        }
        showToast("New password must be between 8 and 72 characters.", "error");
        newPass && newPass.focus();
        return;
      }

      saveBtn.disabled = true;
      const originalHtml = saveBtn.innerHTML;
      saveBtn.innerHTML = '<span class="spinner-ring" style="width:14px; height:14px; border-width:2px; border-top-color:currentColor;"></span> Updating…';

      try {
        await window.TasklyAPI.updateMe({
          password: nxt,
          current_password: cur
        });

        try {
          localStorage.setItem("taskly_user_password", nxt);
        } catch (e) {}

        if (mainPass) mainPass.value = nxt;
        closePasswordEdit();
        if (successMsg) successMsg.classList.add("is-visible");
        showToast("Profile updated successfully.", "success");

      } catch (err) {
        console.error("Password update failed:", err);
        const status = err.status;
        const msg = (err && err.message) ? err.message : "";

        if (status === 400 || msg.toLowerCase().includes("current password is incorrect") || msg.toLowerCase().includes("incorrect password")) {
          if (currentPassErr) {
            currentPassErr.textContent = "Current password is incorrect.";
            currentPassErr.style.display = "block";
          }
          showToast("Current password is incorrect.", "error");
        } else if (status === 422) {
          if (newPassErr) {
            newPassErr.textContent = msg || "Password must be between 8 and 72 characters.";
            newPassErr.style.display = "block";
          }
          showToast(msg || "Password validation error.", "error");
        } else if (status === 401) {
          showToast("Session expired. Redirecting to login…", "error");
          setTimeout(() => { window.location.href = "login.html"; }, 800);
        } else {
          showToast(window.TasklyAPI ? window.TasklyAPI.sanitizeError(err) : (msg || "Failed to update password."), "error");
        }
      } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalHtml;
      }
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

        const name = user.name || user.full_name || localStorage.getItem("taskly_user_name") || user.email.split("@")[0];
        const nameDisplay = $("#profileNameDisplay");
        const nameInput = $("#fullNameInput");
        if (nameDisplay) nameDisplay.textContent = name;
        if (nameInput) nameInput.value = name;

        try {
          localStorage.setItem("taskly_user_name", name);
          localStorage.setItem("taskly_user_email", user.email);
          if (user.id) localStorage.setItem("taskly_user_id", user.id);
        } catch (e) {}

        if (window.SidebarController && typeof window.SidebarController.initUserInfo === "function") {
          window.SidebarController.initUserInfo();
        }
      }
    } catch (e) {
      console.warn("Could not load user profile:", e);
      hydrateFromLocalStorage();
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
