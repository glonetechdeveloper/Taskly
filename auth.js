/* ==========================================================
   TASKLY — auth.js
   Shared logic for login.html and signup.html
   ========================================================== */
window.Taskly = (function () {

  // Point this at your FastAPI backend. Override before this
  // script loads with: <script>window.TASKLY_API_BASE = "https://api.taskly.app";</script>
  const API_BASE = window.TASKLY_API_BASE || "http://localhost:8000";
  const TOKEN_KEY = "taskly_access_token";

  /* ---------- small utilities ---------- */

  function $(sel, root) { return (root || document).querySelector(sel); }

  function showToast(message, type) {
    const toast = $("#toast");
    if (!toast) return;
    toast.textContent = message;
    toast.className = "toast is-visible" + (type === "success" ? " is-success" : "");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove("is-visible"), 4200);
  }

  function setFieldError(fieldEl, message) {
    if (!fieldEl) return;
    const textEl = fieldEl.querySelector(".field-error-text");
    if (message) {
      if (textEl) textEl.textContent = message;
      fieldEl.classList.add("has-error");
      fieldEl.classList.remove("shake");
      // restart shake animation
      void fieldEl.offsetWidth;
      fieldEl.classList.add("shake");
    } else {
      fieldEl.classList.remove("has-error", "shake");
    }
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function setButtonLoading(btn, isLoading) {
    if (!btn) return;
    btn.classList.toggle("is-loading", isLoading);
  }

  async function apiRequest(path, body) {
    const res = await fetch(API_BASE + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    let data = null;
    try { data = await res.json(); } catch (e) { /* no body */ }
    if (!res.ok) {
      const msg = (data && (data.detail || data.message)) || "Something went wrong. Please try again.";
      throw new Error(typeof msg === "string" ? msg : "Something went wrong. Please try again.");
    }
    return data || {};
  }

  function storeToken(data) {
    const token = data.access_token || data.token || null;
    if (token) {
      try { localStorage.setItem(TOKEN_KEY, token); } catch (e) { /* storage unavailable */ }
    }
    return token;
  }

  /* ---------- password visibility toggle ---------- */

  function wirePasswordToggles(root) {
    root.querySelectorAll(".field-toggle-visibility").forEach((btn) => {
      btn.addEventListener("click", () => {
        const input = document.getElementById(btn.dataset.target);
        if (!input) return;
        const nowVisible = input.type === "password";
        input.type = nowVisible ? "text" : "password";
        btn.setAttribute("aria-label", nowVisible ? "Hide password" : "Show password");
      });
    });
  }

  /* ---------- background parallax (subtle, non-intrusive) ---------- */

  function wireParallax() {
    const bg = document.getElementById("bgPattern");
    if (!bg || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let targetX = 0, targetY = 0, curX = 0, curY = 0;

    window.addEventListener("mousemove", (e) => {
      targetX = (e.clientX / window.innerWidth - 0.5) * 14;
      targetY = (e.clientY / window.innerHeight - 0.5) * 14;
    });

    window.addEventListener("scroll", () => {
      targetY += (window.scrollY * 0.02);
    }, { passive: true });

    (function loop() {
      curX += (targetX - curX) * 0.06;
      curY += (targetY - curY) * 0.06;
      bg.style.transform = `translate(${curX.toFixed(2)}px, ${curY.toFixed(2)}px)`;
      requestAnimationFrame(loop);
    })();
  }

  /* ---------- entrance animation trigger ---------- */

  function playEntrance() {
    const card = document.getElementById("authCard");
    if (!card) return;
    requestAnimationFrame(() => card.classList.add("is-visible"));
  }

  /* ---------- form wiring ---------- */

  function initLogin() {
    const form = document.getElementById("formSignin");
    if (!form) return;
    const btn = form.querySelector(".btn-primary");

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const emailField = document.getElementById("fieldEmail");
      const passwordField = document.getElementById("fieldPassword");
      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value;

      let valid = true;
      if (!isValidEmail(email)) { setFieldError(emailField, "Enter a valid email address"); valid = false; }
      else setFieldError(emailField, null);

      if (!password) { setFieldError(passwordField, "Enter your password"); valid = false; }
      else setFieldError(passwordField, null);

      if (!valid) return;

      setButtonLoading(btn, true);
      try {
        const data = await apiRequest("/auth/login", { email, password });
        storeToken(data);
        showToast("Signed in. Taking you to your dashboard…", "success");
        // window.location.href = "dashboard.html";
      } catch (err) {
        showToast(err.message, "error");
      } finally {
        setButtonLoading(btn, false);
      }
    });
  }

  function initSignup() {
    const form = document.getElementById("formSignup");
    if (!form) return;
    const btn = form.querySelector(".btn-primary");

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const nameField = document.getElementById("fieldFullName");
      const emailField = document.getElementById("fieldEmail");
      const passwordField = document.getElementById("fieldPassword");
      const fullName = document.getElementById("fullName").value.trim();
      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value;

      let valid = true;
      if (!fullName) { setFieldError(nameField, "Enter your name"); valid = false; }
      else setFieldError(nameField, null);

      if (!isValidEmail(email)) { setFieldError(emailField, "Enter a valid email address"); valid = false; }
      else setFieldError(emailField, null);

      if (password.length < 8) { setFieldError(passwordField, "Use at least 8 characters"); valid = false; }
      else setFieldError(passwordField, null);

      if (!valid) return;

      setButtonLoading(btn, true);
      try {
        // NOTE: the backend spec (/auth/register) only accepts email + password.
        // fullName is collected for the UI but not sent yet — add it to the
        // payload once the backend supports a name field.
        const data = await apiRequest("/auth/register", { email, password });
        storeToken(data);
        showToast("Account created. Let's build your first roadmap…", "success");
        // window.location.href = "dashboard.html";
      } catch (err) {
        showToast(err.message, "error");
      } finally {
        setButtonLoading(btn, false);
      }
    });
  }

  /* ---------- public entry point ---------- */

  function initForm(opts) {
    document.addEventListener("DOMContentLoaded", () => {
      wirePasswordToggles(document);
      wireParallax();
      playEntrance();
      if (opts.mode === "login") initLogin();
      if (opts.mode === "signup") initSignup();
    });
  }

  return { initForm };
})();