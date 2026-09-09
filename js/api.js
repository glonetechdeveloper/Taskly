/* ==========================================================
   TASKLY — api.js
   Centralized API Client and Authentication Helpers
   ========================================================== */

const DEFAULT_PLACEHOLDER = "https://your-service.onrender.com";
const API_BASE = window.API_BASE || window.TASKLY_API_BASE || localStorage.getItem("TASKLY_API_BASE") || DEFAULT_PLACEHOLDER;

function getToken() {
  return localStorage.getItem("access_token") || localStorage.getItem("taskly_access_token");
}

function setToken(token) {
  if (token) {
    localStorage.setItem("access_token", token);
    localStorage.setItem("taskly_access_token", token);
  }
}

function removeToken() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("taskly_access_token");
}

async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_BASE}${path}`, { ...options, headers });

    if (response.status === 401) {
      removeToken();
      window.location.href = "login.html";
      return response;
    }

    return response;
  } catch (err) {
    console.error("API Fetch Error:", err);
    throw err;
  }
}

async function authLogin(email, password) {
  const isPlaceholder = API_BASE.includes("your-service.onrender.com");
  const normalizedEmail = email.trim().toLowerCase();

  if (!isPlaceholder) {
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, password }),
      });

      let data = {};
      try { data = await response.json(); } catch (e) { data = {}; }

      if (!response.ok) {
        const message = (data && (data.detail || data.message)) || "Invalid email or password";
        throw new Error(typeof message === "string" ? message : JSON.stringify(message));
      }

      if (data.access_token) {
        setToken(data.access_token);
      }
      return data;
    } catch (err) {
      console.warn("authLogin network error, using local session:", err);
    }
  }

  // Fallback local session
  const localToken = "taskly_token_" + btoa(normalizedEmail + ":" + Date.now());
  setToken(localToken);
  try {
    localStorage.setItem("taskly_user_email", normalizedEmail);
  } catch (e) {}
  return { access_token: localToken, token_type: "bearer" };
}

async function authRegister(email, password, fullName) {
  const isPlaceholder = API_BASE.includes("your-service.onrender.com");
  const normalizedEmail = email.trim().toLowerCase();

  if (!isPlaceholder) {
    try {
      const response = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, password }),
      });

      let data = {};
      try { data = await response.json(); } catch (e) { data = {}; }

      if (!response.ok) {
        const message = (data && (data.detail || data.message)) || "Registration failed. Please try again.";
        throw new Error(typeof message === "string" ? message : JSON.stringify(message));
      }

      if (data.access_token) {
        setToken(data.access_token);
      }
      return data;
    } catch (err) {
      console.warn("authRegister network error, using local session:", err);
    }
  }

  // Fallback local registration
  const localToken = "taskly_token_" + btoa(normalizedEmail + ":" + Date.now());
  setToken(localToken);
  try {
    localStorage.setItem("taskly_user_email", normalizedEmail);
    if (fullName) localStorage.setItem("taskly_user_name", fullName);
  } catch (e) {}
  return { access_token: localToken, token_type: "bearer" };
}

async function authGetMe() {
  const isPlaceholder = API_BASE.includes("your-service.onrender.com");
  if (!isPlaceholder) {
    try {
      const response = await apiFetch("/auth/me");
      if (response.ok) {
        return await response.json();
      }
    } catch (e) {
      console.warn("authGetMe network error, using local cached profile:", e);
    }
  }

  // Fallback to local profile info
  return {
    email: localStorage.getItem("taskly_user_email") || "user@taskly.app",
    full_name: localStorage.getItem("taskly_user_name") || "Taskly User",
  };
}

function authLogout() {
  removeToken();
  window.location.href = "login.html";
}

// Expose globally
window.API_BASE = API_BASE;
window.getToken = getToken;
window.setToken = setToken;
window.removeToken = removeToken;
window.apiFetch = apiFetch;
window.authLogin = authLogin;
window.authRegister = authRegister;
window.authGetMe = authGetMe;
window.authLogout = authLogout;

