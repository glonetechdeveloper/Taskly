/* ==========================================================
   TASKLY — auth.js
   Shared logic for login.html and signup.html
   Integrated with FastAPI backend endpoints:
   - POST /auth/login
   - POST /auth/register
   ========================================================== */

window.Taskly = (function () {

  const API_BASE = window.API_BASE || window.TASKLY_API_BASE || localStorage.getItem("TASKLY_API_BASE") || "https://your-service.onrender.com";
  const TOKEN_KEY = "access_token";

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

  /* ---------- password visibility toggle ---------- */

  function wirePasswordToggles(root) {
    (root || document).querySelectorAll(".field-toggle-visibility").forEach((btn) => {
      btn.addEventListener("click", () => {
        const input = document.getElementById(btn.dataset.target);
        if (!input) return;
        const nowVisible = input.type === "password";
        input.type = nowVisible ? "text" : "password";
        btn.setAttribute("aria-label", nowVisible ? "Hide password" : "Show password");
      });
    });
  }

  /* ---------- background parallax ---------- */

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

    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      let data = {};
      try {
        data = await response.json();
      } catch (err) {
        data = {};
      }

      if (!response.ok) {
        const errorMsg = data.detail || data.message || "Invalid email or password";
        const formattedMsg = typeof errorMsg === "string" ? errorMsg : JSON.stringify(errorMsg);
        setGlobalError(formattedMsg);
        showToast(formattedMsg, "error");
        setFieldError(passwordField, formattedMsg);
        return;
      }

      if (data.access_token) {
        storeToken(data.access_token);
      }

      showToast("Signed in. Taking you to your dashboard…", "success");
      setTimeout(() => {
        window.location.href = "dashboard.html";
      }, 500);

    } catch (err) {
      const msg = err.message || "Could not connect to server. Please try again.";
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

    try {
      const response = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      let data = {};
      try {
        data = await response.json();
      } catch (err) {
        data = {};
      }

      if (!response.ok) {
        const errorMsg = data.detail || data.message || "Registration failed. Please try again.";
        const formattedMsg = typeof errorMsg === "string" ? errorMsg : JSON.stringify(errorMsg);
        setGlobalError(formattedMsg);
        showToast(formattedMsg, "error");
        setFieldError(emailField, formattedMsg);
        return;
      }

      if (data.access_token) {
        storeToken(data.access_token);
      }

      if (fullName) {
        try { localStorage.setItem("taskly_user_name", fullName); } catch (e) {}
      }

      showToast("Account created. Welcome to Taskly!", "success");
      setTimeout(() => {
        window.location.href = "dashboard.html";
      }, 500);

    } catch (err) {
      const msg = err.message || "Could not connect to server. Please try again.";
      setGlobalError(msg);
      showToast(msg, "error");
    } finally {
      setButtonLoading(btn, false);
    }
  }

  /* ---------- form wiring ---------- */

  function initLogin() {
    const form = document.getElementById("login-form") || document.getElementById("formSignin");
    if (!form) return;
    form.addEventListener("submit", handleLoginSubmit);
  }

  function initSignup() {
    const form = document.getElementById("signup-form") || document.getElementById("formSignup");
    if (!form) return;
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

  // Also auto-wire on DOMContentLoaded if standard IDs are present
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
    storeToken,
    getToken: () => localStorage.getItem("access_token"),
  };
})();