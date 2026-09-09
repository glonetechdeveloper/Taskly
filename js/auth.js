/* ==========================================================
   TASKLY — auth.js
   Shared logic for login.html and signup.html
   Integrated with FastAPI backend endpoints:
   - POST /auth/login
   - POST /auth/register
   Includes offline/demo fallback when backend is unreachable.
   ========================================================== */

window.Taskly = (function () {

  const DEFAULT_PLACEHOLDER = "https://your-service.onrender.com";
  const API_BASE = window.API_BASE || window.TASKLY_API_BASE || localStorage.getItem("TASKLY_API_BASE") || DEFAULT_PLACEHOLDER;
  const TOKEN_KEY = "access_token";

  const EYE_OPEN_SVG = `<svg class="icon-eye-open" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"/><circle cx="12" cy="12" r="3"/></svg>`;
  const EYE_OFF_SVG = `<svg class="icon-eye-closed" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/></svg>`;

  /* ---------- small utilities ---------- */

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

  function showToast(message, type) {
    const toast = $("#toast");
    if (!toast) return;
    toast.textContent = message;
    toast.className = "toast is-visible" + (type === "success" ? " is-success" : "");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove("is-visible"), 4200);
  }

  function setGlobalError(message) {
    const errorEl = document.getElementById("error-message");
    if (errorEl) {
      if (message) {
        errorEl.textContent = message;
        errorEl.style.display = "block";
      } else {
        errorEl.textContent = "";
        errorEl.style.display = "none";
      }
    }
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
    btn.disabled = isLoading;
  }

  function storeToken(token) {
    if (token) {
      try {
        localStorage.setItem("access_token", token);
        localStorage.setItem("taskly_access_token", token);
      } catch (e) {
        console.warn("Storage unavailable", e);
      }
    }
    return token;
  }

  /* ---------- Local offline storage helpers ---------- */

  function getLocalUsers() {
    try {
      const raw = localStorage.getItem("taskly_users");
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveLocalUser(user) {
    try {
      const users = getLocalUsers();
      const existingIdx = users.findIndex(u => u.email.toLowerCase() === user.email.toLowerCase());
      if (existingIdx >= 0) {
        users[existingIdx] = { ...users[existingIdx], ...user };
      } else {
        users.push(user);
      }
      localStorage.setItem("taskly_users", JSON.stringify(users));
    } catch (e) {
      console.warn("Could not save local user", e);
    }
  }

  function findLocalUser(email) {
    const users = getLocalUsers();
    return users.find(u => u.email.toLowerCase() === email.toLowerCase());
  }

  /* ---------- password visibility toggle ---------- */

  function wirePasswordToggles(root) {
    (root || document).querySelectorAll(".field-toggle-visibility").forEach((btn) => {
      if (btn._wired) return;
      btn._wired = true;

      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const targetId = btn.dataset.target || "password";
        const input = document.getElementById(targetId);
        if (!input) return;

        const isCurrentlyPassword = input.type === "password";
        input.type = isCurrentlyPassword ? "text" : "password";
        btn.setAttribute("aria-label", isCurrentlyPassword ? "Hide password" : "Show password");
        btn.innerHTML = isCurrentlyPassword ? EYE_OFF_SVG : EYE_OPEN_SVG;
      });
    });
  }

  /* ---------- background parallax ---------- */

  function wireParallax() {
    const bg = document.getElementById("bgPattern");
    if (!bg || bg._parallaxWired || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    bg._parallaxWired = true;

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

  /* ---------- login handler ---------- */

  async function handleLoginSubmit(e) {
    if (e) e.preventDefault();
    setGlobalError("");

    const form = document.getElementById("login-form") || document.getElementById("formSignin");
    const emailInput = document.getElementById("email");
    const passwordInput = document.getElementById("password");
    const emailField = document.getElementById("fieldEmail");
    const passwordField = document.getElementById("fieldPassword");
    const btn = form ? form.querySelector(".btn-primary") : null;

    const email = emailInput ? emailInput.value.trim().toLowerCase() : "";
    const password = passwordInput ? passwordInput.value : "";

    let valid = true;
    if (!isValidEmail(email)) {
      setFieldError(emailField, "Enter a valid email address");
      valid = false;
    } else {
      setFieldError(emailField, null);
    }

    if (!password) {
      setFieldError(passwordField, "Enter your password");
      valid = false;
    } else {
      setFieldError(passwordField, null);
    }

    if (!valid) return;

    setButtonLoading(btn, true);

    const isPlaceholder = API_BASE.includes("your-service.onrender.com");

    if (!isPlaceholder) {
      try {
        const response = await fetch(`${API_BASE}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        let data = {};
        try { data = await response.json(); } catch (err) { data = {}; }

        if (!response.ok) {
          const errorMsg = data.detail || data.message || "Invalid email or password";
          const formattedMsg = typeof errorMsg === "string" ? errorMsg : JSON.stringify(errorMsg);
          setGlobalError(formattedMsg);
          showToast(formattedMsg, "error");
          setFieldError(passwordField, formattedMsg);
          setButtonLoading(btn, false);
          return;
        }

        if (data.access_token) {
          storeToken(data.access_token);
        }
        try {
          localStorage.setItem("taskly_user_email", email);
          if (data.user && data.user.full_name) {
            localStorage.setItem("taskly_user_name", data.user.full_name);
          }
        } catch (e) {}

        showToast("Signed in. Taking you to your dashboard…", "success");
        setTimeout(() => {
          window.location.href = "dashboard.html";
        }, 500);
        return;

      } catch (err) {
        console.warn("Backend login request failed, checking local auth fallback:", err);
      }
    }

    // Fallback: local simulated auth
    try {
      const localUser = findLocalUser(email);
      if (localUser && localUser.password && localUser.password !== password) {
        setFieldError(passwordField, "Incorrect password. Please try again.");
        setGlobalError("Incorrect password. Please try again.");
        showToast("Incorrect password", "error");
        setButtonLoading(btn, false);
        return;
      }

      // If user exists or if logging in as demo
      const userName = localUser ? localUser.fullName : email.split("@")[0];
      const localToken = "taskly_token_" + btoa(email + ":" + Date.now());
      storeToken(localToken);
      try {
        localStorage.setItem("taskly_user_email", email);
        localStorage.setItem("taskly_user_name", userName || "Taskly User");
      } catch (e) {}

      showToast("Signed in. Taking you to your dashboard…", "success");
      setTimeout(() => {
        window.location.href = "dashboard.html";
      }, 500);

    } catch (err) {
      const msg = err.message || "Sign in failed. Please try again.";
      setGlobalError(msg);
      showToast(msg, "error");
    } finally {
      setButtonLoading(btn, false);
    }
  }

  /* ---------- signup handler ---------- */

  async function handleSignupSubmit(e) {
    if (e) e.preventDefault();
    setGlobalError("");

    const form = document.getElementById("signup-form") || document.getElementById("formSignup");
    const nameInput = document.getElementById("fullName");
    const emailInput = document.getElementById("email");
    const passwordInput = document.getElementById("password");
    const nameField = document.getElementById("fieldFullName");
    const emailField = document.getElementById("fieldEmail");
    const passwordField = document.getElementById("fieldPassword");
    const btn = form ? form.querySelector(".btn-primary") : null;

    const fullName = nameInput ? nameInput.value.trim() : "";
    const email = emailInput ? emailInput.value.trim().toLowerCase() : "";
    const password = passwordInput ? passwordInput.value : "";

    let valid = true;
    if (nameField && !fullName) {
      setFieldError(nameField, "Enter your name");
      valid = false;
    } else if (nameField) {
      setFieldError(nameField, null);
    }

    if (!isValidEmail(email)) {
      setFieldError(emailField, "Enter a valid email address");
      valid = false;
    } else {
      setFieldError(emailField, null);
    }

    if (password.length < 8) {
      setFieldError(passwordField, "Use at least 8 characters");
      valid = false;
    } else {
      setFieldError(passwordField, null);
    }

    if (!valid) return;

    setButtonLoading(btn, true);

    const isPlaceholder = API_BASE.includes("your-service.onrender.com");

    if (!isPlaceholder) {
      try {
        const response = await fetch(`${API_BASE}/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        let data = {};
        try { data = await response.json(); } catch (err) { data = {}; }

        if (!response.ok) {
          const errorMsg = data.detail || data.message || "Registration failed. Please try again.";
          const formattedMsg = typeof errorMsg === "string" ? errorMsg : JSON.stringify(errorMsg);
          setGlobalError(formattedMsg);
          showToast(formattedMsg, "error");
          setFieldError(emailField, formattedMsg);
          setButtonLoading(btn, false);
          return;
        }

        if (data.access_token) {
          storeToken(data.access_token);
        }

        try {
          if (fullName) localStorage.setItem("taskly_user_name", fullName);
          localStorage.setItem("taskly_user_email", email);
        } catch (e) {}

        showToast("Account created. Welcome to Taskly!", "success");
        setTimeout(() => {
          window.location.href = "dashboard.html";
        }, 500);
        return;

      } catch (err) {
        console.warn("Backend register request failed, falling back to local storage:", err);
      }
    }

    // Fallback: local simulated account creation
    try {
      saveLocalUser({ email, password, fullName });
      const localToken = "taskly_token_" + btoa(email + ":" + Date.now());
      storeToken(localToken);

      try {
        if (fullName) localStorage.setItem("taskly_user_name", fullName);
        localStorage.setItem("taskly_user_email", email);
      } catch (e) {}

      showToast("Account created. Welcome to Taskly!", "success");
      setTimeout(() => {
        window.location.href = "dashboard.html";
      }, 500);

    } catch (err) {
      const msg = err.message || "Could not complete registration. Please try again.";
      setGlobalError(msg);
      showToast(msg, "error");
    } finally {
      setButtonLoading(btn, false);
    }
  }

  /* ---------- form wiring ---------- */

  function initLogin() {
    const form = document.getElementById("login-form") || document.getElementById("formSignin");
    if (!form || form._wired) return;
    form._wired = true;
    form.addEventListener("submit", handleLoginSubmit);
  }

  function initSignup() {
    const form = document.getElementById("signup-form") || document.getElementById("formSignup");
    if (!form || form._wired) return;
    form._wired = true;
    form.addEventListener("submit", handleSignupSubmit);
  }

  /* ---------- public entry point ---------- */

  function initForm(opts) {
    const init = () => {
      wirePasswordToggles(document);
      wireParallax();
      playEntrance();
      if (opts && opts.mode === "login") initLogin();
      else if (opts && opts.mode === "signup") initSignup();
      else {
        initLogin();
        initSignup();
      }
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
  }

  // Auto-wire on DOMContentLoaded if not explicitly initialized
  document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("login-form") || document.getElementById("formSignin");
    if (loginForm && !loginForm._wired) {
      loginForm._wired = true;
      loginForm.addEventListener("submit", handleLoginSubmit);
    }

    const signupForm = document.getElementById("signup-form") || document.getElementById("formSignup");
    if (signupForm && !signupForm._wired) {
      signupForm._wired = true;
      signupForm.addEventListener("submit", handleSignupSubmit);
    }

    wirePasswordToggles(document);
    wireParallax();
    playEntrance();
  });

  return {
    initForm,
    handleLoginSubmit,
    handleSignupSubmit,
    wirePasswordToggles,
    storeToken,
    getToken: () => localStorage.getItem("access_token") || localStorage.getItem("taskly_access_token"),
  };
})();